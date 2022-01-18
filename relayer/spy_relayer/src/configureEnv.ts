import {
  ChainId,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  // CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  nativeToHexString,
} from "@certusone/wormhole-sdk";
import { ChainID } from "@certusone/wormhole-sdk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import * as helpers from "./helpers";
import { logger } from "./helpers";

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
};

export type ChainConfigInfo = {
  chainId: ChainId;
  chainName: string;
  nodeUrl: string;
  tokenBridgeAddress: string;
  bridgeAddress?: string;
  walletPrivateKey: string;
  terraName: string;
  terraChainId: string;
  terraCoin: string;
  terraGasPriceUrl: string;
  wrappedAsset: string | null;
};

// export type ListenerEnvironment = {
//   spyServiceHost: string;
//   spyServiceFilters:
//     {chainId: ChainID;
//     emitterAddress: string;}[];

//   redisHost: string;
//   redisPort: number;
//   restPort: number;
//   promPort: number;
//   readinessPort: number;
//   supportedChains: ChainId[];
//   logLevel: string;
//   supportedTokens: {chainId: ChainId; address: string}[];
// };

// let relayerEnv: RelayerEnvironment | undefined = undefined;
// let listenerEnv: ListenerEnvironment | undefined = undefined;

// export const getRelayerEnvironment: () => RelayerEnvironment = () => {
//   if (relayerEnv) {
//     return relayerEnv;
//   } else {
//     const env = createRelayerEnvironment();
//     relayerEnv = env;
//     return relayerEnv;
//   }
// };

// const createRelayerEnvironment: () => RelayerEnvironment = () => {};

// export const getListenerEnvironment: () => ListenerEnvironment = () => {
//   if (listenerEnv) {
//     return listenerEnv;
//   } else {
//     const env = createListenerEnvironment();
//     listenerEnv = env;
//     return listenerEnv;
//   }
// };

// const createListenerEnvironment: () => ListenerEnvironment = () => {};

//TODO entirely remove this
let env: RelayerEnvironment = null as any; //TODO not this crime
//TODO not even export this
export { env };

//Polygon is not supported on local Tilt network atm.
export function loadChainConfig(): boolean {
  setDefaultWasm("node");

  try {
    const supportedChains: ChainConfigInfo[] = [];
    configSol(supportedChains);
    configEth(supportedChains);
    configTerra(supportedChains);
    configBsc(supportedChains);
    configPolygon(supportedChains);
    configAvax(supportedChains);
    // configOasis(supportedChains);

    if (supportedChains.length === 0) {
      logger.error("loadChainConfig: no chains are enabled!");
      return false;
    }

    env = { supportedChains: supportedChains };
  } catch (e) {
    logger.error("loadChainConfig: failed to load config: %o", e);
    return false;
  }

  logger.debug(
    "loadChainConfig: loaded " +
      env.supportedChains.length +
      " supported chains"
  );
  return true;
}

function configEth(supportedChains: ChainConfigInfo[]) {
  if (!process.env.ETH_NODE_URL) return;

  if (!process.env.ETH_PRIVATE_KEY) {
    throw "Missing environment variable ETH_PRIVATE_KEY";
  }
  if (!process.env.ETH_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable ETH_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.ETH_WRAPPED_ASSET) {
    throw "Missing environment variable ETH_WRAPPED_ASSET";
  }

  let wrappedAsset = nativeToHexString(
    process.env.ETH_WRAPPED_ASSET,
    CHAIN_ID_ETH
  );

  //TODO never log private keys
  logger.info(
    "loaded ETH parameters: chainId: 2, url: [" +
      process.env.ETH_NODE_URL +
      "], privateKey: [" +
      process.env.ETH_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.ETH_TOKEN_BRIDGE_ADDRESS +
      "], wrappedAsset: [" +
      process.env.ETH_WRAPPED_ASSET +
      "], which is [" +
      wrappedAsset +
      "]"
  );

  supportedChains.push({
    chainId: 2,
    chainName: "ETH",
    nodeUrl: process.env.ETH_NODE_URL,
    walletPrivateKey: process.env.ETH_PRIVATE_KEY,
    tokenBridgeAddress: process.env.ETH_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: wrappedAsset,
  });
}

