import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  postVaaSolanaWithRetry,
  redeemAndUnwrapOnSolana,
  redeemOnEth,
  redeemOnEthNative,
  redeemOnSolana,
  redeemOnTerra,
} from "@certusone/wormhole-sdk";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {Account, Connection, PublicKey, Transaction} from "@solana/web3.js";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import useTransferSignedVAA from "./useTransferSignedVAA";
import {
  selectTerraFeeDenom, selectTransferAmount, selectTransferFinalParsedTokenAccount,
  selectTransferIsRedeeming,
  selectTransferTargetChain,
} from "../store/selectors";
import {setIsRedeeming, setRedeemTx, setSwapTx} from "../store/transferSlice";
import {
  getTokenBridgeAddressForChain,
  MAX_VAA_UPLOAD_RETRIES_SOLANA,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { signSendAndConfirm } from "../utils/solana";
import { Alert } from "@material-ui/lab";
import { postWithFees } from "../utils/terra";
import {TOKEN_SWAP_PROGRAM_ID, TokenSwap} from "../components/TokenSwap";
import {readAccountWithLamports, readAccountWithLamports2} from "../components/TokenSwap/new-account-with-lamports";

import {Token, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {sendAndConfirmTransaction2} from "../components/TokenSwap/send-and-confirm-transaction";

import keypair from '../keys/keys.json'

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean,
  chainId: ChainId
) {
  dispatch(setIsRedeeming(true));
  try {
    const receipt = isNative
      ? await redeemOnEthNative(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        )
      : await redeemOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        );
    dispatch(
      setRedeemTx({ id: receipt.transactionHash, block: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function solanaSwap(
    dispatch: any,
    enqueueSnackbar: any,
    wallet: WalletContextState,
    targetAssets: string,
    amount: number
) {
  // dispatch(setIsRedeeming(true));
  try {
    if (!wallet.signTransaction) {
      throw new Error("wallet.signTransaction is undefined");
    }

    console.log("begin swap")

    // const targetAssets = useSelector(selectTransferTargetAsset)!
    // var amount = useSelector(selectTransferAmount)
    // if (isBigNumberish(amount)) {
    //   // @ts-ignore
    //   amount = (amount as BigNumber).toNumber()
    // }
    // @ts-ignore

    const connection = new Connection(SOLANA_HOST, "confirmed");

    // following is copy kan's code
    const swapPayer = await readAccountWithLamports2(connection, keypair.alice,0);
    console.log(swapPayer)

    const tokenSwapPk = new PublicKey('DqZpaUFTkYMCoer4Bqhr1NErkj958EcB2cynmKpRQcwh');
    const fetchedTokenSwap = await TokenSwap.loadTokenSwap(
        connection,
        tokenSwapPk,
        TOKEN_SWAP_PROGRAM_ID,
        swapPayer
    );
    const payer = await readAccountWithLamports2(connection, keypair.payer,0);
    const owner = await readAccountWithLamports2(connection, keypair.kan,0);

    // const swapper = await readAccountWithLamports(connection, '../keys/id.json',0);
    const swapperPk = new PublicKey(wallet.publicKey!);

    const tokenPool = new Token(connection, fetchedTokenSwap.poolToken, TOKEN_PROGRAM_ID, payer);

    const mintA = new Token(connection, fetchedTokenSwap.mintA, TOKEN_PROGRAM_ID, payer);
    const mintB = new Token(connection, fetchedTokenSwap.mintB, TOKEN_PROGRAM_ID, payer);

    if (mintB.publicKey.toString() !== targetAssets) {
      console.error("target asset " + targetAssets + " not match " + mintB.publicKey.toString())
    }

    console.log('Creating swap token a account');
    const userAccountA = await mintA.getOrCreateAssociatedAccountInfo(swapperPk);
    //await mintA.mintTo(userAccountA, owner, [], SWAP_AMOUNT_IN);
    const userTransferAuthority = new Account();

    console.log('send approve');

    await sendAndConfirmTransaction2(
        'Approve',
        connection,
        new Transaction().add(
            Token.createApproveInstruction(
                TOKEN_SWAP_PROGRAM_ID,
                userAccountA.address,
                userTransferAuthority.publicKey,
                swapperPk,
                [],
                amount,
            ),
        ),
        wallet
    );
    // await mintA.approve(
    //     userAccountA.address,
    //     userTransferAuthority.publicKey,
    //     swapperPk,
    //     [],
    //     amountNum,
    // );


    console.log('Creating swap token b account');
    // TODO this might not be right
    const userAccountB = await mintB.getOrCreateAssociatedAccountInfo(swapperPk);
    const poolAccount =  await tokenPool.createAccount(owner.publicKey);

    const tokenAccountA = fetchedTokenSwap.tokenAccountA;
    const tokenAccountB = fetchedTokenSwap.tokenAccountB;


    let info;
    info = await mintA.getAccountInfo(userAccountA.address);
    console.log('userAccount A remains:', info.amount.toNumber());

    info = await mintB.getAccountInfo(userAccountB.address);
    console.log('userAccount B remains:', info.amount.toNumber());

    info = await mintA.getAccountInfo(tokenAccountA);
    console.log('A token account remains:', info.amount.toNumber());

    info = await mintB.getAccountInfo(tokenAccountB);
    console.log('B token account remains:', info.amount.toNumber());

    console.log('Swapping');

    const txid = (await fetchedTokenSwap.swap(
        userAccountA.address,
        tokenAccountA,
        tokenAccountB,
        userAccountB.address,
        poolAccount,
        userTransferAuthority,
        amount,
        10,
    ));

    dispatch(setSwapTx({ id: txid, block: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    // dispatch(setIsRedeeming(false));
  }
}

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: WalletContextState,
  payerAddress: string, //TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  isNative: boolean,
  targetAssets: string,
  amount: number
) {
  dispatch(setIsRedeeming(true));
  try {
    if (!wallet.signTransaction) {
      throw new Error("wallet.signTransaction is undefined");
    }
    console.log("begin redeem")

    const connection = new Connection(SOLANA_HOST, "confirmed");
    await postVaaSolanaWithRetry(
      connection,
      wallet.signTransaction,
      SOL_BRIDGE_ADDRESS,
      payerAddress,
      Buffer.from(signedVAA),
      MAX_VAA_UPLOAD_RETRIES_SOLANA
    );

    console.log("postvaal")

    // TODO: how do we retry in between these steps
    const transaction = isNative
      ? await redeemAndUnwrapOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        )
      : await redeemOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        );
    console.log("send trans", transaction)

    const txid = await signSendAndConfirm(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    console.log("trans done")
    dispatch(setRedeemTx({ id: txid, block: 1 }));

    await solanaSwap(dispatch, enqueueSnackbar, wallet, targetAssets, amount)
    console.log("swap done")

    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  signedVAA: Uint8Array,
  feeDenom: string
) {
  dispatch(setIsRedeeming(true));
  try {
    const msg = await redeemOnTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS,
      wallet.terraAddress,
      signedVAA
    );
    const result = await postWithFees(
      wallet,
      [msg],
      "Wormhole - Complete Transfer",
      [feeDenom]
    );
    dispatch(
      setRedeemTx({ id: result.result.txhash, block: result.result.height })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

export function useHandleRedeem() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const targetChain = useSelector(selectTransferTargetChain);
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);

  const targetTokenAccount = useSelector(selectTransferFinalParsedTokenAccount)!
  // TODO
  const targetAssets = targetTokenAccount != null ? targetTokenAccount.mintKey : "52Y4nFRc8cH6YsKWwcYRj3HjApyU9EKGdwJGR9HdFXBJ"
  // @ts-ignore
  var amount = useSelector(selectTransferAmount) as number
  amount = amount * 100000000

  console.log("target assets: " + targetAssets + " amount " + amount)

  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain);
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
       solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        false,
           targetAssets,
           amount
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, terraFeeDenom);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain);
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        true,
          targetAssets,
          amount
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, terraFeeDenom); //TODO isNative = true
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
  ]);

  return useMemo(
    () => ({
      handleNativeClick: handleRedeemNativeClick,
      handleClick: handleRedeemClick,
      disabled: !!isRedeeming,
      showLoader: !!isRedeeming,
    }),
    [handleRedeemClick, isRedeeming, handleRedeemNativeClick]
  );
}
