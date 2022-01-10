import {
  ChainId,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
} from "@certusone/wormhole-sdk";
import { hexToNativeString } from "@certusone/wormhole-sdk/lib/esm/utils";
import axios from "axios";
import { getAddress } from "ethers/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { DataWrapper } from "../store/helpers";
import {
  selectTransferGasPrice,
  selectTransferSourceParsedTokenAccount,
} from "../store/selectors";
import {
  getCoinGeckoURL,
  RELAYER_COMPARE_ASSET,
  RELAYER_SUPPORTED_ASSETS,
} from "../utils/consts";

export function isRelayable(originChain: ChainId, originAsset: string) {
  return !!RELAYER_SUPPORTED_ASSETS.find(
    (x) =>
      originAsset.toLowerCase() === x.address.toLowerCase() &&
      originChain === x.chain
  );
}

const AVERAGE_ETH_REDEEM_GAS = 100000; //TODO not a great estimate, coordinate this with useTransactionFees hook
const ETH_SAFETY_TOLERANCE = 1.1;

export type RelayerInfo = {
  isRelayable: boolean;
  feeUsd?: string;
  feeFormatted?: string;
};

function calculateFeeUsd(
  comparisonAssetPrice: number,
  targetChain: ChainId,
  gasPrice?: number
) {
  let feeUsd = 0;

  if (targetChain === CHAIN_ID_SOLANA) {
    feeUsd = 1;
  } else if (targetChain === CHAIN_ID_ETH) {
    if (!gasPrice) {
      feeUsd = 0; //catch this error elsewhere
    } else {
      feeUsd =
        ((AVERAGE_ETH_REDEEM_GAS * gasPrice) / 1000000000) *
        comparisonAssetPrice *
        ETH_SAFETY_TOLERANCE;
    }
  } else if (targetChain === CHAIN_ID_TERRA) {
    feeUsd = 5;
  } else if (targetChain === CHAIN_ID_BSC) {
    feeUsd = 5;
  } else if (targetChain === CHAIN_ID_POLYGON) {
    feeUsd = 0.5;
  } else if (targetChain === CHAIN_ID_AVAX) {
    feeUsd = 1;
  } else if (targetChain === CHAIN_ID_OASIS) {
    feeUsd = 1;
  }

  return feeUsd;
}

function requireGasPrice(targetChain: ChainId) {
  return targetChain === CHAIN_ID_ETH;
}

function calculateFeeFormatted(
  feeUsd: number,
  originAssetPrice: number,
  sourceAssetDecimals: number
) {
  return (feeUsd / originAssetPrice).toFixed(sourceAssetDecimals);
}

//This potentially returns the same chain as the foreign chain, in the case where the asset is native
function useRelayerInfo(
  originChain?: ChainId,
  originAsset?: string,
  targetChain?: ChainId
): DataWrapper<RelayerInfo> {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonAssetPrice, setComparisonAssetPrice] = useState<
    number | null
  >(null);
  const [originAssetPrice, setOriginAssetPrice] = useState<number | null>(null);
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
  const sourceAssetDecimals = sourceParsedTokenAccount?.decimals;
  const gasPrice = useSelector(selectTransferGasPrice);

  //TODO actually calc this value
  const relayersAvailable = true;
  const originAssetNative =
    originAsset && originChain
      ? hexToNativeString(originAsset, originChain)
      : null;

  useEffect(() => {
    if (!(originAssetNative && originChain && targetChain)) {
      return;
    }

    const relayerAsset = RELAYER_SUPPORTED_ASSETS.find(
      (x) =>
        originAssetNative.toLowerCase() === x.address.toLowerCase() &&
        originChain === x.chain
    );

    if (!relayerAsset) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError("");

    const promises = [];
    const comparisonAsset = RELAYER_COMPARE_ASSET[targetChain];
    promises.push(
      axios
        .get(getCoinGeckoURL(relayerAsset.coinGeckoId))
        .then((result) => {
          if (!cancelled) {
            const value = result.data[relayerAsset.coinGeckoId][
              "usd"
            ] as number;
            if (!value) {
              setError("Unable to fetch required asset price");
              return;
            }
            setOriginAssetPrice(value);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setError("Unable to fetch required asset price.");
          }
        })
    );

    promises.push(
      axios
        .get(getCoinGeckoURL(comparisonAsset))
        .then((result) => {
          if (!cancelled) {
            const value = result.data[comparisonAsset]["usd"] as number;
            if (!value) {
              setError("Unable to fetch required asset price");
              return;
            }
            setComparisonAssetPrice(value);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setError("Unable to fetch required asset price.");
          }
        })
    );

    Promise.all(promises).then(() => {
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [originAssetNative, originChain, targetChain]);

  const output: DataWrapper<RelayerInfo> = useMemo(() => {
    const relayable =
      originChain && originAssetNative
        ? isRelayable(originChain, originAssetNative)
        : null;
    return {
      error: error,
      isFetching: isLoading,
      receivedAt: null,
      data:
        error || relayable === false
          ? { isRelayable: false }
          : isLoading ||
            !comparisonAssetPrice ||
            !originAssetPrice ||
            !relayersAvailable ||
            !targetChain ||
            sourceAssetDecimals === undefined ||
            (requireGasPrice(targetChain) && !gasPrice)
          ? null
          : {
              isRelayable: !!relayable,
              feeUsd: calculateFeeUsd(
                comparisonAssetPrice,
                targetChain,
                gasPrice
              ).toFixed(2),
              feeFormatted: calculateFeeFormatted(
                calculateFeeUsd(comparisonAssetPrice, targetChain, gasPrice),
                originAssetPrice,
                sourceAssetDecimals
              ),
            },
    };
  }, [
    isLoading,
    originAsset,
    originChain,
    targetChain,
    error,
    comparisonAssetPrice,
    originAssetPrice,
    gasPrice,
  ]);

  return output;
}

export default useRelayerInfo;