function configBsc(supportedChains: ChainConfigInfo[]) {
  if (!process.env.BSC_NODE_URL) return;

  if (!process.env.BSC_PRIVATE_KEY) {
    throw "Missing environment variable BSC_PRIVATE_KEY";
  }
  if (!process.env.BSC_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable BSC_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.BSC_WRAPPED_ASSET) {
    throw "Missing environment variable BSC_WRAPPED_ASSET";
  }

  var wrappedAsset = nativeToHexString(
    process.env.BSC_WRAPPED_ASSET,
    CHAIN_ID_BSC
  );

  logger.info(
    "loaded BSC parameters: chainId: 4, url: [" +
      process.env.BSC_NODE_URL +
      "], privateKey: [" +
      process.env.BSC_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.BSC_TOKEN_BRIDGE_ADDRESS +
      "], wrappedAsset: [" +
      process.env.BSC_WRAPPED_ASSET +
      "], which is [" +
      wrappedAsset +
      "]"
  );

  supportedChains.push({
    chainId: 4,
    chainName: "BSC",
    nodeUrl: process.env.BSC_NODE_URL,
    walletPrivateKey: process.env.BSC_PRIVATE_KEY,
    tokenBridgeAddress: process.env.BSC_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: wrappedAsset,
  });
}

function configSol(supportedChains: ChainConfigInfo[]) {
  if (!process.env.SOL_NODE_URL) return;

  if (!process.env.SOL_PRIVATE_KEY) {
    throw "Missing environment variable SOL_PRIVATE_KEY";
  }
  if (!process.env.SOL_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable SOL_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.SOL_BRIDGE_ADDRESS) {
    throw "Missing environment variable SOL_BRIDGE_ADDRESS";
  }

  logger.info(
    "loaded SOL parameters: chainId: 1, url: [" +
      process.env.SOL_NODE_URL +
      "], privateKey: [" +
      process.env.SOL_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.SOL_TOKEN_BRIDGE_ADDRESS +
      "], solBridgeAddress: [" +
      process.env.SOL_BRIDGE_ADDRESS +
      "]"
  );

  supportedChains.push({
    chainId: 1,
    chainName: "SOL",
    nodeUrl: process.env.SOL_NODE_URL,
    walletPrivateKey: process.env.SOL_PRIVATE_KEY,
    tokenBridgeAddress: process.env.SOL_TOKEN_BRIDGE_ADDRESS,
    bridgeAddress: process.env.SOL_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: "",
  });
}

function configTerra(supportedChains: ChainConfigInfo[]) {
  if (!process.env.TERRA_NODE_URL) return;

  if (!process.env.TERRA_PRIVATE_KEY) {
    throw "Missing environment variable TERRA_PRIVATE_KEY";
  }
  if (!process.env.TERRA_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable TERRA_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.TERRA_NAME) {
    throw "Missing environment variable TERRA_NAME";
  }
  if (!process.env.TERRA_CHAIN_ID) {
    throw "Missing environment variable TERRA_CHAIN_ID";
  }
  if (!process.env.TERRA_COIN) {
    throw "Missing environment variable TERRA_COIN";
  }
  if (!process.env.TERRA_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable TERRA_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.TERRA_GAS_PRICES_URL) {
    throw "Missing environment variable TERRA_GAS_PRICES_URL";
  }

  logger.info(
    "loaded TER parameters: chainId: 3, url: [" +
      process.env.TERRA_NODE_URL +
      "], privateKey: [" +
      process.env.TERRA_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.TERRA_TOKEN_BRIDGE_ADDRESS +
      "], terraName: [" +
      process.env.TERRA_NAME +
      "], terraChainId: [" +
      process.env.TERRA_CHAIN_ID +
      "], coin: [" +
      process.env.TERRA_COIN +
      "], gasPricesUrl: [" +
      process.env.TERRA_GAS_PRICES_URL +
      "]"
  );

  supportedChains.push({
    chainId: 3,
    chainName: "TERRA",
    nodeUrl: process.env.TERRA_NODE_URL,
    walletPrivateKey: process.env.TERRA_PRIVATE_KEY,
    tokenBridgeAddress: process.env.TERRA_TOKEN_BRIDGE_ADDRESS,
    terraName: process.env.TERRA_NAME,
    terraChainId: process.env.TERRA_CHAIN_ID,
    terraCoin: process.env.TERRA_COIN,
    terraGasPriceUrl: process.env.TERRA_GAS_PRICES_URL,
    wrappedAsset: "",
  });
}

