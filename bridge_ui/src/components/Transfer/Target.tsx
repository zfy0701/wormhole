import {
    CHAIN_ID_SOLANA,
    CHAIN_ID_TERRA,
    hexToNativeString,
    isEVMChain, uint8ArrayToHex,
} from "@certusone/wormhole-sdk";
import { makeStyles, Typography } from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import useGetTargetParsedTokenAccounts from "../../hooks/useGetTargetParsedTokenAccounts";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import useSyncTargetAddress from "../../hooks/useSyncTargetAddress";
import { GasEstimateSummary } from "../../hooks/useTransactionFees";
import {
    selectTransferAmount, selectTransferFinalBalanceString, selectTransferFinalParsedTokenAccount,
    selectTransferIsTargetComplete,
    selectTransferShouldLockFields,
    selectTransferSourceChain,
    selectTransferTargetAddressHex,
    selectTransferTargetAsset,
    selectTransferTargetAssetWrapper,
    selectTransferTargetBalanceString,
    selectTransferTargetChain,
    selectTransferTargetError,
    selectTransferTargetParsedTokenAccount,
} from "../../store/selectors";
import { incrementStep, setTargetChain } from "../../store/transferSlice";
import { CHAINS, CHAINS_BY_ID } from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import ChainSelect from "../ChainSelect";
import KeyAndBalance from "../KeyAndBalance";
import LowBalanceWarning from "../LowBalanceWarning";
import SmartAddress from "../SmartAddress";
import SolanaCreateAssociatedAddress, {
  useAssociatedAccountExistsState,
} from "../SolanaCreateAssociatedAddress";
import SolanaTPSWarning from "../SolanaTPSWarning";
import StepDescription from "../StepDescription";
import RegisterNowButton from "./RegisterNowButton";
import {TokenSelector} from "../TokenSelectors/TargetTokenSelector";
import {arrayify, zeroPad} from "@ethersproject/bytes";
import {base58} from "ethers/lib.esm/utils";

const useStyles = makeStyles((theme) => ({
  transferField: {
    marginTop: theme.spacing(5),
  },
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

export const useTargetInfo = () => {
  const targetChain = useSelector(selectTransferTargetChain);
  var targetAddressHex = useSelector(selectTransferTargetAddressHex);
  var targetAsset = useSelector(selectTransferTargetAsset);
  var targetParsedTokenAccount = useSelector(
        selectTransferTargetParsedTokenAccount
    );
  const finalTokenAccount = useSelector(
        selectTransferFinalParsedTokenAccount
    );

  if (finalTokenAccount) {
      targetParsedTokenAccount = finalTokenAccount;
      targetAsset = finalTokenAccount.mintKey;
      targetAddressHex = uint8ArrayToHex(base58.decode(finalTokenAccount.publicKey))
  }
  // console.log("target address hex", targetAddressHex);

  const tokenName = targetParsedTokenAccount?.name;
  const symbol = targetParsedTokenAccount?.symbol;
  const logo = targetParsedTokenAccount?.logo;
  const readableTargetAddress =
    hexToNativeString(targetAddressHex, targetChain) || "";
  return useMemo(
    () => ({
      targetChain,
      targetAsset,
      tokenName,
      symbol,
      logo,
      readableTargetAddress,
    }),
    [targetChain, targetAsset, tokenName, symbol, logo, readableTargetAddress]
  );
};

function Target() {
  useGetTargetParsedTokenAccounts();
  const classes = useStyles();
  const dispatch = useDispatch();
  const sourceChain = useSelector(selectTransferSourceChain);
  const chains = useMemo(
    () => CHAINS.filter((c) => c.id !== sourceChain),
    [sourceChain]
  );
  const { error: targetAssetError, data } = useSelector(
    selectTransferTargetAssetWrapper
  );
  const {
    targetChain,
    targetAsset,
    tokenName,
    symbol,
    logo,
    readableTargetAddress,
  } = useTargetInfo();

  // console.log("target address", readableTargetAddress)
  const uiAmountString = useSelector(selectTransferFinalBalanceString);
  const transferAmount = useSelector(selectTransferAmount);
  const error = useSelector(selectTransferTargetError);
  const isTargetComplete = useSelector(selectTransferIsTargetComplete);
  const shouldLockFields = useSelector(selectTransferShouldLockFields);
  const { statusMessage } = useIsWalletReady(targetChain);
  const isLoading = !statusMessage && !targetAssetError && !data;
  const { associatedAccountExists, setAssociatedAccountExists } =
    useAssociatedAccountExistsState(
      targetChain,
      targetAsset,
      readableTargetAddress
    );
  useSyncTargetAddress(!shouldLockFields);
  const handleTargetChange = useCallback(
    (event) => {
      dispatch(setTargetChain(event.target.value));
    },
    [dispatch]
  );
  const handleNextClick = useCallback(() => {
    dispatch(incrementStep());
  }, [dispatch]);
  return (
    <>
      <StepDescription>Select a recipient chain and address.</StepDescription>
      <ChainSelect
        variant="outlined"
        select
        fullWidth
        value={targetChain}
        onChange={handleTargetChange}
        disabled={true}
        chains={chains}
      />
      <KeyAndBalance chainId={targetChain} />
      <div className={classes.transferField}>
        <TokenSelector disabled={shouldLockFields} />
      </div>

      {readableTargetAddress ? (
        <>
          {targetAsset ? (
            <div className={classes.transferField}>
              <Typography variant="subtitle2">Bridged tokens:</Typography>
              <Typography component="div">
                <SmartAddress
                  chainId={targetChain}
                  address={targetAsset}
                  symbol={symbol}
                  tokenName={tokenName}
                  logo={logo}
                  variant="h6"
                />
                {`(Amount: ${transferAmount}) (to be fixed)`}
              </Typography>
            </div>
          ) : null}
          <div className={classes.transferField}>
            <Typography variant="subtitle2">Sent to:</Typography>
            <Typography component="div">
              <SmartAddress
                chainId={targetChain}
                address={readableTargetAddress}
                variant="h6"
              />
              {`(Current balance: ${uiAmountString || "0"})`}
            </Typography>
          </div>
        </>
      ) : null}
      {targetChain === CHAIN_ID_SOLANA && targetAsset ? (
        <SolanaCreateAssociatedAddress
          mintAddress={targetAsset}
          readableTargetAddress={readableTargetAddress}
          associatedAccountExists={associatedAccountExists}
          setAssociatedAccountExists={setAssociatedAccountExists}
        />
      ) : null}
      <Alert severity="info" variant="outlined" className={classes.alert}>
        <Typography>
          You will have to pay transaction fees on{" "}
          {CHAINS_BY_ID[targetChain].name} to redeem your tokens.
        </Typography>
        {(isEVMChain(targetChain) || targetChain === CHAIN_ID_TERRA) && (
          <GasEstimateSummary methodType="transfer" chainId={targetChain} />
        )}
      </Alert>
      <LowBalanceWarning chainId={targetChain} />
      {targetChain === CHAIN_ID_SOLANA && <SolanaTPSWarning />}
      <ButtonWithLoader
        disabled={!isTargetComplete || !associatedAccountExists}
        onClick={handleNextClick}
        showLoader={isLoading}
        error={
          statusMessage || (isLoading ? undefined : error || targetAssetError)
        }
      >
        Next
      </ButtonWithLoader>
      {!statusMessage && data && !data.doesExist ? <RegisterNowButton /> : null}
    </>
  );
}

export default Target;
