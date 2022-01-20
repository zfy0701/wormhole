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

import { hexToUint8Array, parseTransferPayload } from "@certusone/wormhole-sdk";
import { env } from "process";
import { RedisClientType } from "redis";
import { PromHelper } from "../helpers/promHelpers";
import { getLogger } from "../helpers/logHelper";
import { getRelayerEnvironment, RelayerEnvironment } from "../configureEnv";
import {
  connectToRedis,
  RedisTables,
  RelayResult,
  Status,
  StorePayload,
  storePayloadFromJson,
  storePayloadToJson,
  WorkerInfo,
} from "../helpers/redisHelper";
import { sleep } from "../helpers/utils";
import { relay } from "./relay";

let metrics: PromHelper;

const logger = getLogger();
let relayerEnv: RelayerEnvironment;

export function init(runWorker: boolean): boolean {
  if (!runWorker) return true;

  try {
    relayerEnv = getRelayerEnvironment();
  } catch (e) {
    logger.error(
      "Encountered error while initiating the relayer environment: " + e
    );
    return false;
  }

  return true;
}

export async function run(ph: PromHelper) {
  metrics = ph;
  let workerArray: WorkerInfo[] = new Array();
  let index = 0;
  relayerEnv.supportedChains.forEach((chain) => {
    chain.walletPrivateKey?.forEach((key) => {
      workerArray.push({
        walletPrivateKey: key,
        index: index,
        targetChainId: chain.chainId,
      });
      index++;
    });
    chain.solanaPrivateKey?.forEach((key) => {
      workerArray.push({
        walletPrivateKey: key,
        index: index,
        targetChainId: chain.chainId,
      });
      index++;
    });
  });

  //TODO confirm this is handled elsewhere and remove.
  //setDefaultWasm("node");

  if (relayerEnv.clearRedisOnInit) {
    logger.info("Clearing REDIS as per tunable...");
    const redisClient = await connectToRedis();
    if (!redisClient) {
      logger.error("Failed to connect to redis to clear tables.");
      return;
    }
    await redisClient.FLUSHALL();
    redisClient.quit();
  } else {
    logger.info("NOT clearing REDIS.");
  }

  logger.info("will use " + workerArray.length + " workers");
  let numWorkers = workerArray.length;
  for (let workerIdx = 0; workerIdx < numWorkers; ++workerIdx) {
    logger.info("starting worker " + workerIdx);
    (async () => {
      let myWorkerIdx = workerArray[workerIdx].index;
      let myTgtChainId = workerArray[workerIdx].targetChainId;
      let myPrivateKey = workerArray[workerIdx].walletPrivateKey;
      const redisClient = await connectToRedis();
      logger.info(
        "Spinning up worker[" +
          myWorkerIdx +
          "] to handle targetChainId " +
          myTgtChainId
      );
      if (!redisClient) {
        logger.error("[" + myWorkerIdx + "] Failed to connect to redis!");
        return;
      }

      while (true) {
        await redisClient.select(RedisTables.INCOMING);
        for await (const si_key of redisClient.scanIterator()) {
          const si_value = await redisClient.get(si_key);
          if (si_value) {
            // logger.debug(
            //   "[" +
            //     myWorkerIdx +
            //     ", " +
            //     myTgtChainId +
            //     "] SI: " +
            //     si_key +
            //     " =>" +
            //     si_value
            // );

            let storePayload: StorePayload = storePayloadFromJson(si_value);
            // Check to see if this worker should handle this VAA
            if (myTgtChainId !== 0) {
              const { parse_vaa } = await importCoreWasm();
              const parsedVAA = parse_vaa(
                hexToUint8Array(storePayload.vaa_bytes)
              );
              const payloadBuffer: Buffer = Buffer.from(parsedVAA.payload);
              const transferPayload = parseTransferPayload(payloadBuffer);
              const tgtChainId = transferPayload.targetChain;
              if (tgtChainId !== myTgtChainId) {
                logger.debug(
                  "Skipping mismatched chainId.  Received: " +
                    tgtChainId +
                    ", want: " +
                    myTgtChainId
                );
                continue;
              }
            }

            // Check to see if this is a retry and if it is time to retry
            if (storePayload.retries > 0) {
              const BACKOFF_TIME = 10000; // 10 seconds in milliseconds
              const MAX_BACKOFF_TIME = 86400000; // 24 hours in milliseconds
              // calculate retry time
              const now: Date = new Date();
              const old: Date = new Date(storePayload.timestamp);
              const timeDelta: number = now.getTime() - old.getTime(); // delta is in mS
              const waitTime: number = Math.min(
                BACKOFF_TIME ** storePayload.retries,
                MAX_BACKOFF_TIME
              );
              logger.debug(
                "Checking timestamps:  now: " +
                  now.toString() +
                  ", old: " +
                  old.toString() +
                  ", delta: " +
                  timeDelta +
                  ", waitTime: " +
                  waitTime
              );
              if (timeDelta < waitTime) {
                // Not enough time has passed
                continue;
              }
            }
            // Move this entry from incoming store to working store
            await redisClient.select(RedisTables.INCOMING);
            if ((await redisClient.del(si_key)) === 0) {
              logger.info(
                "[" +
                  myWorkerIdx +
                  "] The key [" +
                  si_key +
                  "] no longer exists in INCOMING"
              );
              continue;
            }
            await redisClient.select(RedisTables.WORKING);
            // If this VAA is already in the working store, then no need to add it again.
            // This handles the case of duplicate VAAs from multiple guardians
            const checkVal = await redisClient.get(si_key);
            if (!checkVal) {
              let payload: StorePayload = storePayloadFromJson(si_value);
              payload.status = Status.Pending;
              await redisClient.set(si_key, storePayloadToJson(payload));
              // Process the request
              await processRequest(
                myWorkerIdx,
                redisClient,
                si_key,
                myPrivateKey
              );
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
        await sleep(1000);
      }
    })();
    // Stagger the threads so they don't all wake up at once
    await sleep(500);
  }
  // Now spin up audit thread
  (async () => {
    // walk through the working table and check to see if the completed VAAs are actually completed
    const redisClient = await connectToRedis();
    logger.info("Spinning up audit worker...");
    if (!redisClient) {
      logger.error("audit worker failed to connect to redis!");
      return;
    }
    while (true) {
      await redisClient.select(RedisTables.WORKING);
      for await (const si_key of redisClient.scanIterator()) {
        const si_value = await redisClient.get(si_key);
        if (si_value) {
          logger.debug("Audit worker: SI: " + si_key + " =>" + si_value);
        } else {
          continue;
        }
        let storePayload: StorePayload = storePayloadFromJson(si_value);
        // Let things sit in here for 10 minutes
        // After that:
        //    - Toss totally failed VAAs
        //    - Check to see if successful transactions were rolled back
        //    - Put roll backs into INCOMING table
        //    - Toss legitimately completed transactions
        let now: Date = new Date();
        let old: Date = new Date(storePayload.timestamp);
        let timeDelta: number = now.getTime() - old.getTime(); // delta is in mS
        const TEN_MINUTES = 600000;
        logger.debug(
          "Audit worker checking timestamps:  now: " +
            now.toString() +
            ", old: " +
            old.toString() +
            ", delta: " +
            timeDelta
        );
        if (timeDelta > TEN_MINUTES) {
          // Deal with this item
          if (storePayload.status === Status.FatalError) {
            // Done with this failed transaction
            logger.debug("Audit thread: discarding FatalError.");
            await redisClient.del(si_key);
            continue;
          } else if (storePayload.status === Status.Completed) {
            // Check for rollback
            logger.debug("Audit thread: checking for rollback.");

            //TODO actually do an isTransferCompleted
            const rr = { status: Status.Completed };

            await redisClient.del(si_key);
            if (rr.status !== Status.Completed) {
              logger.info("Detected a rollback on " + si_key);
              // Remove this item from the WORKING table and move it to INCOMING
              await redisClient.select(RedisTables.INCOMING);
              await redisClient.set(si_key, si_value);
              await redisClient.select(RedisTables.WORKING);
            }
          } else if (storePayload.status === Status.Error) {
            logger.error("Audit thread received Error status.");
            continue;
          } else if (storePayload.status === Status.Pending) {
            logger.error("Audit thread received Pending status.");
            continue;
          } else {
            logger.error(
              "Audit thread: Unhandled Status of " + storePayload.status
            );
            console.log(
              "Audit thread: Unhandled Status of ",
              storePayload.status
            );
            continue;
          }
        }
      }
      // logger.debug("Audit thread: sleeping...");
      await sleep(10000);
    }
  })();
}

async function processRequest(
  myWorkerIdx: number,
  rClient: RedisClientType<any>,
  key: string,
  myPrivateKey: any
) {
  logger.debug("[" + myWorkerIdx + "] Processing request [" + key + "]...");
  // Get the entry from the working store
  await rClient.select(RedisTables.WORKING);
  let value: string | null = await rClient.get(key);
  if (!value) {
    logger.error(
      "[" + myWorkerIdx + "] processRequest could not find key [" + key + "]"
    );
    return;
  }
  let payload: StorePayload = storePayloadFromJson(value);
  if (payload.status !== Status.Pending) {
    logger.info(
      "[" + myWorkerIdx + "] This key [" + key + "] has already been processed."
    );
    return;
  }
  // Actually do the processing here and update status and time field
  let relayResult: RelayResult;
  try {
    logger.info(
      "[" +
        myWorkerIdx +
        "] processRequest() - Calling with vaa_bytes [" +
        payload.vaa_bytes +
        "]"
    );
    relayResult = await relay(payload.vaa_bytes, false, myPrivateKey);
    logger.info(
      "[" + myWorkerIdx + "] processRequest() - relay returned: %o",
      relayResult.status
    );
  } catch (e: any) {
    logger.error(
      "[" +
        myWorkerIdx +
        "] processRequest() - failed to relay transfer vaa: %o",
      e
    );

    relayResult = {
      status: Status.Error,
      result: "Failure",
    };
    if (e && e.message) {
      relayResult.result = e.message;
    }
  }

  const MAX_RETRIES = 10;
  let retry: boolean = false;
  if (relayResult.status === Status.Completed) {
    metrics.incSuccesses();
  } else {
    metrics.incFailures();
    if (relayResult.status === Status.FatalError) {
      // Invoke fatal error logic here!
      payload.retries = MAX_RETRIES;
    } else {
      // Invoke retry logic here!
      retry = true;
    }
  }

  // Put result back into store
  payload.status = relayResult.status;
  payload.timestamp = new Date().toString();
  payload.retries++;
  value = storePayloadToJson(payload);
  if (!retry || payload.retries > MAX_RETRIES) {
    await rClient.set(key, value);
  } else {
    // Remove from the working table
    await rClient.del(key);
    // Put this back into the incoming table
    await rClient.select(RedisTables.INCOMING);
    await rClient.set(key, value);
  }
}

//One worker should be spawned for each chainId+privateKey combo.
// async function spawnWorkerThread(workerInfo: WorkerInfo) {
//   //TODO add logging, and actually implement the functions.
//   while (true) {
//     //This will read the WORKING table to see if anything is ready to attempt a relay.
//     const vaa = await findWorkableItems();
//     if (vaa) {
//       //This will attempt the relay and either move the transaction to PENDING, increment its failure count, or discard it if it
//       //exceeds max retries;
//       await attemptRelay(workerInfo, vaa);

//       //Continue, so we will attempt more relays, which is the highest priority.
//       continue;
//     }

//     //This scans the INCOMING table to see if there are any VAAs which are workable by this worker.
//     const incomingVaa = await findIncomingVaa(workerInfo);
//     if (incomingVaa) {
//       //This will remove a VAA from the INCOMING table and place it in the WORKING table so a worker can pick it up.
//       await moveVaaToWorking(workerInfo, vaa);

//       //Continue, so the highest priority item can be hit
//       continue;
//     }
//   }
// }

//One auditor thread should be spawned per worker. This is perhaps overkill, but auditors
//should not be allowed to block workers, or other auditors.
// async function spawnAuditorThread(workerInfo: WorkerInfo) {
//   while (true) {
//     //This will check to see if anything in the WORKING table is past CONFIRMATION TIME for this worker.
//     const pendingRecord = findPendingRecordPastDue(workerInfo);
//     //If so, we will check to see if the transaction rolled back.
//     const didRollback = checkIfCompleted(pendingRecord);

//     if (didRollback) {
//       removeRecord(pendingRecord);
//     } else {
//       moveVaaToWorking(workerInfo, pendingRecord);
//     }
//   }
// }
