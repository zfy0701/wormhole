import { ethers } from "ethers";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import { Route, Trade } from "@uniswap/v3-sdk";
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";

import { mainnetProvider } from "../metamask";
import { UniswapV3PoolProducer } from "../uniswap-v3/pool";


const QUOTER_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";


export function makeMainnetQuoterContract() {
    return new ethers.Contract(QUOTER_ADDRESS, QuoterABI, mainnetProvider);
}


export class UniswapV3PoolQuoter {
    quoterContract: ethers.Contract;
    public pool: UniswapV3PoolProducer;

    constructor() {
        // :O
    }

    async initialize(poolAddress: string) {
        this.pool = await UniswapV3PoolProducer.create(poolAddress);

        this.quoterContract = makeMainnetQuoterContract();
    }

    static async create(poolAddress: string): Promise<UniswapV3PoolQuoter> {
        const o = new UniswapV3PoolQuoter();
        await o.initialize(poolAddress);
        return o;
    }


    getTokenA(): Token {
        return this.pool.tokenA;
    }


    getTokenB(): Token {
        return this.pool.tokenB;
    }


    determineTokenInAndOut(token: Token): Token[] {
        const tokenA = this.getTokenA();
        const tokenB = this.getTokenB();

        if (tokenA.address == token.address) {
            return [tokenA, tokenB];
        } else {
            return [tokenB, tokenA];
        }
    }

    async computeAmountOut(token: Token, amount: number): Promise<number> {
        const pool = this.pool;

        const [tokenIn, tokenOut] = this.determineTokenInAndOut(token);

        const amountIn = amount * 10 ** tokenIn.decimals;

        // call the quoter contract to determine the amount out of a swap, given an amount in
        const quotedAmountOut = await this.quoterContract.callStatic.quoteExactInputSingle(
            tokenIn.address,
            tokenOut.address,
            pool.fee,
            amountIn.toString(),
            0
        );

        // create an instance of the route object in order to construct a trade object
        const swapRoute = new Route([this.pool.makePool()], tokenIn, tokenOut);

        // create an unchecked trade instance
        const quote = await Trade.createUncheckedTrade({
            route: swapRoute,
            inputAmount: CurrencyAmount.fromRawAmount(token, amountIn.toString()),
            outputAmount: CurrencyAmount.fromRawAmount(
                tokenOut,
                quotedAmountOut.toString()
            ),
            tradeType: TradeType.EXACT_INPUT,
        });

        return Number(quote.outputAmount.toSignificant(12));
    }

}