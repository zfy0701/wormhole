use super::open_contract;
use crate::error::{
    CLIError,
    Result,
};
use web3::contract::Options;
use web3::types::Bytes;

async fn handle(rpc: &str, contract: &str, vaa: &str) -> Result<()> {
    let vaa = &hex::decode(vaa).unwrap();
    let bridge = open_contract(&rpc, contract).await?;
    let is_wrapped: bool = bridge
        .query(
            "completeTransferAndUnwrapETH",
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
