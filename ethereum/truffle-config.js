require("dotenv").config({ path: ".env" });
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://mainnet.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 1,
      gas: 10000000,
      gasPrice: 191000000000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: false,
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://rinkeby.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 4,
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://goerli.infura.io/v3/" + process.env.INFURA_KEY
        );
      },
      network_id: "5",
      gas: 4465030,
      gasPrice: 10000000000,
    },
    binance: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://bsc-dataseed.binance.org/"
        );
      },
      network_id: "56",
      gas: 70000000,
      gasPrice: 8000000000,
    },
    binance_testnet: {
      provider: () => new HDWalletProvider(
        process.env.MNEMONIC,
        "https://data-seed-prebsc-1-s1.binance.org:8545/"
      ),
      network_id: "97",
      gas: 70000000,
      gasPrice: 8000000000,
    },
    polygon: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://polygon-rpc.com"
        );
      },
      network_id: "137",
      gas: 10000000,
      gasPrice: 700000000000,
    },
    mumbai: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://polygon-mumbai.infura.io/v3/" + process.env.INFURA_KEY)
      },
      network_id: "80001",
    },
    avalanche: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://api.avax.network/ext/bc/C/rpc"
        );
      },
      network_id: "43114",
      gas: 8000000,
      gasPrice: 26000000000,
    },
    fuji: {
      provider: () => new HDWalletProvider(
        process.env.MNEMONIC,
        "https://api.avax-test.network/ext/bc/C/rpc"
      ),
      network_id: "43113",
    },
    oasis: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "https://emerald.oasis.dev/"
        );
      },
      network_id: 42262,
      gas: 4465030,
      gasPrice: 30000000000,
    },
  },

  compilers: {
    solc: {
      version: "0.8.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  plugins: ["@chainsafe/truffle-plugin-abigen", "truffle-plugin-verify"],

  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },
};
