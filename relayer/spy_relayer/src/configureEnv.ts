import { ChainId } from "@certusone/wormhole-sdk";
import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
  redisHost: string;
  redisPort: string;
};

export type ChainConfigInfo = {
  chainId: ChainId;
  nodeUrl: string;
  tokenBridgeAddress: string;
  bridgeAddress?: string;
  walletPrivateKey: string;
};

//Polygon is not supported on local Tilt network atm.
export function validateEnvironment(): RelayerEnvironment {
  setDefaultWasm("node");
  require("dotenv").config({
    path:
      process.env.NODE_ENV === "tilt"
        ? ".env.tilt"
        : process.env.NODE_ENV === "localhost"
        ? ".env.sample"
        : "",
  });

  if (!process.env.SPY_SERVICE_HOST) {
    console.error("Failed to load environment file");
    process.exit(1);
  }
  const supportedChains: ChainConfigInfo[] = [];
  supportedChains.push(configSol());
  supportedChains.push(configEth());
  supportedChains.push(configBsc());
  supportedChains.push(configTerra());

  return {
    supportedChains,
    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT,
  };
}

function configEth(): ChainConfigInfo {
  if (!process.env.ETH_NODE_URL) {
    console.error("Missing environment variable ETH_NODE_URL");
    process.exit(1);
  }
  if (!process.env.ETH_PRIVATE_KEY) {
    console.error("Missing environment variable ETH_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.ETH_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable ETH_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 2,
    nodeUrl: process.env.ETH_NODE_URL,
    walletPrivateKey: process.env.ETH_PRIVATE_KEY,
    tokenBridgeAddress: process.env.ETH_TOKEN_BRIDGE_ADDRESS,
  };
}

function configBsc(): ChainConfigInfo {
  if (!process.env.BSC_NODE_URL) {
    console.error("Missing environment variable BSC_NODE_URL");
    process.exit(1);
  }
  if (!process.env.BSC_PRIVATE_KEY) {
    console.error("Missing environment variable BSC_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.BSC_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable BSC_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 4,
    nodeUrl: process.env.BSC_NODE_URL,
    walletPrivateKey: process.env.BSC_PRIVATE_KEY,
    tokenBridgeAddress: process.env.BSC_TOKEN_BRIDGE_ADDRESS,
  };
}

function configSol(): ChainConfigInfo {
  if (!process.env.SOL_NODE_URL) {
    console.error("Missing environment variable SOL_NODE_URL");
    process.exit(1);
  }
  if (!process.env.SOL_PRIVATE_KEY) {
    console.error("Missing environment variable SOL_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.SOL_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable SOL_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }
  if (!process.env.SOL_BRIDGE_ADDRESS) {
    console.error("Missing environment variable SOL_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 1,
    nodeUrl: process.env.SOL_NODE_URL,
    walletPrivateKey: process.env.SOL_PRIVATE_KEY,
    tokenBridgeAddress: process.env.SOL_TOKEN_BRIDGE_ADDRESS,
    bridgeAddress: process.env.SOL_BRIDGE_ADDRESS,
  };
}

function configTerra(): ChainConfigInfo {
  if (!process.env.TERRA_NODE_URL) {
    console.error("Missing environment variable TERRA_NODE_URL");
    process.exit(1);
  }
  if (!process.env.TERRA_PRIVATE_KEY) {
    console.error("Missing environment variable TERRA_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.TERRA_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable TERRA_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 3,
    nodeUrl: process.env.TERRA_NODE_URL,
    walletPrivateKey: process.env.TERRA_PRIVATE_KEY,
    tokenBridgeAddress: process.env.TERRA_TOKEN_BRIDGE_ADDRESS,
  };
}
