import {Commitment, sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js';
import type {
    Account,
    Connection,
    Transaction,
    TransactionSignature,
} from '@solana/web3.js';
import {WalletContextState} from "@solana/wallet-adapter-react";
import {signSendAndConfirm} from "../../utils/solana";

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
    if (!wallet.signTransaction) {
        throw new Error("wallet.signTransaction is undefined");
      }
    wallet.signTransaction(transaction);

    const options = {
        skipPreflight: false,
        commitment: 'recent' as Commitment,
        preflightCommitment: 'recent' as Commitment,
    };
    const wireTransaction = transaction.serialize();

    return connection.sendRawTransaction(wireTransaction, options)
}