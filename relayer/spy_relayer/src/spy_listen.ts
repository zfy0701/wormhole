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

import { logger } from "./helpers";
import { env } from "./configureEnv";
import * as helpers from "./helpers";
import { relay } from "./relay/main";
import { BigNumber } from "ethers";
import { PromHelper } from "./promHelpers";

var minimumFee: BigInt = 0n;
var vaaUriPrelude: string;
var whMap = new Map<string, string>();
var metrics: PromHelper;

export function init(runListen: boolean): boolean {
  if (!runListen) return true;

  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    return false;
  }

  if (process.env.SPY_MIN_FEES) {
    minimumFee = BigInt(process.env.SPY_MIN_FEES);
    logger.info("will only process vaas where fee is at least " + minimumFee);
  }

  vaaUriPrelude =
    "http://localhost:" +
    (process.env.REST_PORT ? process.env.REST_PORT : "4200") +
    "/relayvaa/";

  return true;
}

export async function run(ph: PromHelper) {
  metrics = ph;
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

    if (process.env.WHITE_LISTED_CONTRACTS) {
      const parsedJsonContracts = eval(process.env.WHITE_LISTED_CONTRACTS);
      logger.info("Attempting to parse white listed contracts...");

      for (var i = 0; i < parsedJsonContracts.length; i++) {
        var myChainId = parseInt(parsedJsonContracts[i].chain_id) as ChainId;
        var myContractAddresses = parsedJsonContracts[i].white_list;
        whMap[myChainId] = myContractAddresses;
        logger.info(
          "adding whitelist: chainId: [" +
            myChainId +
            "] => whiteList: [" +
            myContractAddresses +
            "]"
        );
      }
    } else {
      logger.info("There are no white listed contracts provisioned.");
    }

    const client = createSpyRPCServiceClient(process.env.SPY_SERVICE_HOST);
    const stream = await subscribeSignedVAA(client, filter);

    stream.on("data", ({ vaaBytes }) => {
      metrics.incIncoming();
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
    const vaaUri =
      vaaUriPrelude + encodeURIComponent(vaaBytes.toString("base64"));

    var payloadBuffer: Buffer = Buffer.from(parsedVAA.payload);
    var transferPayload = parseTransferPayload(payloadBuffer);
    var gotFee: boolean;
    var fee: bigint;

    // Check to see if this is a whitelisted contract
    var listOfAddresses: string;
    logger.info(
      "Looking for whitelisted contracts for chainId: " +
        transferPayload.originChain
    );
    listOfAddresses = whMap[transferPayload.originChain];
    if (!listOfAddresses || listOfAddresses.length === 0) {
      logger.info(
        "listOfAddresses is empty for chainId: " + transferPayload.originChain
      );
    }
    if (listOfAddresses.includes(transferPayload.originAddress)) {
      logger.info("Found whitelisted contract");
    } else {
      logger.info(
        "Did not find whitelisted contract: " + transferPayload.originAddress
      );
    }
    [gotFee, fee] = getFee(payloadBuffer);
    if (gotFee && fee >= minimumFee) {
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
          "],  fee: " +
          fee +
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

      await helpers.storeInRedis(
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
        "ignoring vaa because fee of " +
          fee +
          " is less than the minimum of " +
          minimumFee +
          ": emitter: [" +
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
          "],  fee: " +
          fee +
          ", [" +
          vaaUri +
          "]"
      );
    }
  } else if (isPyth(parsedVAA.payload)) {
    logger.debug("dropping pyth message");
  } else {
    logger.debug(
      "dropping vaa, payload type parsedVAA.payload[0]: %o",
      parsedVAA
    );
  }
}

function getFee(arr: Buffer): [boolean, bigint] {
  // From parseTransferPayload() in sdk/js/src/utils/parseVaa.ts:
  //     0   u256     amount
  //     32  [u8; 32] token_address
  //     64  u16      token_chain
  //     66  [u8; 32] recipient
  //     98  u16      recipient_chain
  //     100 u256     fee`

  var fee: bigint;
  try {
    fee = BigNumber.from(arr.slice(101, 101 + 32)).toBigInt();
  } catch (e) {
    logger.error("failed to evaluate fees in vaa: %o", e);
    logger.error("offending payload: %o", arr);
    return [false, 0n];
  }

  return [true, fee];
}

function isPyth(payload): boolean {
  if (payload.length < 4) return false;
  if (
    payload[0] === 80 &&
    payload[1] === 50 &&
    payload[2] === 87 &&
    payload[3] === 72
  ) {
    // P2WH
    return true;
  }

  return false;
}
