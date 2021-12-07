import { ethers } from 'ethers';
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { abi as IUniswapV2PairABI } from '@uniswap/v2-core/build/UniswapV2Pair.json';

import { makeErc20Contract } from '../erc20';


export function makePoolContract(provider: ethers.providers.JsonRpcProvider, poolAddress: string): ethers.Contract {
    return new ethers.Contract(poolAddress, IUniswapV2PairABI, provider);
}


// TODO: create UniswapToken object
export async function makeEvmToken(provider: ethers.providers.JsonRpcProvider, chainId: number, tokenAddress: string): Promise<Token> {
  const erc20 = await makeErc20Contract(provider, tokenAddress);

  const decimals = await erc20.decimals();
  const symbol = await erc20.symbol();
  const name = await erc20.name();

  return new Token(chainId, tokenAddress, decimals, symbol, name);
}


export interface Immutables {
  token0: string;
  token1: string;
}


export interface State {
  reserve0: string;
  reserve1: string;
}


export async function getPoolImmutables(poolContract: ethers.Contract) {
  const [token0, token1] =
    await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
    ]);

  const immutables: Immutables = {
    token0,
    token1,
  };
  return immutables;
}


export async function getPoolState(poolContract: ethers.Contract) {
  // note that data here can be desynced if the call executes over the span of two or more blocks.
  const reserves = await poolContract.getReserves();

  const PoolState: State = {
    reserve0: reserves._reserve0.toString(),
    reserve1: reserves._reserve1.toString(),
  };

  return PoolState;
}


export class UniswapV2PairProducer {
  provider: ethers.providers.JsonRpcProvider;
  chainId: number;
  poolContract: ethers.Contract;
  immutables: Immutables;
  state: State;
  public tokenA: Token;
  public tokenB: Token;

  constructor() {
    // :D
  }

  async initialize(provider: ethers.providers.JsonRpcProvider, chainId: number, poolAddress: string) {
    this.provider = provider;
    this.chainId = chainId;

    this.poolContract = makePoolContract(provider, poolAddress);

    const poolContract = this.poolContract;
    this.immutables = await getPoolImmutables(poolContract);
    this.state = await getPoolState(poolContract);

    this.tokenA = await makeEvmToken(this.provider, this.chainId, this.immutables.token0);
    this.tokenB = await makeEvmToken(this.provider, this.chainId, this.immutables.token1);
  }

  makePair(): Pair {
    return new Pair(
      CurrencyAmount.fromRawAmount(this.tokenA, this.state.reserve0),
      CurrencyAmount.fromRawAmount(this.tokenB, this.state.reserve1)
  );
  }

  getLpState(): State {
    return this.state;
  }

  static async create(provider: ethers.providers.JsonRpcProvider, chainId: number, poolAddress: string): Promise<UniswapV2PairProducer> {
    const o = new UniswapV2PairProducer();
    await o.initialize(provider, chainId, poolAddress);
    return o;
  }

}