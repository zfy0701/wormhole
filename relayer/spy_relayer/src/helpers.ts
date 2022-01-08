////////////////////////////////// Start of Logger Stuff //////////////////////////////////////
export var logger;

export function initLogger() {
  const winston = require("winston");
  var useConsole: boolean = true;
  var logFileName: string;
  if (process.env.LOG_DIR) {
    useConsole = false;
    logFileName =
      process.env.LOG_DIR + "/spy_relay." + new Date().toISOString() + ".log";
  }

  var logLevel = "info";
  if (process.env.LOG_LEVEL) {
    logLevel = process.env.LOG_LEVEL;
  }

  var transport: any;
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
        (info) => `${[info.timestamp]}|${info.level}|${info.message}`
      )
    ),
  };

  logger = winston.createLogger(logConfiguration);
}

////////////////////////////////// Start of Other Helpful Stuff //////////////////////////////////////
import { uint8ArrayToHex } from "@certusone/wormhole-sdk";

export const INCOMING = 0;
export const WORKING = 1;

export type StoreKey = {
  chain_id: number;
  emitter_address: string;
  sequence: number;
};

export type StorePayload = {
  vaa_bytes: string;
};

export type StoreWorkingPayload = {
  // vaa_bytes is the same as in the StorePayload type.
  vaa_bytes: string;
  status: string;
  timestamp: string;
};

export function initWorkingPayload(): StoreWorkingPayload {
  return {
    vaa_bytes: "",
    status: "Pending",
    timestamp: Date().toString(),
  };
}

export function workingPayloadToJson(payload: StoreWorkingPayload): string {
  return JSON.stringify(payload);
}

export function workingPayloadFromJson(json: string): StoreWorkingPayload {
  return JSON.parse(json);
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

export function storePayloadFromVaaBytes(vaaBytes: any): StorePayload {
  return {
    vaa_bytes: uint8ArrayToHex(vaaBytes),
  };
}

export function storePayloadToJson(storePayload: StorePayload): string {
  return JSON.stringify(storePayload);
}

export function storePayloadFromJson(json: string): StorePayload {
  return JSON.parse(json);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
