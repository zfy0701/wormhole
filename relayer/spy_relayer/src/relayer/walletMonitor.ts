import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  WSOL_DECIMALS,
} from "@certusone/wormhole-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  addressFromPublicKey,
  LCDClient,
  MnemonicKey,
} from "@terra-money/terra.js";
import { ethers, Signer } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import {
  ChainConfigInfo,
  getRelayerEnvironment,
  RelayerEnvironment,
  SupportedToken,
} from "../configureEnv";
import { getLogger } from "../helpers/logHelper";
import { getMultipleAccountsRPC } from "../utils/solana";
import { getEthereumToken } from "../utils/ethereum";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

let env: RelayerEnvironment;
const logger = getLogger();

export type WalletBalance = {
  chainId: ChainId;
  balanceAbs: string;
  balanceFormatted?: string;
  currencyName: string;
  currencyAddressNative: string;
};

export interface TerraNativeBalances {
  [index: string]: string;
}

function init() {
  try {
    env = getRelayerEnvironment();
  } catch (e) {
    logger.error("Unable to instantiate the relayerEnv in wallet monitor");
  }
}

async function pullBalances() {
  //TODOD loop through all the chain configs, calc the public keys, pull their balances, and push to a combo of the loggers and prmometheus

  const balances: WalletBalance[] = [];

  for (const chainInfo of env.supportedChains) {
    for (const privateKey of chainInfo.walletPrivateKey || []) {
      if (isEVMChain(chainInfo.chainId)) {
        balances.push(await pullEVMNativeBalance(chainInfo, privateKey));
      } else if (chainInfo.chainId === CHAIN_ID_TERRA) {
        balances.concat(await pullTerraNativeBalance(chainInfo, privateKey));
      } else {
        logger.error("Invalid chain ID in wallet monitor " + chainInfo.chainId);
      }
    }

    for (const solanaPrivateKey of chainInfo.solanaPrivateKey || []) {
      if (chainInfo.chainId === CHAIN_ID_SOLANA) {
        balances.push(
          await pullSolanaNativeBalance(chainInfo, solanaPrivateKey)
        );
      }
    }
  }
}

async function pullEVMBalance(
  chainInfo: ChainConfigInfo,
  privateKey: string,
  supportedToken: SupportedToken
): Promise<WalletBalance> {
  let provider = new ethers.providers.WebSocketProvider(chainInfo.nodeUrl);
  const signer: Signer = new ethers.Wallet(privateKey, provider);

  const token = await getEthereumToken(supportedToken.address, provider);
  const decimals = await token.decimals();
  const balance = await token.balanceOf(await signer.getAddress());
  const symbol = await token.symbol();
  //const name = await token.name();
  const balanceFormatted = formatUnits(balance, decimals);

  return {
    chainId: supportedToken.chainId,
    balanceAbs: balance.toString(),
    balanceFormatted: balanceFormatted,
    currencyName: symbol,
    currencyAddressNative: supportedToken.address,
  };
}

async function pullTerraBalance(
  chainInfo: ChainConfigInfo,
  walletPrivateKey: string,
  address: string
): Promise<WalletBalance> {
  if (
    !(
      chainInfo.terraChainId &&
      chainInfo.terraCoin &&
      chainInfo.terraGasPriceUrl &&
      chainInfo.terraName
    )
  ) {
    logger.error("Terra relay was called without proper instantiation.");
    throw new Error("Terra relay was called without proper instantiation.");
  }
  const lcdConfig = {
    URL: chainInfo.nodeUrl,
    chainID: chainInfo.terraChainId,
    name: chainInfo.terraName,
  };
  const lcd = new LCDClient(lcdConfig);
  const mk = new MnemonicKey({
    mnemonic: walletPrivateKey,
  });
  const wallet = lcd.wallet(mk);
  const walletAddress = wallet.key.accAddress;

  const tokenInfo: any = await lcd.wasm.contractQuery(address, {
    token_info: {},
  });
  const balanceInfo: any = lcd.wasm.contractQuery(address, {
    balance: {
      address: walletAddress,
    },
  });

  return {
    chainId: CHAIN_ID_TERRA,
    balanceAbs: balanceInfo.balance.toString(),
    balanceFormatted: formatUnits(
      balanceInfo.balance.toString(),
      tokenInfo.decimals
    ),
    currencyName: tokenInfo.symbol,
    currencyAddressNative: address,
  };
}

