#!/usr/bin/env node
import yargs from 'yargs';

import { CHAIN_ID, mainnetProvider } from "./src/bschain/misc";
import { UniswapV2PairQuoter } from "./src/ethereum/uniswap-v2/quote";


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
    console.log('protocol=PancakeSwap');

    //const poolAddress = '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16';
    const poolAddress = argv['p'];
    console.log('poolAddress=' + poolAddress);

    const quoter = await UniswapV2PairQuoter.create(mainnetProvider, CHAIN_ID, poolAddress);
    console.log('tokenA=' + quoter.getTokenA().address);
    console.log('tokenB=' + quoter.getTokenB().address);
    
    const lpState = quoter.getLpState();

    console.log('reserveA=' + lpState.reserve0);
    console.log('reserveB=' + lpState.reserve1);

     // now use the tokenInAddress
    const tokenInAddress = argv['i'];
    console.log('tokenInAddress=' + tokenInAddress);

    const baseAmountIn = '1';
    console.log('baseAmountIn=' + baseAmountIn.toString());
    
    const baseResult = await quoter.computeAmountOut(tokenInAddress, baseAmountIn);
    console.log('amountOut=' + baseResult.qty);
    console.log('basePrice=' + baseResult.price);
    
    // and slippages
    const slippagesArg = argv['s'];
    if (slippagesArg !== undefined) {
      const slippageAmounts = slippagesArg.split(',');
      
      console.log('numSlippageTrials=' + slippageAmounts.length);
      for (const trialAmountIn of slippageAmounts) {
        console.log('slippageTrialAmountIn=' + trialAmountIn);
  
        const trialResult = await quoter.computeAmountOut(tokenInAddress, trialAmountIn);
        console.log('slippageTrialAmountOut=' + trialResult.qty);
        console.log('slippageTrialPrice=' + trialResult.price);
  
        const trialPct = 100 * (trialResult.price / baseResult.price - 1);
        console.log('slippageTrialPercentage=' + trialPct.toFixed(2) + '%');
      }
    }
    return;
}

main();