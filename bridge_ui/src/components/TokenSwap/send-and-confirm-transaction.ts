import type {Account, Connection, Transaction, TransactionSignature,} from '@solana/web3.js';
import {Commitment, PublicKey, sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js';
import {WalletContextState} from "@solana/wallet-adapter-react";

export function sendAndConfirmTransaction(
    title: string,
    connection: Connection,
    transaction: Transaction,
    ...signers: Array<Account>
): Promise<TransactionSignature> {
    return realSendAndConfirmTransaction(connection, transaction, signers, {
        skipPreflight: false,
        commitment: 'recent',
        preflightCommitment: 'recent',
    });
}

export async function sendAndConfirmTransaction2(
    title: string,
    connection: Connection,
    transaction: Transaction,
    wallet: WalletContextState
): Promise<TransactionSignature> {
    if (!wallet.signTransaction || !wallet.publicKey) {
        throw new Error("wallet.signTransaction is undefined or wallet pubkey empty");
      }
    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    transaction.feePayer = new PublicKey(wallet.publicKey)

    await wallet.signTransaction(transaction);

    // const options = {
    //     skipPreflight: false,
    //     commitment: 'recent' as Commitment,
    //     preflightCommitment: 'recent' as Commitment,
    // };

    const txid = await connection.sendRawTransaction(transaction.serialize())
    await connection.confirmTransaction(txid);
    return txid;
}