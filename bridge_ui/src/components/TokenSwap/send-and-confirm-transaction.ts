import {sendAndConfirmTransaction as realSendAndConfirmTransaction} from '@solana/web3.js';
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

export function sendAndConfirmTransaction2(
    title: string,
    connection: Connection,
    transaction: Transaction,
    signers: WalletContextState
): Promise<TransactionSignature> {
    return signSendAndConfirm(signers, connection, transaction);

    // return realSendAndConfirmTransaction(connection, transaction, signers, {
    //     skipPreflight: false,
    //     commitment: 'recent',
    //     preflightCommitment: 'recent',
    // });
}