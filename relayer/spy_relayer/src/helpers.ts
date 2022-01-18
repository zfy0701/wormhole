////////////////////////////////// Start of Logger Stuff //////////////////////////////////////
export let logger: any;

export function initLogger() {
  const winston = require("winston");
  let useConsole = true;
  let logFileName;
  if (process.env.LOG_DIR) {
    useConsole = false;
    logFileName =
      process.env.LOG_DIR + "/spy_relay." + new Date().toISOString() + ".log";
  }

  let logLevel = "info";
  if (process.env.LOG_LEVEL) {
    logLevel = process.env.LOG_LEVEL;
  }

  let transport: any;
  if (useConsole) {
    console.log("spy_relay is logging to the console at level [%s]", logLevel);

    transport = new winston.transports.Console({
      level: logLevel,
    });
  } else {
    console.log(
      "spy_relay is logging to [%s] at level [%s]",
      logFileName,
      logLevel
    );

    transport = new winston.transports.File({
      filename: logFileName,
      level: logLevel,
    });
  }

  const logConfiguration = {
    transports: [transport],
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.simple(),
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS",
      }),
      winston.format.printf(
        (info: any) => `${[info.timestamp]}|${info.level}|${info.message}`
      )
    ),
  };

  logger = winston.createLogger(logConfiguration);
}

////////////////////////////////// Start of Redist Stuff /////////////////////////////////////////////

import { createClient } from "redis";

let redisHost: string | undefined;
let redisPort: number | undefined;

export function init(initValidator: boolean): boolean {
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
  logger.info("will connect to redis at [" + redisHost + ":" + redisPort + "]");

  if (initValidator) return validateInit();
  return true;
}

export async function connectToRedis() {
  let rClient;
  try {
    rClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    rClient.on("connect", function (err) {
      if (err) {
        logger.error(
          "connectToRedis: failed to connect to host [" +
            redisHost +
            "], port [" +
            redisPort +
            "]: %o",
          err
        );
      }
    });

    await rClient.connect();
  } catch (e) {
    logger.error(
      "connectToRedis: failed to connect to host [" +
        redisHost +
        "], port [" +
        redisPort +
        "]: %o",
      e
    );
  }

  return rClient;
}

import { Mutex } from "async-mutex";

const redisMutex = new Mutex();
let redisQueue = new Array<[string, string]>();

export async function storeInRedis(name: string, value: string) {
  if (!name) {
    logger.error("storeInRedis: invalid name");
    return;
  }
  if (!value) {
    logger.error("storeInRedis: invalid value");
    return;
  }

  await redisMutex.runExclusive(async () => {
    logger.debug("storeInRedis: connecting to redis.");
    const redisClient = await connectToRedis();
    if (!redisClient) {
      redisQueue.push([name, value]);
      logger.error(
        "Failed to connect to redis, enqueued vaa, there are now " +
          redisQueue.length +
          " enqueued events"
      );
      return;
    }

    if (redisQueue.length !== 0) {
      logger.info(
        "now connected to redis, playing out " +
          redisQueue.length +
          " enqueued events"
      );
      for (let idx = 0; idx < redisQueue.length; ++idx) {
        addToRedis(redisClient, redisQueue[idx][0], redisQueue[idx][1]);
      }
      redisQueue = [];
    }

    addToRedis(redisClient, name, value);
  });
}

export async function addToRedis(
  redisClient: any,
  name: string,
  value: string
) {
  try {
    logger.debug("storeInRedis: storing in redis.");
    await redisClient.select(INCOMING);
    await redisClient.set(name, value);

    await redisClient.quit();
    logger.debug("storeInRedis: finished storing in redis.");
  } catch (e) {
    logger.error(
      "storeInRedis: failed to store to host [" +
        redisHost +
        "], port [" +
        redisPort +
        "]: %o",
      e
    );
  }
}

////////////////////////////////// Start of Other Helpful Stuff ///////////////////////////////

import { uint8ArrayToHex } from "@certusone/wormhole-sdk";

export const INCOMING = 0;
export const WORKING = 1;

export type WorkerInfo = {
  index: number;
  targetChainId: number;
};

export type StoreKey = {
  chain_id: number;
  emitter_address: string;
  sequence: number;
};

export type StorePayload = {
  vaa_bytes: string;
  status: string;
  timestamp: string;
  retries: number;
};

export function initPayload(): StorePayload {
  return {
    vaa_bytes: "",
    status: "Pending",
    timestamp: Date().toString(),
    retries: 0,
  };
}
export function initPayloadWithVAA(vaa_bytes: any): StorePayload {
  const sp: StorePayload = initPayload();
  sp.vaa_bytes = vaa_bytes;
  return sp;
}

