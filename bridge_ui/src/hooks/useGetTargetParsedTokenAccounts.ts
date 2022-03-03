import {
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  TokenImplementation__factory, WSOL_ADDRESS, WSOL_DECIMALS,
} from "@certusone/wormhole-sdk";
import {AccountInfo, Connection, ParsedAccountData, PublicKey} from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  selectTransferTargetAsset,
  selectTransferTargetChain,
} from "../store/selectors";
import {ParsedTokenAccount, setTargetParsedTokenAccount, setTargetParsedTokenAccounts} from "../store/transferSlice";
import { getEvmChainId, SOLANA_HOST, TERRA_HOST } from "../utils/consts";
import { createParsedTokenAccount } from "./useGetSourceParsedTokenAccounts";
import useMetadata from "./useMetadata";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {getMultipleAccountsRPC} from "../utils/solana";

function useGetTargetParsedTokenAccounts() {
  const dispatch = useDispatch();
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const targetAssetArrayed = useMemo(
    () => (targetAsset ? [targetAsset] : []),
    [targetAsset]
  );
  const metadata = useMetadata(targetChain, targetAssetArrayed);
  const tokenName =
    (targetAsset && metadata.data?.get(targetAsset)?.tokenName) || undefined;
  const symbol =
    (targetAsset && metadata.data?.get(targetAsset)?.symbol) || undefined;
  const logo =
    (targetAsset && metadata.data?.get(targetAsset)?.logo) || undefined;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const terraWallet = useConnectedWallet();
  const {
    provider,
    signerAddress,
    chainId: evmChainId,
  } = useEthereumProvider();
  const hasCorrectEvmNetwork = evmChainId === getEvmChainId(targetChain);
  const hasResolvedMetadata = metadata.data || metadata.error;
  useEffect(() => {
    // targetParsedTokenAccount is cleared on setTargetAsset, but we need to clear it on wallet changes too
    dispatch(setTargetParsedTokenAccount(undefined));
    if (!targetAsset || !hasResolvedMetadata) {
      return;
    }
    let cancelled = false;

    if (targetChain === CHAIN_ID_TERRA && terraWallet) {
      const lcd = new LCDClient(TERRA_HOST);
      lcd.wasm
        .contractQuery(targetAsset, {
          token_info: {},
        })
        .then((info: any) =>
          lcd.wasm
            .contractQuery(targetAsset, {
              balance: {
                address: terraWallet.walletAddress,
              },
            })
            .then((balance: any) => {
              if (balance && info) {
                dispatch(
                  setTargetParsedTokenAccount(
                    createParsedTokenAccount(
                      "",
                      "",
                      balance.balance.toString(),
                      info.decimals,
                      Number(formatUnits(balance.balance, info.decimals)),
                      formatUnits(balance.balance, info.decimals),
                      symbol,
                      tokenName,
                      logo
                    )
                  )
                );
              }
            })
        );
    }
    if (targetChain === CHAIN_ID_SOLANA && solPK) {
      let mint;
      try {
        mint = new PublicKey(targetAsset);
      } catch (e) {
        return;
      }
      const connection = new Connection(SOLANA_HOST, "confirmed");

       createNativeSolParsedTokenAccount(
          connection,
          solPK.toString()
      ).then( (native) => {
         connection
             .getParsedTokenAccountsByOwner(solPK, { programId: TOKEN_PROGRAM_ID, })
             .then(({ value }) => {
               let tokenAccounts: ParsedTokenAccount[] = value.map((item) =>
                   createParsedTokenAccountFromInfo(item.pubkey, item.account)
               );
               if (native) {
                 tokenAccounts.unshift(native)
               }
               dispatch(setTargetParsedTokenAccounts(tokenAccounts));
             });
           }
       );



      connection
        .getParsedTokenAccountsByOwner(solPK, { mint })
        .then(({ value }) => {
          if (!cancelled) {
            if (value.length) {
              dispatch(
                setTargetParsedTokenAccount(
                  createParsedTokenAccount(
                    value[0].pubkey.toString(),
                    value[0].account.data.parsed?.info?.mint,
                    value[0].account.data.parsed?.info?.tokenAmount?.amount,
                    value[0].account.data.parsed?.info?.tokenAmount?.decimals,
                    value[0].account.data.parsed?.info?.tokenAmount?.uiAmount,
                    value[0].account.data.parsed?.info?.tokenAmount
                      ?.uiAmountString,
                    symbol,
                    tokenName,
                    logo
                  )
                )
              );
            } else {
              // TODO: error state
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            // TODO: error state
          }
        });
    }
    if (
      isEVMChain(targetChain) &&
      provider &&
      signerAddress &&
      hasCorrectEvmNetwork
    ) {
      const token = TokenImplementation__factory.connect(targetAsset, provider);
      token
        .decimals()
        .then((decimals) => {
          token.balanceOf(signerAddress).then((n) => {
            if (!cancelled) {
              dispatch(
                setTargetParsedTokenAccount(
                  // TODO: verify accuracy
                  createParsedTokenAccount(
                    signerAddress,
                    token.address,
                    n.toString(),
                    decimals,
                    Number(formatUnits(n, decimals)),
                    formatUnits(n, decimals),
                    symbol,
                    tokenName,
                    logo
                  )
                )
              );
            }
          });
        })
        .catch(() => {
          if (!cancelled) {
            // TODO: error state
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    targetAsset,
    targetChain,
    provider,
    signerAddress,
    solanaWallet,
    solPK,
    terraWallet,
    hasCorrectEvmNetwork,
    hasResolvedMetadata,
    symbol,
    tokenName,
    logo,
  ]);
}

const createParsedTokenAccountFromInfo = (
    pubkey: PublicKey,
    item: AccountInfo<ParsedAccountData>
): ParsedTokenAccount => {
  return {
    publicKey: pubkey?.toString(),
    mintKey: item.data.parsed?.info?.mint?.toString(),
    amount: item.data.parsed?.info?.tokenAmount?.amount,
    decimals: item.data.parsed?.info?.tokenAmount?.decimals,
    uiAmount: item.data.parsed?.info?.tokenAmount?.uiAmount,
    uiAmountString: item.data.parsed?.info?.tokenAmount?.uiAmountString,
  };
};
const createNativeSolParsedTokenAccount = async (
    connection: Connection,
    walletAddress: string
) => {
  // const walletAddress = "H69q3Q8E74xm7swmMQpsJLVp2Q9JuBwBbxraAMX5Drzm" // known solana mainnet wallet with tokens
  const fetchAccounts = await getMultipleAccountsRPC(connection, [
    new PublicKey(walletAddress),
  ]);
  if (!fetchAccounts || !fetchAccounts.length || !fetchAccounts[0]) {
    return null;
  } else {
    return createParsedTokenAccount(
        walletAddress, //publicKey
        WSOL_ADDRESS, //Mint key
        fetchAccounts[0].lamports.toString(), //amount
        WSOL_DECIMALS, //decimals, 9
        parseFloat(formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS)),
        formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS).toString(),
        "SOL",
        "Solana",
        undefined, //TODO logo. It's in the solana token map, so we could potentially use that URL.
        true
    );
  }
};

export default useGetTargetParsedTokenAccounts;
