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
    "relaying to evm, private key: [" + chainConfigInfo.walletPrivateKey + "]"
  );
  const signer = new ethers.Wallet(chainConfigInfo.walletPrivateKey, provider);
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

  logger.debug("redeemed on evm: receipt: %o", receipt);

  var success = await getIsTransferCompletedEth(
    chainConfigInfo.tokenBridgeAddress,
    provider,
    signedVaaArray
  );

  provider.destroy();

  logger.info(
    "redeemed on evm: success: " + success + ", receipt: %o",
    receipt
  );
  return { redeemed: success, result: receipt };
}
