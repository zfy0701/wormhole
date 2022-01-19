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
import { PromHelper } from "./promHelpers";

let vaaUriPrelude: string;
let metrics: PromHelper;

export function init(runListen: boolean): boolean {
  if (!runListen) return true;

  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    return false;
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

  (async () => {
    let filter = {};
    if (process.env.SPY_SERVICE_FILTERS) {
      const parsedJsonFilters = eval(process.env.SPY_SERVICE_FILTERS);

      let myFilters = [];
      for (let i = 0; i < parsedJsonFilters.length; i++) {
        const myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
        const myEmitterAddress = await encodeEmitterAddress(
          myChainId,
          parsedJsonFilters[i].emitter_address
        );
        const myEmitterFilter = {
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

    while (true) {
      let stream: any;
      try {
        //TODO use ENV object
        const client = createSpyRPCServiceClient(
          process.env.SPY_SERVICE_HOST || ""
        );
        stream = await subscribeSignedVAA(client, filter);

        //TODO validate that this is the correct type of the vaaBytes
        stream.on("data", ({ vaaBytes }: { vaaBytes: string }) => {
          processVaa(vaaBytes);
        });

        let connected = true;
        stream.on("error", (err: any) => {
          logger.error("spy service returned an error: %o", err);
          connected = false;
        });

        stream.on("close", () => {
          logger.error("spy service closed the connection!");
          connected = false;
        });

        logger.info(
          "connected to spy service, listening for transfer signed VAAs"
        );

        while (connected) {
          await helpers.sleep(1000);
        }
      } catch (e) {
        logger.error("spy service threw an exception: %o", e);
      }

      stream.end;
      await helpers.sleep(5 * 1000);
      logger.info("attempting to reconnect to the spy service");
    }
  })();
}

async function encodeEmitterAddress(
  myChainId: ChainId,
  emitterAddressStr: string
): Promise<string> {
  if (myChainId === CHAIN_ID_SOLANA) {
    return await getEmitterAddressSolana(emitterAddressStr);
  }

  if (myChainId === CHAIN_ID_TERRA) {
    return await getEmitterAddressTerra(emitterAddressStr);
  }

  return getEmitterAddressEth(emitterAddressStr);
}

async function processVaa(hexVaa: string) {
  logger.debug("processVaa: vaaBytes: %o", hexVaa);
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(hexToUint8Array(hexVaa));
  logger.debug("processVaa: parsedVAA: %o", parsedVAA);
  metrics.incIncoming();

  if (parsedVAA.payload[0] === 1) {
    const vaaUri =
      vaaUriPrelude +
      encodeURIComponent(
        Buffer.from(hexToUint8Array(hexVaa)).toString("base64")
      );

    const payloadBuffer: Buffer = Buffer.from(parsedVAA.payload);
    const transferPayload = parseTransferPayload(payloadBuffer);
    let vc;
    let fee: bigint;

    [vc, fee] = helpers.validateVaa(payloadBuffer);
    if (vc === "success") {
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

      const storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
      const storePayload = helpers.initPayloadWithVAA(hexVaa);

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
        "ignoring vaa because it failed validation with code: " +
          vc +
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

function isPyth(payload: Buffer): boolean {
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
