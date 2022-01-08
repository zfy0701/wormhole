// import {
//   createSpyRPCServiceClient,
//   subscribeSignedVAA,
// } from "@certusone/wormhole-spydk";

// import {
//   ChainId,
//   CHAIN_ID_SOLANA,
//   CHAIN_ID_TERRA,
//   hexToUint8Array,
//   uint8ArrayToHex,
//   parseTransferPayload,
//   getEmitterAddressEth,
//   getEmitterAddressSolana,
//   getEmitterAddressTerra,
// } from "@certusone/wormhole-sdk";

import {
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { createClient } from "redis";

// import { storeKeyFromParsedVAA, storePayloadFromVaaBytes } from "./helpers";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { relay } from "./relay/main";

var redisHost: string;
var redisPort: number;

export function init(runWorker: boolean): boolean {
  if (!runWorker) return true;

  if (!process.env.REDIS_HOST) {
    logger.error("Missing environment variable REDIS_HOST");
    return false;
  }

  if (!process.env.REDIS_PORT) {
    logger.error("Missing environment variable REDIS_PORT");
    return false;
  }

  redisHost = process.env.REDIS_HOST;
  redisPort = parseInt(process.env.REDIS_PORT);

  return true;
}

export async function run() {
  var numWorkers = 1;
  if (process.env.SPY_NUM_WORKERS) {
    numWorkers = parseInt(process.env.SPY_NUM_WORKERS);
    logger.info("will use " + numWorkers + " workers");
  }

  setDefaultWasm("node");

  for (var workerIdx = 0; workerIdx < numWorkers; ++workerIdx) {
    logger.info("starting worker " + workerIdx);
    (async () => {
      let myWorkerIdx = workerIdx;
      const redisClient = await connectToRedis();
      if (!redisClient) {
        logger.error("[" + myWorkerIdx + "] Failed to connect to redis!");
        return;
      }

      while (true) {
        await redisClient.select(helpers.INCOMING);
        for await (const si_key of redisClient.scanIterator()) {
          const si_value = await redisClient.get(si_key);
          if (si_value) {
            logger.debug(
              "[" + myWorkerIdx + "] SI: " + si_key + " =>" + si_value
            );
            // Get result from evaluation algorithm
            // If true, then do the transfer
            const shouldDo = evaluate(si_value);
            if (shouldDo) {
              // Move this entry to from incoming store to working store
              await redisClient.select(helpers.INCOMING);
              if ((await redisClient.del(si_key)) === 0) {
                logger.info(
                  "[" +
                    myWorkerIdx +
                    "] The key [" +
                    si_key +
                    "] no longer exists in INCOMING"
                );
                return;
              }
              await redisClient.select(helpers.WORKING);
              // If this VAA is already in the working store, then no need to add it again.
              // This handles the case of duplicate VAAs from multiple guardians
              const checkVal = await redisClient.get(si_key);
              if (!checkVal) {
                var oldPayload = helpers.storePayloadFromJson(si_value);
                var newPayload: helpers.StoreWorkingPayload;
                newPayload = helpers.initWorkingPayload();
                newPayload.vaa_bytes = oldPayload.vaa_bytes;
                await redisClient.set(
                  si_key,
                  helpers.workingPayloadToJson(newPayload)
                );
                // Process the request
                await processRequest(myWorkerIdx, redisClient, si_key);
              }
            }
          } else {
            logger.error("[" + myWorkerIdx + "] No si_keyval returned!");
          }
        }
        // add sleep
        await helpers.sleep(3000);
      }

      logger.info("[" + myWorkerIdx + "] worker %d exiting");
      await redisClient.quit();
    })();
    // Stagger the threads so they don't all wake up at once
    await helpers.sleep(500);
  }
}

function evaluate(blob: string) {
  // logger.debug("Checking [" + blob + "]");
  // if (blob.startsWith("01000000000100e", 14)) {
  // if (Math.floor(Math.random() * 5) == 1) {
  // logger.debug("Evaluated true...");
  return true;
  // }
  // logger.info("Evaluated false...");
  // return false;
}

async function processRequest(myWorkerIdx: number, rClient, key: string) {
  logger.debug("[" + myWorkerIdx + "] Processing request [" + key + "]...");
  // Get the entry from the working store
  await rClient.select(helpers.WORKING);
  var value: string = await rClient.get(key);
  if (!value) {
    logger.error(
      "[" + myWorkerIdx + "] processRequest could not find key [" + key + "]"
    );
    return;
  }
  var storeKey = helpers.storeKeyFromJson(key);
  var payload: helpers.StoreWorkingPayload =
    helpers.workingPayloadFromJson(value);
  if (payload.status !== "Pending") {
    logger.info(
      "[" + myWorkerIdx + "] This key [" + key + "] has already been processed."
    );
    return;
  }
  // Actually do the processing here and update status and time field
  try {
    logger.info(
      "[" +
        myWorkerIdx +
        "] processRequest() - Calling with vaa_bytes [" +
        payload.vaa_bytes +
        "]"
    );
    var relayResult = await relay(payload.vaa_bytes);
    logger.info(
      "[" + myWorkerIdx + "] processRequest() - relay returned: %o",
      relayResult
    );
    payload.status = relayResult;
  } catch (e) {
    logger.error(
      "[" +
        myWorkerIdx +
        "] processRequest() - failed to relay transfer vaa: %o",
      e
    );
    payload.status = "Failed: " + e;
  }
  // Put result back into store
  payload.timestamp = new Date().toString();
  value = helpers.workingPayloadToJson(payload);
  await rClient.set(key, value);
}

export async function connectToRedis() {
  var rClient = createClient({
    socket: {
      host: redisHost,
      port: redisPort,
    },
  });

  rClient.on("connect", function (err) {
    if (err) {
      logger.error("Redis writer client failed to connect: %o", err);
    } else {
      logger.debug("Redis writer client Connected");
    }
  });

  await rClient.connect();
  return rClient;
}
