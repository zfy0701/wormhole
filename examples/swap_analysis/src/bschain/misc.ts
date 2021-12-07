import { ethers } from 'ethers';


export const CHAIN_ID = 56;

// binance
export const infuraMainnetRPC = 'https://bsc-dataseed1.ninicoin.io/';


export const mainnetProvider = new ethers.providers.JsonRpcProvider(infuraMainnetRPC);