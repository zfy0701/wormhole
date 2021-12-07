import { ethers } from 'ethers';
import { Route, Trade } from '@uniswap/v2-sdk';
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';

import { State, UniswapV2PairProducer } from './pool';


export interface QuotedPriceQty {
    price: number;
    qty: number;
}


export class UniswapV2PairQuoter {
    public producer: UniswapV2PairProducer;

    constructor() {
        // :O
    }

    async initialize(provider: ethers.providers.JsonRpcProvider, chainId: number, poolAddress: string) {
        this.producer = await UniswapV2PairProducer.create(provider, chainId, poolAddress);
    }

    static async create(provider: ethers.providers.JsonRpcProvider, chainId: number, poolAddress: string): Promise<UniswapV2PairQuoter> {
        const o = new UniswapV2PairQuoter();
        await o.initialize(provider, chainId, poolAddress);
        return o;
    }

    getLpState(): State {
        return this.producer.getLpState();
    }

    getTokenA(): Token {
        return this.producer.tokenA;
    }

    getTokenB(): Token {
        return this.producer.tokenB;
    }

    getTokenLegIndex(tokenAddress: string): number {
        const tokenA = this.getTokenA().address.toLowerCase();
        const tokenB = this.getTokenB().address.toLowerCase();

        const token = tokenAddress.toLowerCase();
        if (tokenA === token) {
            return 0;
        } else if (tokenB === token) {
            return 1;
        } else {
            throw new Error('invalid token address');
        }
    }

    getToken(tokenAddress: string): Token {
        if (this.getTokenLegIndex(tokenAddress) === 0) {
            return this.getTokenA();
        } else {
            return this.getTokenB();
        }
    }

    determineTokenInAndOut(tokenInAddress: string): Token[] {
        const tokenA = this.getTokenA();
        const tokenB = this.getTokenB();

        if (this.getTokenLegIndex(tokenInAddress) === 0) {
            return [tokenA, tokenB];
        } else {
            return [tokenB, tokenA];
        }
    }

    async computeAmountOut(tokenInAddress: string, amount: string): Promise<QuotedPriceQty> {
        const fixedAmount = ethers.FixedNumber.from(amount);

        const producer = this.producer;

        const [tokenIn, tokenOut] = this.determineTokenInAndOut(tokenInAddress);

        const multiplier = ethers.FixedNumber.from(
            ethers.BigNumber.from('10').pow(tokenIn.decimals).toString()
        );
        //const multiplier = ethers.FixedNumber.from('1');
        const amountInAttempt = fixedAmount.mulUnsafe(multiplier).toString();

        // hack to intify a large fixed number. brace yourselves
        if (!amountInAttempt.endsWith('.0')) {
            throw new Error('number not big enough?');
        }

        const amountIn = amountInAttempt.slice(0, -2);
        const tokenAmount = CurrencyAmount.fromRawAmount(tokenIn, amountIn);

        const route = new Route([producer.makePair()], tokenIn, tokenOut);
        const quote = new Trade(route, tokenAmount, TradeType.EXACT_INPUT)

        const fixedQty = ethers.FixedNumber.from(quote.outputAmount.toSignificant(12));
        const fixedPrice = fixedAmount.divUnsafe(fixedQty);

        const result: QuotedPriceQty = {
            price: Number(fixedPrice.toString()),
            qty: Number(fixedQty.toString())
        };
        return result;
    }

}