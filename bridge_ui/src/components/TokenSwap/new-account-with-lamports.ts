// @flow

import {Account, Connection, Keypair} from '@solana/web3.js';

import {readFileSync} from "fs";

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readKeypairFromPath(path: string): Keypair {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return Keypair.fromSecretKey(Buffer.from(data));
}

export async function readAccountWithLamports2(
    connection: Connection,
    key : number[],
    lamports: number = 1000000,
): Promise<Account> {
    const account = new Account(Keypair.fromSecretKey(Buffer.from(key)).secretKey);
    console.log(account.publicKey.toString());
    if (lamports == 0) {
        return account;
    }

    let retries = 30;
    const signature = await connection.requestAirdrop(account.publicKey, lamports);
    await connection.confirmTransaction(signature);
    for (;;) {
        await sleep(500);
        const balance = (await connection.getBalance(account.publicKey));
        console.log(balance);
        if (lamports <= balance) {
            return account;
        }
        if (--retries <= 0) {
            break;
        }
    }
    throw new Error(`Airdrop of ${lamports} failed`);
}


export async function readAccountWithLamports(
    connection: Connection,
    path : string,
    lamports: number = 1000000,
): Promise<Account> {
    const account = new Account(readKeypairFromPath(path).secretKey);
    console.log(account.publicKey.toString());
    if (lamports == 0) {
        return account;
    }

    let retries = 30;
    const signature = await connection.requestAirdrop(account.publicKey, lamports);
    await connection.confirmTransaction(signature);
    for (;;) {
        await sleep(500);
        const balance = (await connection.getBalance(account.publicKey));
        console.log(balance);
        if (lamports <= balance) {
            return account;
        }
        if (--retries <= 0) {
            break;
        }
    }
    throw new Error(`Airdrop of ${lamports} failed`);
}

export async function newAccountWithLamports(
    connection: Connection,
    lamports: number = 1000000,
): Promise<Account> {
    const account = new Account();

    let retries = 30;
    await connection.requestAirdrop(account.publicKey, lamports);
    for (;;) {
        await sleep(500);
        if (lamports == (await connection.getBalance(account.publicKey))) {
            return account;
        }
        if (--retries <= 0) {
            break;
        }
    }
    throw new Error(`Airdrop of ${lamports} failed`);
}