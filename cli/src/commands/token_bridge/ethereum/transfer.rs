use crate::error::{
    CLIError,
    Result,
};
use super::open_contract;
use secp256k1::SecretKey;
use std::convert::TryInto;
use std::path::PathBuf;
use web3::contract::Options;
use web3::types::{
    Address,
    TransactionReceipt,
    U256,
};
use wormhole_sdk::Chain;

/// Transfer describes a Transfer request to the Wormhole bridge.
pub struct Transfer<'r> {
    pub amount:    u64,
    pub chain:     &'r str,
    pub fee:       u64,
    pub recipient: &'r str,
    pub token:     &'r str,
    pub wrap:      bool,
}

/// Transfer initiates a Wormhole transfer message, either by receiving native tokens (such as ETH)
/// and holding them in custody or by transferring ERC20 tokens approved by the user. The resulting
/// VAA is then pulled from the guardians.
pub async fn handle(
    rpc: &str,
    contract: &str,
    transfer: Transfer<'_>,
    _output: Option<PathBuf>,
    key: SecretKey,
) -> Result<()> {
    let bridge = open_contract(&rpc, contract).await?;
    let token: &[u8; 20] = &hex::decode(transfer.token).unwrap().try_into().unwrap();
    let token: Address = token.into();
    let recipient: [u8; 32] = hex::decode(transfer.recipient).unwrap().try_into().unwrap();

    // Allow Web3 Library to fail to deal with inconsistent Web3 APIs that don't all support
    // eth_WatchBlocks method calls.
    let r: Result<TransactionReceipt> = if transfer.wrap {
        let arguments = (
            Chain::Ethereum as u16,
            recipient,
            U256::from(transfer.fee),
            775940u32,
        );

        bridge
            .signed_call_with_confirmations(
                "wrapAndTransferETH",
                arguments,
                Options::with(|o| {
                    o.value = Some(transfer.amount.into());
                }),
                1,
                &key,
            )
            .await
            .map_err(|e| CLIError(e.to_string()))
    } else {
        let arguments = (
            token,
            U256::from(transfer.amount),
            Chain::Ethereum as u16,
            recipient,
            U256::from(transfer.fee),
        );

        bridge
            .signed_call_with_confirmations(
                "transferTokens",
                arguments,
                Options::default(),
                15,
                &key,
            )
            .await
            .map_err(|e| CLIError(e.to_string()))
    };

    // For Web3 endpoints that support watching blocks, track the transaction hash and dump the
    // VAA to stdout/file.
    if let Ok(r) = r {
        let _chain   = Chain::Ethereum;
        let _emitter = contract;
        let _tx_hash = r.transaction_hash.to_string();
    };

    Ok(())
}
