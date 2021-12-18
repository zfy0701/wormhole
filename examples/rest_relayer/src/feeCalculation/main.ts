import { ChainId } from "@certusone/wormhole-sdk";
import { RelayerEnvironment, validateEnvironment } from "../configureEnv";

const env: RelayerEnvironment = validateEnvironment();

function getChainConfigInfo(chainId: any) {
  return env.supportedChains.find((x) => x.chainId.toString() === chainId);
}

function isAssetSupported(originChain: any, originAsset: string) {
  const supportedAssets = env.supportedAssets.find(
    (x) => x.chainId.toString() === originChain
  );
  if (!supportedAssets) {
    return false;
  }
  return (
    supportedAssets.supportAllAssets ||
    supportedAssets.supportedAssets.find((x) => x === originAsset)
  );
}

function validateRequest(request: any, response: any) {
  const { originChain, targetChain, originAsset } = request.params;

  if (!(originChain && targetChain && originAsset)) {
    response.status(400).json({ error: "Invalid request" });
  }

  const chainConfig = getChainConfigInfo(targetChain);
  if (!chainConfig) {
    response.status(400).json({ error: "Unsupported target chain." });
  }

  if (!isAssetSupported(originChain, originAsset)) {
    response.status(400).json({ error: "Unsupported token." });
  }

  return { originChain, targetChain, originAsset };
}

export function calculateFee(request, response) {
  const { originChain, targetChain, originAsset } = validateRequest(
    request,
    response
  );

  try {
    const fee = calculateFeeWithTolerance(
      originChain,
      originAsset,
      targetChain
    );
    response.status(200).json({ fee: fee });
  } catch (e) {
    console.log("Error while calculating fee");
    console.error(e);
    response.status(500).json({ error: "Unable to calculate the fee...." });
  }
}

export function calculateFeeWithTolerance(
  originChain: ChainId,
  originAsset: string,
  targetChain: ChainId
) {
  const SLIPPAGE_TOLERANCE = 1.2;
  const minimumViableFee = calculateMinimumViableFee(
    originChain,
    originAsset,
    targetChain
  );
  return (minimumViableFee * SLIPPAGE_TOLERANCE).toString();
}

export function calculateMinimumViableFee(
  originChain: ChainId,
  originAsset: string,
  targetChain: ChainId
) {
  const unitPriceUSD = getUnitPrice(originChain, originAsset);
  const feePriceUSD =
    getFeeDenomPrice(targetChain) *
    getTransactionFeeEstimate(originChain, originAsset, targetChain);

  return feePriceUSD / unitPriceUSD;
}

//This function returns the price in USD for 1 unit of the nativeAsset.
export function getUnitPrice(originChain, originAsset) {
  return 100;
}

//This function returns the price in USD for 1 unit of the fee denomination
export function getFeeDenomPrice(targetChain) {
  return 0;
}

//This function returns estimated transaction fees to perform the redeem in the fee denom of the targetChain.
export function getTransactionFeeEstimate(
  originChain,
  originAsset,
  targetChain
) {
  return 0;
}
