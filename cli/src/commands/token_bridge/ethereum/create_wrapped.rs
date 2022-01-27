//! Submit a hex-encoded VAA to register asset metadata, this is required before transfers can be
//! made using the underlying token.

use super::open_contract;
use crate::error::{
    CLIError,
    Result,
};
use web3::contract::Options;
use web3::types::Bytes;

pub async fn handle(rpc: &str, contract: &str, vaa: &str) -> Result<()> {
    let bridge = open_contract(&rpc, contract).await?;
    let vaa = &hex::decode(vaa).unwrap();
    let is_wrapped: bool = bridge
        .query(
            "createWrapped",
            (Bytes::from(&**vaa),),
            None,
            Options::default(),
            None,
        )
        .await
        .map_err(|e| CLIError(e.to_string()))?;
    println!("{}", is_wrapped);
    Ok(())
}
