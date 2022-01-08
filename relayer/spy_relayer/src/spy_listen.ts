import { logger } from "./helpers";
import { connectToRedis } from "./spy_worker";
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

import * as helpers from "./helpers";
import { workerData } from "worker_threads";

export function init(runListen: boolean): boolean {
  if (!runListen) return true;

  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    return false;
  }

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

    // var transferPayload = parseTransferPayload(Buffer.from(parsedVAA.payload));
    // logger.info(
    //   "transfer: emitter: [" +
    //     parsedVAA.emitter_chain +
    //     ":" +
    //     uint8ArrayToHex(parsedVAA.emitter_address) +
    //     "], seqNum: " +
    //     parsedVAA.sequence +
    //     ", payload: origin: [" +
    //     transferPayload.originChain +
    //     ":" +
    //     transferPayload.originAddress +
    //     "], target: [" +
    //     transferPayload.targetChain +
    //     ":" +
    //     transferPayload.targetAddress +
    //     "],  amount: " +
    //     transferPayload.amount
    // );

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
    logger.debug(
      "dropping vaa, payload type parsedVAA.payload[0]: %o",
      parsedVAA
    );
  }
}

async function storeInRedis(name: string, value: string) {
  if (!name) {
    logger.error("storeInRedis: invalid name");
    return;
  }
  if (!value) {
    logger.error("storeInRedis: invalid value");
    return;
  }

  logger.debug("storeInRedis: connecting to redis.");
  const redisClient = await connectToRedis();
  if (!redisClient) {
    logger.error("Failed to connect to redis!");
    return;
  }
  if (!redisClient) {
    logger.error("storeInRedis: invalid redisClient");
    return;
  }

  logger.debug("storeInRedis: storing in redis.");
  await redisClient.select(helpers.INCOMING);
  await redisClient.set(name, value);

  await redisClient.quit();
  logger.debug("storeInRedis: finished storing in redis.");
}
