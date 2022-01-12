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

// import { storeKeyFromParsedVAA, storePayloadFromVaaBytes } from "./helpers";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { loadChainConfig } from "./configureEnv";
import { relay } from "./relay/main";
import { PromHelper } from "./promHelpers";

var redisHost: string;
var redisPort: number;
var metrics: PromHelper;

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

  if (!loadChainConfig()) return false;

  return true;
}

export async function run(ph: PromHelper) {
  metrics = ph;
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
      const redisClient = await helpers.connectToRedis();
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
            } else {
              metrics.incAlreadyExec();
              logger.debug(
                "dropping request [" + si_key + "] as already processed"
              );
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
    metrics.incSuccesses();
    logger.info(
      "[" + myWorkerIdx + "] processRequest() - relay returned: %o",
      relayResult
    );
    payload.status = relayResult;
  } catch (e) {
    metrics.incFailures();
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
