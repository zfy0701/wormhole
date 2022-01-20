import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
  hexToUint8Array,
  uint8ArrayToHex,
} from "@certusone/wormhole-sdk";
import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";
import { getListenerEnvironment, ListenerEnvironment } from "../configureEnv";
import { getLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import {
  initPayloadWithVAA,
  storeInRedis,
  storeKeyFromParsedVAA,
  storeKeyToJson,
  storePayloadToJson,
} from "../helpers/redisHelper";
import { sleep } from "../helpers/utils";
import {
  parseAndValidateVaa,
  ParsedTransferPayload,
  ParsedVaa,
} from "./validation";

let metrics: PromHelper;
let env: ListenerEnvironment;
let logger = getLogger();
let vaaUriPrelude: string;

export function init(runListen: boolean): boolean {
  if (!runListen) return true;
  try {
    env = getListenerEnvironment();
    vaaUriPrelude =
      "http://localhost:" +
      (process.env.REST_PORT ? process.env.REST_PORT : "4200") +
      "/relayvaa/";
  } catch (e) {
    logger.error("Error initializing listener environment: " + e);
    return false;
  }

  return true;
}

export async function run(ph: PromHelper) {
  const logger = getLogger();
  metrics = ph;

  let typedFilters: {
    emitterFilter: { chainId: ChainId; emitterAddress: string };
  }[] = [];
  for (let i = 0; i < env.spyServiceFilters.length; i++) {
    const filter = env.spyServiceFilters[i];
    const typedFilter = {
      emitterFilter: {
        chainId: filter.chainId as ChainId,
        emitterAddress: await encodeEmitterAddress(
          filter.chainId,
          filter.emitterAddress
        ),
      },
    };
    logger.info(
      "adding filter: chainId: [" +
        typedFilter.emitterFilter.chainId +
        "], emitterAddress: [" +
        typedFilter.emitterFilter.emitterAddress +
        "]"
    );
    typedFilters.push(typedFilter);
  }

  logger.info(
    "spy_relay starting up, will listen for signed VAAs from [" +
      env.spyServiceHost +
      "]"
  );

  const wrappedFilters = { filters: typedFilters };

  while (true) {
    let stream: any;
    try {
      //TODO use ENV object
      const client = createSpyRPCServiceClient(
        process.env.SPY_SERVICE_HOST || ""
      );
      stream = await subscribeSignedVAA(client, wrappedFilters);

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
        await sleep(1000);
      }
    } catch (e) {
      logger.error("spy service threw an exception: %o", e);
    }

    stream.end;
    await sleep(5 * 1000);
    logger.info("attempting to reconnect to the spy service");
  }
}

async function processVaa(hexVaa: string) {
  //TODO, verify this is correct & potentially swap to using hex encoding
  const vaaUri =
    vaaUriPrelude +
    encodeURIComponent(Buffer.from(hexToUint8Array(hexVaa)).toString("base64"));
  logger.debug("processVaa: vaaBytes: %o", hexVaa);
  const rawVaa = hexToUint8Array(hexVaa);

  const validationResults: ParsedVaa<ParsedTransferPayload> | string =
    await parseAndValidateVaa(rawVaa);

  metrics.incIncoming();

  if (typeof validationResults === "string") {
    logger.debug("Rejecting spied request due validation failure");
    return;
  }

  const parsedVAA: ParsedVaa<ParsedTransferPayload> = validationResults;
  const transferPayload = parsedVAA.payload;

  logger.info(
    "forwarding vaa to relayer: emitter: [" +
      parsedVAA.emitterChain +
      ":" +
      uint8ArrayToHex(parsedVAA.emitterAddress) +
      "], seqNum: " +
      parsedVAA.sequence +
      ", payload: origin: [" +
      transferPayload.originAddress +
      ":" +
      transferPayload.originAddress +
      "], target: [" +
      transferPayload.targetChain +
      ":" +
      transferPayload.targetAddress +
      "],  amount: " +
      transferPayload.amount +
      "],  fee: " +
      transferPayload.fee +
      ", [" +
      vaaUri +
      "]"
  );
  const storeKey = storeKeyFromParsedVAA(parsedVAA);
  const storePayload = initPayloadWithVAA(hexVaa);

  logger.debug(
    "storing: key: [" +
      storeKey.chain_id +
      "/" +
      storeKey.emitter_address +
      "/" +
      storeKey.sequence +
      "], payload: [" +
      storePayloadToJson(storePayload) +
      "]"
  );

  await storeInRedis(
    storeKeyToJson(storeKey),
    storePayloadToJson(storePayload)
  );
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
