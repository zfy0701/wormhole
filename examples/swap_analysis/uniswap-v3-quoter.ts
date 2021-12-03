#!/usr/bin/env node
import yargs from 'yargs';

import { UniswapV3PoolQuoter } from './src/uniswap-v3/quote'


async function main() {
  // parse args from user
  const argv = yargs(process.argv.slice(2))
    .usage('Usage: $0 -p [addr] -i [addr] --slippage [values]')
    .alias('p', 'pool')
    .describe('p', 'Pool address')
    .alias('i', 'token-in')
    .describe('i', 'Token address being swapped out')
    .alias('s', 'slippage')
    .describe('s', 'Slippage values (comma delimited)')
    .demandOption(['p', 'i'])
    .epilog('Enjoy.')
    .argv;


  // begin printing output
  const poolAddress = argv['p'];
  console.log('poolAddress=' + poolAddress);

  const quoter = await UniswapV3PoolQuoter.create(poolAddress);
  console.log('tokenA=' + quoter.getTokenA().address);
  console.log('tokenB=' + quoter.getTokenB().address);

  // add liquidity, sqrt price and tick
  const lpState = quoter.getLpState();

  console.log('liquidity=' + lpState.liquidity);
  console.log('sqrtPriceX96=' + lpState.sqrtPriceX96);
  console.log('tick=' + lpState.tick);

  // now use the tokenInAddress
  const tokenInAddress = argv['i'];
  //const tokenIn = quoter.getToken(tokenInAddress);
  console.log('tokenInAddress=' + tokenInAddress);

  const baseAmountIn = 0.0001;
  console.log('baseAmountIn=' + baseAmountIn.toFixed(8));

  const amountOut = await quoter.computeAmountOut(tokenInAddress, baseAmountIn);
  console.log('amountOut=' + amountOut.toFixed(8));

  const basePrice = baseAmountIn / amountOut;
  console.log('basePrice=' + basePrice.toFixed(8));

  // and slippages
  const slippagesArg = argv['s'];
  if (slippagesArg !== undefined) {
    const slippageAmounts = slippagesArg
      .split(',')
      .map((item) => {
        return Number(item);
      }
    );
    
    console.log('numSlippageTrials=' + slippageAmounts.length);
    for (const trialAmountIn of slippageAmounts) {
      console.log('slippageTrialAmountIn=' + trialAmountIn.toFixed(8));

      const trialAmountOut = await quoter.computeAmountOut(tokenInAddress, trialAmountIn);
      console.log('slippageTrialAmountOut=' + trialAmountOut.toFixed(8));

      const trialPrice = trialAmountIn / trialAmountOut;
      console.log('slippageTrialPrice=' + trialPrice.toFixed(8));

      const trialPct = 100 * (trialPrice / basePrice - 1);
      console.log('slippageTrialPercentage=' + trialPct.toFixed(2) + '%');
    }
  }
  return;
}

main();