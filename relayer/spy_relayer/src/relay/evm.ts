import {
  getIsTransferCompletedEth,
  hexToUint8Array,
  redeemOnEth,
  redeemOnEthNative,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { ChainConfigInfo } from "../configureEnv";

import { logger } from "../helpers";

export async function relayEVM(
  chainConfigInfo: ChainConfigInfo,
  signedVAA: string,
  unwrapNative: boolean
) {
  const signedVaaArray = hexToUint8Array(signedVAA);
  const provider = new ethers.providers.WebSocketProvider(
    chainConfigInfo.nodeUrl
  );
  logger.info(
    "relayEVM(" +
      chainConfigInfo.chainName +
      "): " +
      (unwrapNative ? ", will unwrap" : "") +
      ", private key: [" +
      chainConfigInfo.walletPrivateKey +
      "]"
  );

  logger.debug(
    "relayEVM(" +
      chainConfigInfo.chainName +
      "): checking to see if vaa has already been redeemed."
  );
  var alreadyRedeemed = await getIsTransferCompletedEth(
    chainConfigInfo.tokenBridgeAddress,
    provider,
    signedVaaArray
  );

  if (alreadyRedeemed) {
    logger.info(
      "relayEVM(" +
        chainConfigInfo.chainName +
        "): vaa has already been redeemed!"
    );
    return { redeemed: true, result: "already redeemed" };
  }

  const signer = new ethers.Wallet(chainConfigInfo.walletPrivateKey, provider);

  logger.debug("relayEVM(" + chainConfigInfo.chainName + "): redeeming.");
  const receipt = unwrapNative
    ? await redeemOnEthNative(
        chainConfigInfo.tokenBridgeAddress,
        signer,
        signedVaaArray
      )
    : await redeemOnEth(
        chainConfigInfo.tokenBridgeAddress,
        signer,
        signedVaaArray
      );

  logger.debug(
    "relayEVM(" +
      chainConfigInfo.chainName +
      "): checking to see if the transaction is complete."
  );

  var success = await getIsTransferCompletedEth(
    chainConfigInfo.tokenBridgeAddress,
    provider,
    signedVaaArray
  );

  provider.destroy();

  logger.info(
    "relayEVM(" +
      chainConfigInfo.chainName +
      "): success: " +
      success +
      ", receipt: %o",
    receipt
  );
  return { redeemed: success, result: receipt };
}
