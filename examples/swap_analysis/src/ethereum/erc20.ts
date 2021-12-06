import { ethers } from 'ethers';


const abi = [
    // Read-Only Functions
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',

    // Authenticated Functions
    'function transfer(address to, uint amount) returns (bool)',

    // Events
    'event Transfer(address indexed from, address indexed to, uint amount)'
];


export async function makeErc20Contract(provider: ethers.providers.JsonRpcProvider, tokenAddress: string): Promise<ethers.Contract> {
    return new ethers.Contract(tokenAddress, abi, provider);
}