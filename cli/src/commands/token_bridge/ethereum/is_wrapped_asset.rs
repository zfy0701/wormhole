//! Checks if an ETH-style address is a a Wormhole wrapped asset.

use super::open_contract;
use crate::error::{
    CLIError,
    Result,
};
use std::convert::TryInto;
use web3::contract::Options;
use web3::types::Address;

/// Given an address, checks if the asset is an ERC20 contract representing a Wormhole asset.
pub async fn handle(rpc: &str, contract: &str, addr: &str) -> Result<()> {
    let addr: &[u8; 20] = &hex::decode(addr).unwrap().try_into().unwrap();
    let addr: Address = addr.into();
    let bridge = open_contract(&rpc, contract).await?;
    let is_wrapped: bool = bridge
        .query("isWrappedAsset", (addr,), None, Options::default(), None)
        .await
        .map_err(|e| CLIError(e.to_string()))?;
    println!("{}", is_wrapped);
    Ok(())
}
