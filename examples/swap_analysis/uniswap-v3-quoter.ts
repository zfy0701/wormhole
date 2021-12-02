import { UniswapV3PoolQuoter } from "./src/uniswap-v3/quote"


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