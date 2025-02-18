//import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import { TextField, Typography } from "@material-ui/core";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import useGetSourceParsedTokens from "../../hooks/useGetSourceParsedTokenAccounts";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  setSourceParsedTokenAccount as setNFTSourceParsedTokenAccount,
  setSourceWalletAddress as setNFTSourceWalletAddress,
} from "../../store/nftSlice";
import {
  selectNFTSourceChain,
  selectNFTSourceParsedTokenAccount, selectTransferFinalParsedTokenAccount,
  selectTransferTargetChain,
  selectTransferTargetParsedTokenAccount, selectTransferTargetParsedTokenAccounts,
} from "../../store/selectors";
import {
  ParsedTokenAccount,
  setFinalParsedTokenAccount as setTransferTargetParsedTokenAccount,
  setTargetAddressHex as setTransferTargetWalletAddress

} from "../../store/transferSlice";
import EvmTokenPicker from "./EvmTokenPicker";
import RefreshButtonWrapper from "./RefreshButtonWrapper";
import SolanaTokenPicker from "./SolanaTokenPicker";
import TerraTokenPicker from "./TerraTokenPicker";
import keys from "../../keys/keys.json";

type TokenSelectorProps = {
  disabled: boolean;
  nft?: boolean;
};

export const TokenSelector = (props: TokenSelectorProps) => {
  const { disabled, nft } = props;
  const dispatch = useDispatch();

  const lookupChain = useSelector(
    nft ? selectNFTSourceChain : selectTransferTargetChain
  );
  const targetParsedTokenAccount = useSelector(
    nft
      ? selectNFTSourceParsedTokenAccount
      : selectTransferFinalParsedTokenAccount
  );

  const walletIsReady = useIsWalletReady(lookupChain);

  const setTargetParsedTokenAccount = nft
    ? setNFTSourceParsedTokenAccount
    : setTransferTargetParsedTokenAccount;
  const setTargetWalletAddress = nft
    ? setNFTSourceWalletAddress
    : setTransferTargetWalletAddress;

  const handleOnChange = useCallback(
    (newTokenAccount: ParsedTokenAccount | null) => {
      if (!newTokenAccount) {
        // dispatch(setTargetParsedTokenAccount(undefined));
        // dispatch(setTargetWalletAddress(undefined));
      } else if (newTokenAccount !== undefined && walletIsReady.walletAddress) {
        dispatch(setTargetParsedTokenAccount(newTokenAccount));
        // dispatch(setTargetWalletAddress(walletIsReady.walletAddress));
      }
    },
    [
      dispatch,
      walletIsReady,
      setTargetParsedTokenAccount,
      setTargetWalletAddress,
    ]
  );

  // const maps = useGetSourceParsedTokens(nft);
  const tokenAccounts = useSelector(selectTransferTargetParsedTokenAccounts)
  const maps = {
    resetAccounts: undefined,
    tokenAccounts: tokenAccounts,
    mintAccounts: {
      data: {},
      isFetching: false,
      receivedAt: null
    }
  }

  const resetAccountWrapper = maps?.resetAccounts || (() => {}); //This should never happen.

  //This is only for errors so bad that we shouldn't even mount the component
  const fatalError =
    isEVMChain(lookupChain) &&
    lookupChain !== CHAIN_ID_TERRA &&
    maps?.tokenAccounts?.error; //Terra & ETH can proceed because it has advanced mode

  console.log("Beginning looing")
  console.log(lookupChain)
  console.log(targetParsedTokenAccount)
  console.log(targetParsedTokenAccount?.publicKey)

  // console.log(maps)
  // console.log(maps?.tokenAccounts)
  // console.log(maps?.mintAccounts)

  const content = fatalError ? (
    <RefreshButtonWrapper callback={resetAccountWrapper}>
      <Typography>{fatalError}</Typography>
    </RefreshButtonWrapper>
  ) : lookupChain === CHAIN_ID_SOLANA ? (
    <SolanaTokenPicker
      value={targetParsedTokenAccount || null}
      onChange={handleOnChange}
      disabled={disabled}
      accounts={maps?.tokenAccounts}
      // @ts-ignore
      mintAccounts={undefined}
      resetAccounts={maps?.resetAccounts}
      nft={nft}
    />
  ) : isEVMChain(lookupChain) ? (
    <EvmTokenPicker
      value={targetParsedTokenAccount || null}
      disabled={disabled}
      onChange={handleOnChange}
      tokenAccounts={maps?.tokenAccounts}
      resetAccounts={maps?.resetAccounts}
      chainId={lookupChain}
      nft={nft}
    />
  ) : lookupChain === CHAIN_ID_TERRA ? (
    <TerraTokenPicker
      value={targetParsedTokenAccount || null}
      disabled={disabled}
      onChange={handleOnChange}
      resetAccounts={maps?.resetAccounts}
      tokenAccounts={maps?.tokenAccounts}
    />
  ) : (
    <TextField
      variant="outlined"
      placeholder="Asset"
      fullWidth
      value={"Not Implemented"}
      disabled={true}
    />
  );

  return <div>{content}</div>;
};
