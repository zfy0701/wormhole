import {
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToUint8Array,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import {
  Bridge__factory,
  NFTBridge__factory,
} from "@certusone/wormhole-sdk/lib/esm/ethers-contracts";
import {
  importNftWasm,
  importTokenWasm,
} from "@certusone/wormhole-sdk/lib/esm/solana/wasm";
import {
  Button,
  Checkbox,
  CircularProgress,
  Container,
  makeStyles,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { fromUint8Array } from "js-base64";
import { useCallback, useState } from "react";
import ChainSelect from "../components/ChainSelect";
import KeyAndBalance from "../components/KeyAndBalance";
import LogWatcher from "../components/LogWatcher";
import ShowTx from "../components/ShowTx";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useLogger } from "../contexts/Logger";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import useIsWalletReady from "../hooks/useIsWalletReady";
import {
  CHAINS,
  CHAINS_WITH_NFT_SUPPORT,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOLANA_SYSTEM_PROGRAM_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import { signSendAndConfirm } from "../utils/solana";
import { postWithFees, waitForTerraExecution } from "../utils/terra";

const useStyles = makeStyles(() => ({
  rootContainer: {},
  mainPaper: {
    textAlign: "center",
    "& > *": {
      margin: "1rem",
    },
    padding: "2rem",
  },
  divider: {
    margin: "2rem",
  },
  spacer: {
    height: "1rem",
  },
}));

function RegisterChain() {
  const classes = useStyles();
  const [vaa, setVaa] = useState("");
  const [targetChain, setTargetChain] = useState(CHAIN_ID_ETH);
  const isWalletReady = useIsWalletReady(targetChain, true);
  const [useNft, setUseNft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const logger = useLogger();
  const { signer } = useEthereumProvider();
  const solanaWallet = useSolanaWallet();
  const terraWallet = useConnectedWallet();

  const submitVaa = useCallback(async () => {
    setError("");
    setIsLoading(true);
    setTransactionId("");

    if (!isWalletReady.isReady) {
      setIsLoading(false);
      setError("Wallet not connected.");
      return;
    }

    try {
      if (!useNft) {
        if (isEVMChain(targetChain)) {
          const bridge = Bridge__factory.connect(
            getTokenBridgeAddressForChain(targetChain),
            signer as any
          );
          const v = await bridge.registerChain(hexToUint8Array(vaa));
          const receipt = await v.wait();
          setIsLoading(false);
          setTransactionId(receipt.transactionHash);
        } else if (targetChain === CHAIN_ID_SOLANA) {
          const connection = new Connection(SOLANA_HOST, "confirmed");
          const { register_chain_ix } = await importTokenWasm();
          const transaction = new Transaction().add(
            await register_chain_ix(
              SOLANA_SYSTEM_PROGRAM_ADDRESS,
              SOL_TOKEN_BRIDGE_ADDRESS,
              solanaWallet.publicKey?.toString() || "",
              hexToUint8Array(vaa)
            )
          );
          const { blockhash } = await connection.getRecentBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new PublicKey(
            solanaWallet.publicKey?.toString() || ""
          );
          const receipt = await signSendAndConfirm(
            solanaWallet,
            connection,
            transaction
          );
          setIsLoading(false);
          setTransactionId(receipt);
        } else if (targetChain === CHAIN_ID_TERRA) {
          if (!terraWallet || !isWalletReady.walletAddress) {
            setIsLoading(false);
            setError("Wallet not connected.");
            return;
          }
          const ix = new MsgExecuteContract(
            isWalletReady.walletAddress || "",
            getTokenBridgeAddressForChain(targetChain),
            {
              submit_vaa: {
                data: fromUint8Array(hexToUint8Array(vaa)),
              },
            }
          );
          const receipt = await postWithFees(
            terraWallet,
            [ix],
            "Register Chain"
          );
          const info = await waitForTerraExecution(receipt);
          setIsLoading(false);
          setTransactionId(info.txhash);
        }
      } else {
        //NFT Codepath
        if (isEVMChain(targetChain)) {
          const bridge = NFTBridge__factory.connect(
            getTokenBridgeAddressForChain(targetChain),
            signer as any
          );
          const v = await bridge.registerChain(hexToUint8Array(vaa));
          const receipt = await v.wait();
          setIsLoading(false);
          setTransactionId(receipt.transactionHash);
        } else if (targetChain === CHAIN_ID_SOLANA) {
          const connection = new Connection(SOLANA_HOST, "confirmed");
          const { register_chain_ix } = await importNftWasm();
          const transaction = new Transaction().add(
            await register_chain_ix(
              SOLANA_SYSTEM_PROGRAM_ADDRESS,
              SOL_TOKEN_BRIDGE_ADDRESS,
              solanaWallet.publicKey?.toString() || "",
              hexToUint8Array(vaa)
            )
          );
          const { blockhash } = await connection.getRecentBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new PublicKey(
            solanaWallet.publicKey?.toString() || ""
          );
          const receipt = await signSendAndConfirm(
            solanaWallet,
            connection,
            transaction
          );
          setIsLoading(false);
          setTransactionId(receipt);
        }
      }
    } catch (e: any) {
      logger.log("Exception occurred.", "error");
      console.error(e);
      setError(e.message || "Unknown error");
      setIsLoading(false);
    }

    setIsLoading(false);
  }, [
    isWalletReady,
    logger,
    signer,
    solanaWallet,
    targetChain,
    terraWallet,
    useNft,
    vaa,
  ]);

  const toggleNft = useCallback(() => {
    setUseNft((state) => !state);
  }, []);

  const handleVaaChange = useCallback(
    (event) => setVaa(event.target.value),
    []
  );

  const handleTargetChainChange = useCallback((event) => {
    setTargetChain(event?.target.value);
  }, []);

  return (
    <>
      <Container maxWidth="sm" className={classes.rootContainer}>
        <Paper className={classes.mainPaper}>
          <Typography variant="h6">
            This page allows you to call register chain on any contract.
          </Typography>
          <ChainSelect
            select
            variant="outlined"
            label="Source Chain"
            disabled={false}
            value={targetChain}
            onChange={handleTargetChainChange}
            fullWidth
            margin="normal"
            chains={useNft ? CHAINS_WITH_NFT_SUPPORT : CHAINS}
          />
          <KeyAndBalance chainId={targetChain} />
          <TextField
            value={vaa}
            onChange={handleVaaChange}
            label={"Signed VAA in Hex"}
            fullWidth
            style={{ display: "block" }}
          />
          <div>
            <Checkbox
              checked={useNft}
              onChange={toggleNft}
              inputProps={{ "aria-label": "primary checkbox" }}
            />
            <Typography style={{ display: "inline-block" }} variant="h6">
              NFT Bridge (instead of token)
            </Typography>
          </div>
          <div>
            <Button
              disabled={!vaa}
              onClick={submitVaa}
              color="secondary"
              variant="contained"
            >
              Submit
            </Button>
          </div>
          {isLoading && <CircularProgress />}
          {error && <Typography color="error">{error}</Typography>}
          {transactionId && (
            <>
              <Typography>{"Successfully submitted the VAA"}</Typography>
              <ShowTx
                chainId={targetChain}
                tx={{ id: transactionId, block: 1 }}
              />
            </>
          )}
        </Paper>
        <LogWatcher />
      </Container>
    </>
  );
}

export default RegisterChain;
