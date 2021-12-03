# Swap Analysis

## Initial setup

```bash
npm i
```

## uniswap-v3-quoter.js

A script that computes the price slippage in percentage terms for any Uniswap V3 AMM.

### Example Usage

```bash
./uniswap-v3-quoter.js -p 0x127452f3f9cdc0389b0bf59ce6131aa3bd763598 -i 0xD31a59c85aE9D8edEFeC411D448f90841571b89c -s 100,1000
```
This is testing the ETH/SOL pool (0x127452f3f9cdc0389b0bf59ce6131aa3bd763598), swapping SOL (0xD31a59c85aE9D8edEFeC411D448f90841571b89c) for ETH with trial quantities 100 SOL and 1000 SOL. Calculations are generated to stdout.

```
poolAddress=0x127452f3f9cdc0389b0bf59ce6131aa3bd763598
tokenA=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
tokenB=0xD31a59c85aE9D8edEFeC411D448f90841571b89c
liquidity=247799510583643776
sqrtPriceX96=11071481456415083138075666
tick=-177524
tokenInAddress=0xD31a59c85aE9D8edEFeC411D448f90841571b89c
baseAmountIn=0.00010000
amountOut=0.00000511
basePrice=19.58651410
numSlippageTrials=2
slippageTrialAmountIn=100.00000000
slippageTrialAmountOut=5.09089614
slippageTrialPrice=19.64290711
slippageTrialPercentage=0.29%
slippageTrialAmountIn=1000.00000000
slippageTrialAmountOut=49.62669632
slippageTrialPrice=20.15044470
slippageTrialPercentage=2.88%
```

### Arguments

* **-p** is required. Uniswap V3 Pool Address.
* **-i** is required. This is the inbound token used (swapping out of) in AMM.
* **-s** is optional. Quantities of inbound token used to test price slippage.