import {
  ChainId,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
} from "@certusone/wormhole-sdk";
import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import { create } from "domain";

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
  supportedAssets: SupportedAssetInfo[];
};

export type ChainConfigInfo = {
  chainId: ChainId;
  nodeUrl: string;
  tokenBridgeAddress: string;
  bridgeAddress?: string;
  walletPrivateKey: string;
};

export type SupportedAssetInfo = {
  chainId: ChainId;
  supportAllAssets: boolean;
  supportedAssets: string[];
};

function isTrue(value: string | null | undefined) {
  return (value && value.toLowerCase()) === "true";
}

function isFalse(value: string | null | undefined) {
  return (value && value.toLowerCase()) === "false";
}

//Polygon is not supported on local Tilt network atm.
export function validateEnvironment(): RelayerEnvironment {
  setDefaultWasm("node");
  //TODO don't hardcode the .env path
  require("dotenv").config({ path: ".env.sample" });
  const supportedChains: ChainConfigInfo[] = [];
  if (isTrue(process.env.SOL_ENABLE)) {
    supportedChains.push(configSol());
  }
  if (isTrue(process.env.ETH_ENABLE)) {
    supportedChains.push(configEth());
  }
  if (isTrue(process.env.TERRA_ENABLE)) {
    supportedChains.push(configTerra());
  }
  if (isTrue(process.env.BSC_ENABLE)) {
    supportedChains.push(configBsc());
  }
  if (isTrue(process.env.POLYGON_ENABLE)) {
    supportedChains.push(configPolygon());
  }
  if (isTrue(process.env.AVAX_ENABLE)) {
    supportedChains.push(configAvax());
  }
  if (isTrue(process.env.OASIS_ENABLE)) {
    supportedChains.push(configOasis());
  }

  const supportedAssets = createSupportedAssetInfos();

  return { supportedChains, supportedAssets };
}

function createSupportedAssetInfos(): SupportedAssetInfo[] {
  const output: SupportedAssetInfo[] = [];

  output.push(getSolSupportedAssets());
  output.push(getEthSupportedAssets());
  output.push(getTerraSupportedAssets());
  output.push(getBscSupportedAssets());
  output.push(getPolygonSupportedAssets());
  output.push(getAvaxSupportedAssets());
  output.push(getOasisSupportedAssets());

  return output;
}

function getSolSupportedAssets(): SupportedAssetInfo {
  if (!process.env.SOL_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable SOL_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.SOL_ALLOW_ALL_ASSETS)) {
    return {
      chainId: CHAIN_ID_SOLANA,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(process.env.SOL_ALLOW_LIST);
      return {
        chainId: CHAIN_ID_SOLANA,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse SOL_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getEthSupportedAssets(): SupportedAssetInfo {
  if (!process.env.ETH_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable ETH_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.ETH_ALLOW_ALL_ASSETS)) {
    return {
      chainId: CHAIN_ID_ETH,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(process.env.ETH_ALLOW_LIST);
      return {
        chainId: CHAIN_ID_ETH,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse ETH_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getTerraSupportedAssets(): SupportedAssetInfo {
  if (!process.env.TERRA_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable TERRA_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.TERRA_ALLOW_ALL_ASSETS)) {
    return {
      chainId: CHAIN_ID_TERRA,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(
        process.env.TERRA_ALLOW_LIST
      );
      return {
        chainId: CHAIN_ID_TERRA,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse TERRA_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getBscSupportedAssets(): SupportedAssetInfo {
  if (!process.env.BSC_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable BSC_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.BSC_ALLOW_ALL_ASSETS)) {
    return {
      chainId: CHAIN_ID_BSC,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(process.env.BSC_ALLOW_LIST);
      return {
        chainId: CHAIN_ID_BSC,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse BSC_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getPolygonSupportedAssets(): SupportedAssetInfo {
  if (!process.env.POLYGON_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable POLYGON_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.POLYGON_ALLOW_ALL_ASSETS)) {
    return {
      chainId: CHAIN_ID_POLYGON,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(
        process.env.POLYGON_ALLOW_LIST
      );
      return {
        chainId: CHAIN_ID_POLYGON,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse POLYGON_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getAvaxSupportedAssets(): SupportedAssetInfo {
  if (!process.env.AVAX_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable AVAX_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.AVAX_ALLOW_ALL_ASSETS)) {
    return {
      chainId: 6 as ChainId,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(process.env.AVAX_ALLOW_LIST);
      return {
        chainId: 6 as ChainId,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse AVAX_ALLOW_LIST");
      process.exit(1);
    }
  }
}

function getOasisSupportedAssets(): SupportedAssetInfo {
  if (!process.env.OASIS_ALLOW_ALL_ASSETS) {
    console.error("Missing environment variable OASIS_ALLOW_ALL_ASSETS");
    process.exit(1);
  }
  if (isTrue(process.env.OASIS_ALLOW_ALL_ASSETS)) {
    return {
      chainId: 7 as ChainId,
      supportAllAssets: true,
      supportedAssets: [],
    };
  } else {
    try {
      const supportedAssets: string[] = JSON.parse(
        process.env.OASIS_ALLOW_LIST
      );
      return {
        chainId: 7 as ChainId,
        supportAllAssets: false,
        supportedAssets,
      };
    } catch (e) {
      console.error("Failed to parse OASIS_ALLOW_LIST");
      process.exit(1);
    }
  }
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

function configPolygon(): ChainConfigInfo {
  if (!process.env.POLYGON_NODE_URL) {
    console.error("Missing environment variable POLYGON_NODE_URL");
    process.exit(1);
  }
  if (!process.env.POLYGON_PRIVATE_KEY) {
    console.error("Missing environment variable POLYGON_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.POLYGON_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable POLYGON_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 5,
    nodeUrl: process.env.POLYGON_NODE_URL,
    walletPrivateKey: process.env.POLYGON_PRIVATE_KEY,
    tokenBridgeAddress: process.env.POLYGON_TOKEN_BRIDGE_ADDRESS,
  };
}

function configAvax(): ChainConfigInfo {
  if (!process.env.AVAX_NODE_URL) {
    console.error("Missing environment variable AVAX_NODE_URL");
    process.exit(1);
  }
  if (!process.env.AVAX_PRIVATE_KEY) {
    console.error("Missing environment variable AVAX_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.AVAX_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable AVAX_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 6 as any, //TODO update sdk
    nodeUrl: process.env.AVAX_NODE_URL,
    walletPrivateKey: process.env.AVAX_PRIVATE_KEY,
    tokenBridgeAddress: process.env.AVAX_TOKEN_BRIDGE_ADDRESS,
  };
}

function configOasis(): ChainConfigInfo {
  if (!process.env.OASIS_NODE_URL) {
    console.error("Missing environment variable OASIS_NODE_URL");
    process.exit(1);
  }
  if (!process.env.OASIS_PRIVATE_KEY) {
    console.error("Missing environment variable OASIS_PRIVATE_KEY");
    process.exit(1);
  }
  if (!process.env.OASIS_TOKEN_BRIDGE_ADDRESS) {
    console.error("Missing environment variable OASIS_TOKEN_BRIDGE_ADDRESS");
    process.exit(1);
  }

  return {
    chainId: 7 as any,
    nodeUrl: process.env.OASIS_NODE_URL,
    walletPrivateKey: process.env.OASIS_PRIVATE_KEY,
    tokenBridgeAddress: process.env.OASIS_TOKEN_BRIDGE_ADDRESS,
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