export function storeKeyFromParsedVAA(parsedVAA: any): StoreKey {
  return {
    chain_id: parsedVAA.emitter_chain as number,
    emitter_address: uint8ArrayToHex(parsedVAA.emitter_address),
    sequence: parsedVAA.sequence,
  };
}

export function storeKeyToJson(storeKey: StoreKey): string {
  return JSON.stringify(storeKey);
}

export function storeKeyFromJson(json: string): StoreKey {
  return JSON.parse(json);
}

export function storePayloadToJson(storePayload: StorePayload): string {
  return JSON.stringify(storePayload);
}

export function storePayloadFromJson(json: string): StorePayload {
  return JSON.parse(json);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//////////////////////////////////////////////////////// Start of Validation Stuff ////////////

import { BigNumber } from "ethers";

import {
  ChainId,
  //parseTransferPayload //TODO re-enable after upgrade to 0.1.6
} from "@certusone/wormhole-sdk";

const supportedTargetChains = new Set<ChainId>();
const originContractWhiteList = new Set<string>();
let minimumFee: BigInt = 0n;

export function validateInit(): boolean {
  if (!process.env.WORKER_TARGET_CHAINS) {
    logger.error("Missing environment variable WORKER_TARGET_CHAINS");
    return false;
  }

  const targetChains = eval(process.env.WORKER_TARGET_CHAINS);
  let str = "";
  for (let i = 0; i < targetChains.length; i++) {
    supportedTargetChains.add(targetChains[i].chain_id);
    if (!str) {
      str = targetChains[i].chain_id;
    } else {
      str += ", " + targetChains[i].chain_id;
    }
  }

  logger.info("supported target chains: [" + str + "]");

  if (process.env.WHITE_LISTED_CONTRACTS) {
    const contracts = eval(process.env.WHITE_LISTED_CONTRACTS);
    for (let i = 0; i < contracts.length; i++) {
      const key = contracts[i].chain_id + ":" + contracts[i].white_list;
      originContractWhiteList.add(key);
      const myChainId = parseInt(contracts[i].chain_id) as ChainId;
      const myContractAddresses = contracts[i].white_list;

      logger.info(
        "adding whitelist: chainId: [" +
          myChainId +
          "] => whiteList: [" +
          myContractAddresses +
          "], key: [" +
          key +
          "]"
      );
    }
  } else {
    logger.info("There are no white listed contracts provisioned.");
  }

  if (process.env.SPY_MIN_FEES) {
    minimumFee = BigInt(process.env.SPY_MIN_FEES);
    logger.info("will only process vaas where fee is at least " + minimumFee);
  }

  return true;
}

export const VALIDATE_SUCCESS: string = "success";
export const VALIDATE_VAA_TYPE_NOT_SUPPORTED: string = "VAA Type Not Supported";
export const VALIDATE_TARGET_CHAIN_NOT_SUPPORTED: string =
  "Target Chain Not Supported";
export const VALIDATE_NOT_WHITE_LISTED: string =
  "Origin Contract Not In White List";
export const VALIDATE_FEE_NOT_ENOUGH: string = "Not Enough Fees";

export function validateVaa(payloadBuffer: Buffer): [string, bigint] {
  if (payloadBuffer[0] !== 1) return [VALIDATE_VAA_TYPE_NOT_SUPPORTED, 0n];

  try {
    const transferPayload = parseTransferPayload(payloadBuffer);
    const fee = transferPayload.fee;

    if (!supportedTargetChains.has(transferPayload.targetChain))
      return [VALIDATE_TARGET_CHAIN_NOT_SUPPORTED, fee];

    if (originContractWhiteList.size !== 0) {
      let key: string = transferPayload.originChain.toString();
      key += ":" + transferPayload.originAddress;
      if (!originContractWhiteList.has(key))
        return [VALIDATE_NOT_WHITE_LISTED, fee];
    }

    if (fee < minimumFee) return [VALIDATE_FEE_NOT_ENOUGH, fee];
    return [VALIDATE_SUCCESS, fee];
  } catch (e) {
    return ["Invalid VAA", BigInt(0)];
  }
}

export const parseTransferPayload = (arr: Buffer) => ({
  amount: BigNumber.from(arr.slice(1, 1 + 32)).toBigInt(),
  originAddress: arr.slice(33, 33 + 32).toString("hex"),
  originChain: arr.readUInt16BE(65) as ChainId,
  targetAddress: arr.slice(67, 67 + 32).toString("hex"),
  targetChain: arr.readUInt16BE(99) as ChainId,
  fee: BigNumber.from(arr.slice(101, 101 + 32)).toBigInt(),
});