async function pullSolanaTokenBalances(
  chainInfo: ChainConfigInfo,
  privateKey: Uint8Array
): Promise<WalletBalance[]> {
  const keyPair = Keypair.fromSecretKey(privateKey);
  const connection = new Connection(chainInfo.nodeUrl);
  const output: WalletBalance[] = [];

  const allAccounts = await connection.getParsedTokenAccountsByOwner(
    keyPair.publicKey,
    { programId: TOKEN_PROGRAM_ID },
    "confirmed"
  );
  allAccounts.value.forEach((account) => {
    output.push({
      chainId: CHAIN_ID_SOLANA,
      balanceAbs: account.account.data.parsed?.info?.tokenAmount?.amount,
      balanceFormatted:
        account.account.data.parsed?.info?.tokenAmount?.uiAmount,
      currencyName: "Metadata not pulled",
      currencyAddressNative: account.account.data.parsed?.info?.mint,
    });
  });

  return output;
}

async function pullEVMNativeBalance(
  chainInfo: ChainConfigInfo,
  privateKey: string
): Promise<WalletBalance> {
  if (!privateKey || !chainInfo.nodeUrl) {
    throw new Error("Bad chainInfo config for EVM chain: " + chainInfo.chainId);
  }
  let provider = new ethers.providers.WebSocketProvider(chainInfo.nodeUrl);
  const signer: Signer = new ethers.Wallet(privateKey, provider);
  const weiAmount = await provider.getBalance(signer.getAddress());
  const balanceInEth = ethers.utils.formatEther(weiAmount);

  return {
    chainId: chainInfo.chainId,
    balanceAbs: weiAmount.toString(),
    balanceFormatted: balanceInEth.toString(),
    currencyName: chainInfo.chainName,
    currencyAddressNative: chainInfo.chainName,
  };
}

async function pullTerraNativeBalance(
  chainInfo: ChainConfigInfo,
  privateKey: string
): Promise<WalletBalance[]> {
  const output: WalletBalance[] = [];
  if (
    !(
      chainInfo.terraChainId &&
      chainInfo.terraCoin &&
      chainInfo.terraGasPriceUrl &&
      chainInfo.terraName
    )
  ) {
    logger.error(
      "Terra wallet balance was called without proper instantiation."
    );
    throw new Error(
      "Terra wallet balance was called without proper instantiation."
    );
  }
  const lcdConfig = {
    URL: chainInfo.nodeUrl,
    chainID: chainInfo.terraChainId,
    name: chainInfo.terraName,
  };
  const lcd = new LCDClient(lcdConfig);
  const mk = new MnemonicKey({
    mnemonic: privateKey,
  });
  const wallet = lcd.wallet(mk);
  const walletAddress = wallet.key.accAddress;

  await lcd.bank.balance(walletAddress).then((coins) => {
    // coins doesn't support reduce
    const balancePairs = coins.map(({ amount, denom }) => [denom, amount]);
    const balance = balancePairs.reduce((obj, current) => {
      [obj[current[0].toString()], current[1].toString()];
      return obj;
    }, {} as TerraNativeBalances);
    Object.keys(balance).forEach((key) => {
      output.push({
        chainId: chainInfo.chainId,
        balanceAbs: balance[key],
        balanceFormatted: formatUnits(balance[key], 6).toString(),
        currencyName: key,
        currencyAddressNative: key,
      });
    });
  });
  return output;
}

async function pullSolanaNativeBalance(
  chainInfo: ChainConfigInfo,
  privateKey: Uint8Array
): Promise<WalletBalance> {
  const keyPair = Keypair.fromSecretKey(privateKey);
  const connection = new Connection(chainInfo.nodeUrl);
  const fetchAccounts = await getMultipleAccountsRPC(connection, [
    keyPair.publicKey,
  ]);

  if (!fetchAccounts[0]) {
    throw new Error("Failed to fetch native wallet balance for solana");
  }

  const amountLamports = fetchAccounts[0].lamports.toString();
  const amountSol = formatUnits(
    fetchAccounts[0].lamports,
    WSOL_DECIMALS
  ).toString();

  return {
    chainId: chainInfo.chainId,
    balanceAbs: amountLamports,
    balanceFormatted: amountSol,
    currencyName: chainInfo.chainName,
    currencyAddressNative: chainInfo.chainName,
  };
}
