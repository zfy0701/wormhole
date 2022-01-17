#![feature(const_generics)]
#![deny(unused_must_use)]

// #![cfg(all(target_arch = "bpf", not(feature = "no-entrypoint")))]

#[cfg(feature = "no-entrypoint")]
pub mod instructions;

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
extern crate wasm_bindgen;

#[cfg(feature = "wasm")]
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub mod wasm;

pub mod accounts;
pub mod api;
pub mod messages;
pub mod types;

pub use api::{
    attest_token,
    complete_native,
    complete_native_with_payload,
    complete_wrapped,
    complete_wrapped_with_payload,
    create_wrapped,
    initialize,
    register_chain,
    transfer_native,
    transfer_native_with_payload,
    transfer_wrapped,
    transfer_wrapped_with_payload,
    upgrade_contract,
    AttestToken,
    AttestTokenData,
    CompleteNative,
    CompleteNativeData,
    CompleteNativeWithPayload,
    CompleteNativeWithPayloadData,
    CompleteWrapped,
    CompleteWrappedData,
    CompleteWrappedWithPayload,
    CompleteWrappedWithPayloadData,
    CreateWrapped,
    CreateWrappedData,
    Initialize,
    InitializeData,
    RegisterChain,
    RegisterChainData,
    TransferNative,
    TransferNativeData,
    TransferNativeWithPayload,
    TransferNativeWithPayloadData,
    TransferWrapped,
    TransferWrappedData,
    TransferWrappedWithPayload,
    TransferWrappedWithPayloadData,
    UpgradeContract,
    UpgradeContractData,
};

use solitaire::*;
use std::error::Error;

pub enum TokenBridgeError {
    AlreadyExecuted,
    InvalidChain,
    InvalidGovernanceKey,
    InvalidMetadata,
    InvalidMint,
    InvalidPayload,
    InvalidUTF8String,
    TokenNotNative,
    UninitializedMint,
    WrongAccountOwner,
    InvalidFee,
    InvalidRecipient,
}

impl From<TokenBridgeError> for SolitaireError {
    fn from(t: TokenBridgeError) -> SolitaireError {
        SolitaireError::Custom(t as u64)
    }
}

solitaire! {
    Initialize(InitializeData) => initialize,
    AttestToken(AttestTokenData) => attest_token,
    CompleteNative(CompleteNativeData) => complete_native,
    CompleteNativeWithPayload(CompleteNativeWithPayloadData) => complete_native_with_payload,
    CompleteWrapped(CompleteWrappedData) => complete_wrapped,
    CompleteWrappedWithPayload(CompleteWrappedWithPayloadData) => complete_wrapped_with_payload,
    TransferWrapped(TransferWrappedData) => transfer_wrapped,
    TransferWrappedWithPayload(TransferWrappedWithPayloadData) => transfer_wrapped_with_payload,
    TransferNative(TransferNativeData) => transfer_native,
    TransferNativeWithPayload(TransferNativeWithPayloadData) => transfer_native_with_payload,
    RegisterChain(RegisterChainData) => register_chain,
    CreateWrapped(CreateWrappedData) => create_wrapped,
    UpgradeContract(UpgradeContractData) => upgrade_contract,
}
