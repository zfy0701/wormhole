import {
  getIsTransferCompletedTerra,
  hexToUint8Array,
} from "@certusone/wormhole-sdk";
import { redeemOnTerra, transferFromTerra } from "@certusone/wormhole-sdk";
import { LCDClient, MnemonicKey, Msg, Wallet } from "@terra-money/terra.js";
import { logger } from "../helpers";
import { ChainConfigInfo } from "../configureEnv";

export async function relayTerra(
  chainConfigInfo: ChainConfigInfo,
  signedVAA: string
) {
  const signedVaaArray = hexToUint8Array(signedVAA);
  const lcdConfig = {
    URL: chainConfigInfo.nodeUrl,
    chainID: chainConfigInfo.terraChainId,
    name: chainConfigInfo.terraName,
  };
  const lcd = new LCDClient(lcdConfig);
  const mk = new MnemonicKey({
    mnemonic: chainConfigInfo.walletPrivateKey,
  });
  const wallet = lcd.wallet(mk);

  logger.info(
    "relayTerra: terraChainId: [" +
      chainConfigInfo.terraChainId +
      "], private key: [" +
      chainConfigInfo.walletPrivateKey +
      "], tokenBridgeAddress: [" +
      chainConfigInfo.tokenBridgeAddress +
      "], accAddress: [" +
      wallet.key.accAddress +
      "], signedVAA: [" +
      signedVAA +
      "]"
  );

  logger.debug("relayTerra: checking to see if vaa has already been redeemed.");
  var alreadyRedeemed = await getIsTransferCompletedTerra(
    chainConfigInfo.tokenBridgeAddress,
    signedVaaArray,
    wallet.key.accAddress,
    lcd,
    chainConfigInfo.terraGasPriceUrl
  );

  if (alreadyRedeemed) {
    logger.info("relayTerra: vaa has already been redeemed!");
    return { redeemed: true, result: "already redeemed" };
  }

  const msg = await redeemOnTerra(
    chainConfigInfo.tokenBridgeAddress,
    wallet.key.accAddress,
    signedVaaArray
  );

  logger.debug("relayTerra: getting gas prices");
  //Alternate FCD methodology
  //let gasPrices = await axios.get("http://localhost:3060/v1/txs/gas_prices").then((result) => result.data);
  const gasPrices = await lcd.config.gasPrices;

  logger.debug("relayTerra: estimating fees");
  //const walletSequence = await wallet.sequence();
  const feeEstimate = await lcd.tx.estimateFee(wallet.key.accAddress, [msg], {
    //TODO figure out type mismatch
    feeDenoms: [chainConfigInfo.terraCoin],
    gasPrices,
  });

  logger.debug("relayTerra: createAndSign");
  const tx = await wallet.createAndSignTx({
    msgs: [msg],
    memo: "Relayer - Complete Transfer",
    feeDenoms: [chainConfigInfo.terraCoin],
    gasPrices,
    fee: feeEstimate,
  });

  logger.debug("relayTerra: broadcasting");
  const receipt = await lcd.tx.broadcast(tx);

  logger.debug("relayTerra: checking to see if the transaction is complete.");
  var success = await getIsTransferCompletedTerra(
    chainConfigInfo.tokenBridgeAddress,
    signedVaaArray,
    wallet.key.accAddress,
    lcd,
    chainConfigInfo.terraGasPriceUrl
  );

  logger.info("relayTerra: success: " + success + ", receipt: %o", receipt);
  return { redeemed: success, result: receipt };
}
