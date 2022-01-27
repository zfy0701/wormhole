//! Reads and dumps the entire Token Bridge state, useful for inspecting the on-chain state for a
//! Wormhole token bridge deploy.

use super::open_contract;
use crate::error::{
    CLIError,
    Result,
};
use std::convert::TryFrom;
use tokio::try_join;
use web3::contract::Options;
use web3::types::Address;
use wormhole_sdk::Chain;

pub async fn handle(rpc: &str, contract: &str) -> Result<()> {
    let bridge = open_contract(&rpc, contract).await?;
    let wormhole = bridge.query("wormhole", (), None, Options::default(), None);
    let chain_id = bridge.query("chainId", (), None, Options::default(), None);
    let governance_chain_id = bridge.query("governanceChainId", (), None, Options::default(), None);
    let governance_bridge = bridge.query("governanceContract", (), None, Options::default(), None);
    let token_impl = bridge.query("tokenImplementation", (), None, Options::default(), None);
    let weth_address = bridge.query("WETH", (), None, Options::default(), None);

    let (wormhole, chain_id, governance_chain_id, governance_bridge, token_impl, weth_address): (
        Address,
        u16,
        u16,
        Vec<u8>,
        Address,
        Address,
    ) = try_join!(
        wormhole,
        chain_id,
        governance_chain_id,
        governance_bridge,
        token_impl,
        weth_address,
    )
    .map_err(|e| CLIError(e.to_string()))?;

    // Print Chain name when possible.
    let chain_name =
        Chain::try_from(chain_id).map_or("Unknown".to_string(), |v| format!("{:?}", v));

    println!("");
    println!("Token Bridge State\n");
    println!("Chain ID:          {} ({})", chain_id, chain_name);
    println!("Gov Chain ID:      {}", governance_chain_id);
    println!("Gov Chain Address: 0x{}", hex::encode(governance_bridge));
    println!("Wormhole Impl:     0x{}", hex::encode(wormhole));
    println!("Token Impl:        0x{}", hex::encode(token_impl));
    println!("WETH Address:      0x{}", hex::encode(weth_address));

    Ok(())
}
