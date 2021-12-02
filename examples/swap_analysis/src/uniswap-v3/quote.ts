import { ethers } from "ethers";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";

import { mainnetProvider } from "../metamask"


const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";


export function makeMainnetQuoterContract() {
    return new ethers.Contract(quoterAddress, QuoterABI, mainnetProvider);
}