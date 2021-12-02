import { ethers } from 'ethers';


export const infuraMainnetRPC = 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';


export const mainnetProvider = new ethers.providers.JsonRpcProvider(infuraMainnetRPC);