function configPolygon(supportedChains: ChainConfigInfo[]) {
  if (!process.env.POLY_NODE_URL) return;

  if (!process.env.POLY_PRIVATE_KEY) {
    throw "Missing environment variable POLY_PRIVATE_KEY";
  }
  if (!process.env.POLY_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable POLY_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.POLY_WRAPPED_ASSET) {
    throw "Missing environment variable POLY_WRAPPED_ASSET";
  }

  var wrappedAsset = nativeToHexString(
    process.env.POLY_WRAPPED_ASSET,
    CHAIN_ID_POLYGON
  );

  logger.info(
    "loaded POLY parameters: chainId: 4, url: [" +
      process.env.POLY_NODE_URL +
      "], privateKey: [" +
      process.env.POLY_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.POLY_TOKEN_BRIDGE_ADDRESS +
      "], wrappedAsset: [" +
      process.env.POLY_WRAPPED_ASSET +
      "], which is [" +
      wrappedAsset +
      "]"
  );

  supportedChains.push({
    chainId: 5,
    chainName: "POLY",
    nodeUrl: process.env.POLY_NODE_URL,
    walletPrivateKey: process.env.POLY_PRIVATE_KEY,
    tokenBridgeAddress: process.env.POLY_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: wrappedAsset,
  });
}

function configAvax(supportedChains: ChainConfigInfo[]) {
  if (!process.env.AVAX_NODE_URL) return;

  if (!process.env.AVAX_PRIVATE_KEY) {
    throw "Missing environment variable AVAX_PRIVATE_KEY";
  }
  if (!process.env.AVAX_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable AVAX_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.AVAX_WRAPPED_ASSET) {
    throw "Missing environment variable AVAX_WRAPPED_ASSET";
  }

  var wrappedAsset = nativeToHexString(
    process.env.AVAX_WRAPPED_ASSET,
    CHAIN_ID_AVAX
  );

  logger.info(
    "loaded AVAX parameters: chainId: 4, url: [" +
      process.env.AVAX_NODE_URL +
      "], privateKey: [" +
      process.env.AVAX_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.AVAX_TOKEN_BRIDGE_ADDRESS +
      "], wrappedAsset: [" +
      process.env.AVAX_WRAPPED_ASSET +
      "], which is [" +
      wrappedAsset +
      "]"
  );

  supportedChains.push({
    chainId: 6,
    chainName: "AVAX",
    nodeUrl: process.env.AVAX_NODE_URL,
    walletPrivateKey: process.env.AVAX_PRIVATE_KEY,
    tokenBridgeAddress: process.env.AVAX_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: wrappedAsset,
  });
}

/*
function configOasis(supportedChains: ChainConfigInfo[]) {
  if (!process.env.OASIS_NODE_URL) return;

  if (!process.env.OASIS_PRIVATE_KEY) {
    throw "Missing environment variable OASIS_PRIVATE_KEY";
  }
  if (!process.env.OASIS_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable OASIS_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.OASIS_WRAPPED_ASSET) {
    throw "Missing environment variable OASIS_WRAPPED_ASSET";
  }

  var wrappedAsset = nativeToHexString(
    process.env.OASIS_WRAPPED_ASSET,
    CHAIN_ID_OASIS
  );

  logger.info(
    "loaded OASIS parameters: chainId: 4, url: [" +
      process.env.OASIS_NODE_URL +
      "], privateKey: [" +
      process.env.OASIS_PRIVATE_KEY +
      "], tokenBridgeAddress: [" +
      process.env.OASIS_TOKEN_BRIDGE_ADDRESS +
      "], wrappedAsset: [" +
      process.env.OASIS_WRAPPED_ASSET +
      "], which is [" +
      wrappedAsset +
      "]"
  );

  supportedChains.push({
    chainId: 7,
    chainName: "OASIS",
    nodeUrl: process.env.OASIS_NODE_URL,
    walletPrivateKey: process.env.OASIS_PRIVATE_KEY,
    tokenBridgeAddress: process.env.OASIS_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
    wrappedAsset: wrappedAsset,
  });
}
*/
