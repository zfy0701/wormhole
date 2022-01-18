import {
  ChainId,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  nativeToHexString,
} from "@certusone/wormhole-sdk";
import { ChainID } from "@certusone/wormhole-sdk/lib/cjs/proto/publicrpc/v1/publicrpc";
import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
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

export type ListenerEnvironment = {
  spyServiceHost: string;
  spyServiceFilters: { chainId: ChainId; emitterAddress: string }[];

  redisHost: string;
  redisPort: number;
  restPort: number;
  promPort: number;
  readinessPort: number;
  supportedChains: ChainId[];
  logLevel: string;
  supportedTokens: { chainId: ChainId; address: string }[];
};
let listenerEnv: ListenerEnvironment | undefined = undefined;
export const getListenerEnvironment: () => ListenerEnvironment = () => {
  if (listenerEnv) {
    return listenerEnv;
  } else {
    const env = createListenerEnvironment();
    listenerEnv = env;
    return listenerEnv;
  }
};
const createListenerEnvironment: () => ListenerEnvironment = () => {
  let spyServiceHost: string;
  let spyServiceFilters: { chainId: ChainId; emitterAddress: string }[] = [];
  let redisHost: string;
  let redisPort: number;
  let restPort: number;
  let promPort: number;
  let numSpyWorkers: number;
  let readinessPort: number;
  let supportedChains: ChainId[] = [];
  let logLevel: string;
  let supportedTokens: { chainId: ChainId; address: string }[] = [];

  if (!process.env.SPY_SERVICE_HOST) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    spyServiceHost = process.env.SPY_SERVICE_HOST;
  }

  if (!process.env.SPY_SERVICE_FILTERS) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    const array = JSON.parse(process.env.SPY_SERVICE_FILTERS);
    if (!array.foreach) {
      throw new Error("Spy service filters is not an array.");
    } else {
      array.forEach((filter: any) => {
        if (filter.chainId && filter.emitterAddress) {
          spyServiceFilters.push({
            chainId: filter.chainId,
            emitterAddress: filter.emitterAddress,
          });
        } else {
          throw new Error("Invalid filter record. " + filter.toString());
        }
      });
    }
  }

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  if (!process.env.REST_PORT) {
    throw new Error("Missing required environment variable: REST_PORT");
  } else {
    restPort = parseInt(process.env.REST_PORT);
  }

  if (!process.env.PROM_PORT) {
    throw new Error("Missing required environment variable: PROM_PORT");
  } else {
    promPort = parseInt(process.env.PROM_PORT);
  }

  if (!process.env.READINESS_PORT) {
    throw new Error("Missing required environment variable: READINESS_PORT");
  } else {
    readinessPort = parseInt(process.env.READINESS_PORT);
  }

  if (!process.env.SPY_NUM_WORKERS) {
    throw new Error("Missing required environment variable: SPY_NUM_WORKERS");
  } else {
    numSpyWorkers = parseInt(process.env.SPY_NUM_WORKERS);
  }

  if (!process.env.WORKER_TARGET_CHAINS) {
    throw new Error(
      "Missing required environment variable: WORKER_TARGET_CHAINS"
    );
  } else {
    const array = JSON.parse(process.env.WORKER_TARGET_CHAINS);
    if (!array.foreach) {
      throw new Error("Spy worker chains is not an array.");
    } else {
      array.forEach((chain?: number) => {
        //TODO check if actually is in range
        if (chain) {
          supportedChains.push(chain as ChainId);
        } else {
          throw new Error("Invalid chain id record. " + chain);
        }
      });
    }
  }

  if (!process.env.LOG_LEVEL) {
    throw new Error("Missing required environment variable: LOG_LEVEL");
  } else {
    logLevel = process.env.LOG_LEVEL;
  }

  if (!process.env.SUPPORTED_TOKENS) {
    throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
  } else {
    const array = JSON.parse(process.env.SUPPORTED_TOKENS);
    if (!array.foreach) {
      throw new Error("SUPPORTED_TOKENS is not an array.");
    } else {
      array.forEach((token: any) => {
        if (token.chainId && token.address) {
          supportedTokens.push({
            chainId: token.chainId,
            address: token.address,
          });
        } else {
          throw new Error("Invalid token record. " + token.toString());
        }
      });
    }
  }

  return {
    spyServiceHost,
    spyServiceFilters,
    redisHost,
    redisPort,
    restPort,
    promPort,
    numSpyWorkers,
    readinessPort,
    supportedChains,
    logLevel,
    supportedTokens,
  };
};

// let relayerEnv: RelayerEnvironment | undefined = undefined;

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
