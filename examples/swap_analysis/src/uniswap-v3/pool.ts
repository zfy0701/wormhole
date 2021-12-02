import { ethers } from "ethers";
import { Pool } from "@uniswap/v3-sdk";
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { Route, Trade } from "@uniswap/v3-sdk";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";


import { makeErc20Contract } from "../erc20";
import { mainnetProvider } from "../metamask"


const ETHEREUM_CHAIN_ID = 3;


export function makePoolContract(provider: ethers.providers.JsonRpcProvider, poolAddress: string): ethers.Contract {
    return new ethers.Contract(poolAddress, IUniswapV3PoolABI, provider);
}


export function makeMainnetPoolContract(poolAddress: string): ethers.Contract {
    return makePoolContract(mainnetProvider, poolAddress);
}


// TODO: create UniswapToken object
export async function makeToken(tokenAddress: string): Promise<Token> {
  const erc20 = await makeErc20Contract(mainnetProvider, tokenAddress);
  
  const decimals = await erc20.decimals();
  const symbol = await erc20.symbol();
  const name = await erc20.name();

  return new Token(ETHEREUM_CHAIN_ID, tokenAddress, decimals, symbol, name);
}


export interface Immutables {
  factory: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: ethers.BigNumber;
}


export interface State {
  liquidity: ethers.BigNumber;
  sqrtPriceX96: ethers.BigNumber;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}


export async function getPoolImmutables(poolContract: ethers.Contract) {
  const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
    await Promise.all([
      poolContract.factory(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.tickSpacing(),
      poolContract.maxLiquidityPerTick(),
    ]);

  const immutables: Immutables = {
    factory,
    token0,
    token1,
    fee,
    tickSpacing,
    maxLiquidityPerTick,
  };
  return immutables;
}


export async function getPoolState(poolContract: ethers.Contract) {
  // note that data here can be desynced if the call executes over the span of two or more blocks.
  const [liquidity, slot] = await Promise.all([
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  const PoolState: State = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
  };

  return PoolState;
}
