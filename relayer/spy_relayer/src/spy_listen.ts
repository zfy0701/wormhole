import { logger } from "./helpers";
import { storeInRedis } from "./spy_worker";
import { createClient } from "redis";

import { relay } from "./relay/main";

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToUint8Array,
  uint8ArrayToHex,
  parseTransferPayload,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
} from "@certusone/wormhole-sdk";

import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { env } from "./configureEnv";
import * as helpers from "./helpers";
import { workerData } from "worker_threads";

var targetChains = new Set();
var vaaUriPrelude: string;

export function init(runListen: boolean): boolean {
  if (!runListen) return true;

  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    return false;
  }

  for (var idx = 0; idx < env.supportedChains.length; ++idx) {
    logger.debug(
      "will relay vaas to chainId " + env.supportedChains[idx].chainId
    );
    targetChains.add(env.supportedChains[idx].chainId);
  }

  vaaUriPrelude =
    "http://localhost:" +
    (process.env.REST_PORT ? process.env.REST_PORT : "4200") +
    "/relayvaa/";

  return true;
}

export async function run() {
  logger.info(
    "spy_relay starting up, will listen for signed VAAs from [" +
      process.env.SPY_SERVICE_HOST +
      "]"
  );

  // Connect to redis globally
  // var myRedisClient;
  // async () => {
  //   myRedisClient = await connectToRedis();
  // };

  (async () => {
    var filter = {};
    if (process.env.SPY_SERVICE_FILTERS) {
      const parsedJsonFilters = eval(process.env.SPY_SERVICE_FILTERS);

      var myFilters = [];
      for (var i = 0; i < parsedJsonFilters.length; i++) {
        var myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
        var myEmitterAddress = await encodeEmitterAddress(
          myChainId,
          parsedJsonFilters[i].emitter_address
        );
        var myEmitterFilter = {
          emitterFilter: {
            chainId: myChainId,
            emitterAddress: myEmitterAddress,
          },
        };
        logger.info(
          "adding filter: chainId: [" +
            myEmitterFilter.emitterFilter.chainId +
            "], emitterAddress: [" +
            myEmitterFilter.emitterFilter.emitterAddress +
            "]"
        );
        myFilters.push(myEmitterFilter);
      }

      logger.info("setting " + myFilters.length + " filters");
      filter = {
        filters: myFilters,
      };
    } else {
      logger.info("processing all signed VAAs");
    }

    const client = createSpyRPCServiceClient(process.env.SPY_SERVICE_HOST);
    const stream = await subscribeSignedVAA(client, filter);

    stream.on("data", ({ vaaBytes }) => {
      processVaa(vaaBytes);
    });

    logger.info("spy_relay waiting for transfer signed VAAs");
  })();
}

async function encodeEmitterAddress(
  myChainId,
  emitterAddressStr
): Promise<string> {
  if (myChainId === CHAIN_ID_SOLANA) {
    return await getEmitterAddressSolana(emitterAddressStr);
  }

  if (myChainId === CHAIN_ID_TERRA) {
    return await getEmitterAddressTerra(emitterAddressStr);
  }

  return getEmitterAddressEth(emitterAddressStr);
}

async function processVaa(vaaBytes) {
  logger.debug("processVaa: vaaBytes: %o", vaaBytes);
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));
  logger.debug("processVaa: parsedVAA: %o", parsedVAA);

  if (parsedVAA.payload[0] === 1) {
    var transferPayload = parseTransferPayload(Buffer.from(parsedVAA.payload));
    const vaaUri =
      vaaUriPrelude + encodeURIComponent(vaaBytes.toString("base64"));
    if (targetChains.has(transferPayload.targetChain)) {
      logger.info(
        "forwarding vaa to relayer: emitter: [" +
          parsedVAA.emitter_chain +
          ":" +
          uint8ArrayToHex(parsedVAA.emitter_address) +
          "], seqNum: " +
          parsedVAA.sequence +
          ", payload: origin: [" +
          transferPayload.originChain +
          ":" +
          transferPayload.originAddress +
          "], target: [" +
          transferPayload.targetChain +
          ":" +
          transferPayload.targetAddress +
          "],  amount: " +
          transferPayload.amount +
          ", [" +
          vaaUri +
          "]"
      );

      var storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
      var storePayload = helpers.storePayloadFromVaaBytes(vaaBytes);

      logger.debug(
        "storing: key: [" +
          storeKey.chain_id +
          "/" +
          storeKey.emitter_address +
          "/" +
          storeKey.sequence +
          "], payload: [" +
          helpers.storePayloadToJson(storePayload) +
          "]"
      );

      await storeInRedis(
        helpers.storeKeyToJson(storeKey),
        helpers.storePayloadToJson(storePayload)
      );

      // logger.info(
      //   "relaying vaa from chain id %d to chain id " +
      //     parsedVAA.emitter_chain +
      //     " to " +
      //     transferPayload.targetChain
      // );
      // try {
      //   // result is an object that could be jsonified and stored as the status in the completed store. The REST query could return that.
      //   var result = await relay(storePayload.vaa_bytes);
      //   logger.info("relay returned: %o", result);
      // } catch (e) {
      //   logger.error("failed to relay transfer vaa: %o", e);
      // }
    } else {
      logger.info(
        "ignoring vaa with unsupported target chain: emitter: [" +
          parsedVAA.emitter_chain +
          ":" +
          uint8ArrayToHex(parsedVAA.emitter_address) +
          "], seqNum: " +
          parsedVAA.sequence +
          ", payload: origin: [" +
          transferPayload.originChain +
          ":" +
          transferPayload.originAddress +
          "], target: [" +
          transferPayload.targetChain +
          ":" +
          transferPayload.targetAddress +
          "],  amount: " +
          transferPayload.amount +
          ", [" +
          vaaUri +
          "]"
      );
    }
  } else {
    logger.debug(
      "dropping vaa, payload type parsedVAA.payload[0]: %o",
      parsedVAA
    );
  }
}
