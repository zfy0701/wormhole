import { FeeAmount, Pool } from "@uniswap/v3-sdk";
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import { Route, Trade } from "@uniswap/v3-sdk";

import { Immutables, State, makeMainnetPoolContract, getPoolImmutables, getPoolState, makeToken } from "./src/uniswap-v3/pool"
import { makeMainnetQuoterContract } from "./src/uniswap-v3/quote"
import { ethers } from "ethers";


class UniswapV3PoolProducer {
  poolContract: ethers.Contract;
  immutables: Immutables;
  state: State;
  public tokenA: Token;
  public tokenB: Token;
  public fee: FeeAmount;
  

  constructor() {
    // :D
  }


  async initialize(poolAddress: string) {
    this.poolContract = makeMainnetPoolContract(poolAddress);

    const poolContract = this.poolContract;
    this.immutables = await getPoolImmutables(poolContract);
    this.state = await getPoolState(poolContract);

    this.tokenA = await makeToken(this.immutables.token0);
    this.tokenB = await makeToken(this.immutables.token1);
    this.fee = this.immutables.fee;
  }


  makePool(): Pool {
    return new Pool(
      this.tokenA,
      this.tokenB,
      this.fee,
      this.state.sqrtPriceX96.toString(), //note the description discrepancy - sqrtPriceX96 and sqrtRatioX96 are interchangable values
      this.state.liquidity.toString(),
      this.state.tick
    );
  }


  static async create(poolAddress: string): Promise<UniswapV3PoolProducer> {
    const o = new UniswapV3PoolProducer();
    await o.initialize(poolAddress);
    return o;
  }

}


class UniswapV3PoolQuoter {
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

/*
  // create an instance of the pool object for the given pool
  const poolExample = new Pool(
    tokenA,
    tokenB,
    immutables.fee,
    state.sqrtPriceX96.toString(), //note the description discrepancy - sqrtPriceX96 and sqrtRatioX96 are interchangable values
    state.liquidity.toString(),
    state.tick
  );

*/
async function main() {
  // USDC-WETH pool address on mainnet for fee tier 0.05%
  const poolAddress = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640";

  // ETH/whSOL
  //const poolAddress = "0x127452f3f9cdc0389b0bf59ce6131aa3bd763598";

  // USDC swap
  //const poolAddress = "0x537a0a5654045c52ec45c4c86ed0c1ffe893809d";


  const quoter = await UniswapV3PoolQuoter.create(poolAddress);

  //const hoho = await pool.calculatePriceAndQtyOut(pool.getTokenA(), 2500);

  const tokenIn = quoter.getTokenB();
  const tokenOut = quoter.getTokenA();

  const amountOut = await quoter.computeAmountOut(tokenOut, 20000.0);
  //console.log(tokenOut.address, tokenOut.symbol, tokenOut.name, 'amountOut', amountOut);
  console.log(tokenIn.address, tokenIn.symbol, tokenIn.name, 'amountOut', amountOut);

  return;
}

main();