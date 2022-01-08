import { ChainId } from "@certusone/wormhole-sdk";
import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import * as helpers from "./helpers";
import { logger } from "./helpers";

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
};

export type ChainConfigInfo = {
  chainId: ChainId;
  nodeUrl: string;
  tokenBridgeAddress: string;
  bridgeAddress?: string;
  walletPrivateKey: string;
  terraName: string;
  terraChainId: string;
  terraCoin: string;
  terraGasPriceUrl: string;
};

export var env: RelayerEnvironment;

//Polygon is not supported on local Tilt network atm.
export function loadChainConfig(): boolean {
  setDefaultWasm("node");

  try {
    const supportedChains: ChainConfigInfo[] = [];
    supportedChains.push(configSol());
    supportedChains.push(configEth());
    supportedChains.push(configBsc());
    supportedChains.push(configTerra());
  } catch (e) {
    logger.error("loadChainConfig: failed to load config: %o", e);
    return false;
  }

  return true;
}

function configEth(): ChainConfigInfo {
  if (!process.env.ETH_NODE_URL) {
    throw "Missing environment variable ETH_NODE_URL";
  }
  if (!process.env.ETH_PRIVATE_KEY) {
    throw "Missing environment variable ETH_PRIVATE_KEY";
  }
  if (!process.env.ETH_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable ETH_TOKEN_BRIDGE_ADDRESS";
  }

  return {
    chainId: 2,
    nodeUrl: process.env.ETH_NODE_URL,
    walletPrivateKey: process.env.ETH_PRIVATE_KEY,
    tokenBridgeAddress: process.env.ETH_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
  };
}

function configBsc(): ChainConfigInfo {
  if (!process.env.BSC_NODE_URL) {
    throw "Missing environment variable BSC_NODE_URL";
  }
  if (!process.env.BSC_PRIVATE_KEY) {
    throw "Missing environment variable BSC_PRIVATE_KEY";
  }
  if (!process.env.BSC_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable BSC_TOKEN_BRIDGE_ADDRESS";
  }

  return {
    chainId: 4,
    nodeUrl: process.env.BSC_NODE_URL,
    walletPrivateKey: process.env.BSC_PRIVATE_KEY,
    tokenBridgeAddress: process.env.BSC_TOKEN_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
  };
}

function configSol(): ChainConfigInfo {
  if (!process.env.SOL_NODE_URL) {
    throw "Missing environment variable SOL_NODE_URL";
  }
  if (!process.env.SOL_PRIVATE_KEY) {
    throw "Missing environment variable SOL_PRIVATE_KEY";
  }
  if (!process.env.SOL_TOKEN_BRIDGE_ADDRESS) {
    throw "Missing environment variable SOL_TOKEN_BRIDGE_ADDRESS";
  }
  if (!process.env.SOL_BRIDGE_ADDRESS) {
    throw "Missing environment variable SOL_BRIDGE_ADDRESS";
  }

  return {
    chainId: 1,
    nodeUrl: process.env.SOL_NODE_URL,
    walletPrivateKey: process.env.SOL_PRIVATE_KEY,
    tokenBridgeAddress: process.env.SOL_TOKEN_BRIDGE_ADDRESS,
    bridgeAddress: process.env.SOL_BRIDGE_ADDRESS,
    terraName: "",
    terraChainId: "",
    terraCoin: "",
    terraGasPriceUrl: "",
  };
}

function configTerra(): ChainConfigInfo {
  if (!process.env.TERRA_NODE_URL) {
    throw "Missing environment variable TERRA_NODE_URL";
  }
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

  return {
    chainId: 3,
    nodeUrl: process.env.TERRA_NODE_URL,
    walletPrivateKey: process.env.TERRA_PRIVATE_KEY,
    tokenBridgeAddress: process.env.TERRA_TOKEN_BRIDGE_ADDRESS,
    terraName: process.env.TERRA_NAME,
    terraChainId: process.env.TERRA_CHAIN_ID,
    terraCoin: process.env.TERRA_COIN,
    terraGasPriceUrl: process.env.TERRA_GAS_PRICES_URL,
  };
}
