import {
  getIsTransferCompletedSolana,
  hexToUint8Array,
  postVaaSolana,
} from "@certusone/wormhole-sdk";
import { redeemOnSolana } from "@certusone/wormhole-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { TextEncoder } from "util";
import { logger } from "../helpers";
import { ChainConfigInfo } from "../configureEnv";

export async function relaySolana(
  chainConfigInfo: ChainConfigInfo,
  signedVAAString: string
) {
  //TODO native transfer & create associated token account
  //TODO close connection
  const signedVaaArray = hexToUint8Array(signedVAAString);
  const signedVaaBuffer = Buffer.from(signedVaaArray);
  const connection = new Connection(chainConfigInfo.nodeUrl, "confirmed");
  logger.info(
    "relaySolana: private key: [" +
      chainConfigInfo.walletPrivateKey +
      "], bridgeAddress: [" +
      chainConfigInfo.bridgeAddress +
      "], signedVAAString: [" +
      signedVAAString +
      "]" +
      " signedVaaArray: %o",
    signedVaaArray + ", signedVaaBuffer: %o",
    signedVaaBuffer
  );

  logger.debug(
    "relaySolana: checking to see if vaa has already been redeemed."
  );
  var alreadyRedeemed = await getIsTransferCompletedSolana(
    chainConfigInfo.tokenBridgeAddress,
    signedVaaArray,
    connection
  );

  if (alreadyRedeemed) {
    logger.info("relaySolana: vaa has already been redeemed!");
    return { redeemed: true, result: "already redeemed" };
  }

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(chainConfigInfo.walletPrivateKey))
  );
  const payerAddress = keypair.publicKey.toString();

  logger.debug("relaySolana: posting the vaa.");
  await postVaaSolana(
    connection,
    async (transaction) => {
      transaction.partialSign(keypair);
      return transaction;
    },
    chainConfigInfo.bridgeAddress,
    payerAddress,
    signedVaaBuffer
  );

  logger.debug("relaySolana: redeeming.");
  const unsignedTransaction = await redeemOnSolana(
    connection,
    chainConfigInfo.bridgeAddress,
    chainConfigInfo.tokenBridgeAddress,
    payerAddress,
    signedVaaArray
  );

  logger.debug("relaySolana: sending.");
  unsignedTransaction.partialSign(keypair);
  const txid = await connection.sendRawTransaction(
    unsignedTransaction.serialize()
  );
  await connection.confirmTransaction(txid);

  logger.debug("relaySolana: checking to see if the transaction is complete.");
  var success = await getIsTransferCompletedSolana(
    chainConfigInfo.tokenBridgeAddress,
    signedVaaArray,
    connection
  );

  logger.info("relaySolana: success: " + success + ", txid: " + txid);
  return { redeemed: success, result: txid };
}
