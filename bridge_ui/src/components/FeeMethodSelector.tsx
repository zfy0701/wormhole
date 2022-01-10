import { CHAIN_ID_TERRA, isEVMChain } from "@certusone/wormhole-sdk";
import { Card, Checkbox, Typography } from "@material-ui/core";
import { LocalGasStation } from "@material-ui/icons";
import { useDispatch, useSelector } from "react-redux";
import useRelayerInfo, { isRelayable } from "../hooks/useRelayerInfo";
import {
  useEthereumGasPrice,
  GasEstimateSummary,
} from "../hooks/useTransactionFees";
import SmartAddress from "../components/SmartAddress";
import {
  selectTransferOriginAsset,
  selectTransferOriginChain,
  selectTransferTargetChain,
  selectTransferUseRelayer,
  selectTransferSourceParsedTokenAccount,
  selectTransferSourceChain,
} from "../store/selectors";
import { setUseRelayer, setRelayerFee } from "../store/transferSlice";
import { getDefaultNativeCurrencySymbol } from "../utils/consts";
import { useCallback, useEffect } from "react";

function FeeMethodSelector() {
  const originAsset = useSelector(selectTransferOriginAsset);
  const originChain = useSelector(selectTransferOriginChain);
  const targetChain = useSelector(selectTransferTargetChain);
  const estimate = useEthereumGasPrice("transfer", targetChain);
  const relayerInfo = useRelayerInfo(originChain, originAsset, targetChain);
  const dispatch = useDispatch();
  const relayerSelected = !!useSelector(selectTransferUseRelayer);
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
  const sourceSymbol = sourceParsedTokenAccount?.symbol;
  const sourceChain = useSelector(selectTransferSourceChain);

  const chooseRelayer = useCallback(() => {
    dispatch(setUseRelayer(true));
    dispatch(setRelayerFee(relayerInfo.data?.feeFormatted));
  }, [relayerInfo, dispatch]);

  const chooseManual = useCallback(() => {
    dispatch(setUseRelayer(false));
    dispatch(setRelayerFee(undefined));
  }, [dispatch]);

  console.log("relayer info", relayerInfo);
  const relayerEligible =
    relayerInfo.data &&
    relayerInfo.data.isRelayable &&
    relayerInfo.data.feeFormatted &&
    relayerInfo.data.feeUsd;

  useEffect(() => {
    if (relayerInfo.data?.isRelayable === true) {
      chooseRelayer();
    }
  }, [relayerInfo, chooseRelayer]);

  const relayerContent = (
    <Card>
      <Checkbox
        checked={relayerSelected}
        disabled={!relayerEligible}
        onClick={chooseRelayer}
      />
      {relayerEligible ? (
        <>
          <Typography>{"Automatic Payment"}</Typography>
          <Typography>
            {"Pay with additional " +
              (sourceSymbol
                ? sourceSymbol + ""
                : "the token you're transferring.")}{" "}
          </Typography>
        </>
      ) : (
        <Typography>
          {"Automatic redeem is unavailable for this token."}
        </Typography>
      )}
      {/* TODO fixed number of decimals on these strings */}
      {relayerEligible ? (
        <div>
          <Typography>{relayerInfo.data?.feeFormatted}</Typography>
          <SmartAddress
            chainId={sourceChain}
            parsedTokenAccount={sourceParsedTokenAccount}
          />
          <Typography>{`($ ${relayerInfo.data?.feeUsd})`}</Typography>
        </div>
      ) : null}
    </Card>
  );

  const manualRedeemContent = (
    <Card>
      <Checkbox
        checked={!relayerSelected}
        disabled={!relayerEligible}
        onClick={chooseManual}
      />
      <Typography>{"Manual Payment"}</Typography>
      <Typography>
        {"Pay with your own " + getDefaultNativeCurrencySymbol(targetChain)}
      </Typography>
      {(isEVMChain(targetChain) || targetChain === CHAIN_ID_TERRA) && (
        <GasEstimateSummary methodType="transfer" chainId={targetChain} />
      )}
    </Card>
  );

  return (
    <div>
      <Typography>How would you like to pay the target chain fees?</Typography>
      {relayerContent}
      {manualRedeemContent}
    </div>
  );
}

export default FeeMethodSelector;
