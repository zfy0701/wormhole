# Swap Analysis

## Initial setup

### Javascript side of things
```bash
npm i
npm run build
```
### Python side of things
If you do not currently have a python environment set up, we recommend using pyenv to manage virtual environments.
```bash
curl https://pyenv.run | bash
```
Add the following to the end of your **.bashrc** file.
```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"

eval "$(pyenv init --path)"
eval "$(pyenv virtualenv-init -)"
```
Source your bashrc and install your global and local Python virtual environments. We currently use 3.9.9. **Run everything in the swap_analysis directory.**
```bash
. ~/.bashrc
pyenv install 3.9.9
pyenv global 3.9.9
pyenv virtualenv swap-analysis
pyenv local swap-analysis
```
You should see your terminal output prepend **(swap-analysis)**. When you navigate away from this directory, you will automatically leave this virtual environment.

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