//! Command handler for dumping the current Solana token bridge state.

use std::path::PathBuf;
use std::str::FromStr;

use borsh::BorshDeserialize;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{
    Keypair,
    Signer,
};
use structopt::StructOpt;
use wormhole_sdk::{
    token_bridge,
    Chain,
    DeserializePayload,
    PostVAAData,
    VAA,
};

use crate::error::{
    CLIError,
    Result,
};
use crate::networks;

/// Dumps the Solana Token Bridge state in various formats.
pub async fn process(rpc: &str, contract: &str) -> Result<()> {
    let client = super::rpc_endpoint(rpc);
    let client = solana_client::rpc_client::RpcClient::new(client.into());
    let config = token_bridge::config(&solana_sdk::pubkey::Pubkey::from_str(contract).unwrap());
    let config = client.get_account_data(&config).unwrap();
    let config = token_bridge::Config::try_from_slice(&config).unwrap();

    println!("");
    println!("Token Bridge State\n");
    println!("Bridge: {}", config.wormhole_bridge);
    Ok(())
}

