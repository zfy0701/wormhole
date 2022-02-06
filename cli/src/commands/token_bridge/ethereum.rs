use crate::networks;
use crate::error::{
    CLIError,
    Result,
};

use secp256k1::SecretKey;
use std::convert::TryInto;
use std::path::PathBuf;
use std::str::FromStr;
use structopt::StructOpt;
use web3::contract::Contract;

mod complete_transfer;
mod complete_transfer_and_unwrap;
mod create_wrapped;
mod dump;
mod is_wrapped_asset;
mod transfer;

#[derive(Debug, StructOpt)]
pub enum EthereumCommand {
    #[structopt(about = "Dump current Token Bridge State")]
    Dump,

    #[structopt(about = "Submit VAA to register an AssetMeta.")]
    RegisterAsset {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,
    },

    #[structopt(about = "Submit VAA to register a new chain.")]
    RegisterChain {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,
    },

    #[structopt(about = "Submit VAA to complete a contract upgrade.")]
    ContractUpgrade {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,
    },

    #[structopt(about = "Submit VAA to complete a cross-chain transfer.")]
    CompleteTransfer {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,

        #[structopt(short, long, help = "Also unwrap when the token is WETH.")]
        unwrap: bool,
    },

    #[structopt(about = "Initiate a Transfer")]
    Transfer {
        #[structopt(short, long, help = "Amount of tokens to transfer.")]
        amount: u64,

        #[structopt(short, long, help = "Name of the target chain to transfer to.")]
        chain: String,

        #[structopt(short, long, help = "Optional fee to pay relayers for completing this transfer.")]
        fee: Option<u64>,

        #[structopt(short, long, help = "Hex-encoded secret key for signing transactions.")]
        key: String,

        #[structopt(short, long, help = "Hex-encoded address of the token to transfer.")]
        token: String,

        #[structopt(short, long, help = "Hex-encoded address of the receiving address on the target chain.")]
        recipient: String,

        #[structopt(short, long, help = "Whether to wrap the token before transfer; must be the native token.")]
        wrap: bool,

        #[structopt(short, long, help = "Where to store the produced VAA.")]
        output: Option<PathBuf>,
    },

    #[structopt(about = "Check if an Address is a wrapped asset.")]
    IsWrappedAsset {
        #[structopt(short, long, help = "Address of the asset to check.")]
        address: String,
    },
}

/// Command handler for all commands in the Ethereum namespace.
pub async fn process(network: &str, rpc: &str, chain: &str, command: EthereumCommand) {
    // Select Wormhole network map.
    let network_map = &networks::NETWORKS[network];

    // If the requested chain is present in this network map, expose CLI interface.
    if let Some(network) = network_map.get(chain) {
        match command {
            EthereumCommand::Dump => {
                if let Err(CLIError(e)) = dump::handle(rpc, network.token_bridge).await {
                    println!("{}", e);
                }
            }

            EthereumCommand::Transfer {
                token,
                amount,
                chain,
                recipient,
                fee,
                key,
                wrap,
                output,
            } => {
                if let Err(CLIError(e)) = transfer::handle(
                    rpc,
                    network.token_bridge,
                    transfer::Transfer {
                        chain: &chain,
                        fee: fee.unwrap_or(0),
                        recipient: &recipient,
                        token: &token,
                        amount,
                        wrap,
                    },
                    output,
                    SecretKey::from_str(&key).unwrap(),
                )
                .await
                {
                    println!("{}", e);
                }
            }

            EthereumCommand::RegisterAsset { vaa } => {
                if let Err(CLIError(e)) =
                    create_wrapped::handle(rpc, network.token_bridge, &vaa).await
                {
                    println!("{}", e);
                }
            }

            EthereumCommand::RegisterChain { vaa } => {
                if let Err(CLIError(e)) =
                    create_wrapped::handle(rpc, network.token_bridge, &vaa).await
                {
                    println!("{}", e);
                }
            }

            EthereumCommand::ContractUpgrade { vaa } => {
                if let Err(CLIError(e)) =
                    create_wrapped::handle(rpc, network.token_bridge, &vaa).await
                {
                    println!("{}", e);
                }
            }

            EthereumCommand::CompleteTransfer { vaa, unwrap: _ } => {
                if let Err(CLIError(e)) =
                    complete_transfer::handle(rpc, network.token_bridge, &vaa).await
                {
                    println!("{}", e);
                }
            }

            EthereumCommand::IsWrappedAsset { address } => {
                if let Err(CLIError(e)) =
                    is_wrapped_asset::handle(rpc, network.token_bridge, &address).await
                {
                    println!("{}", e);
                }
            }
        }
    }
}

/// Helper method for creating a Wormhole TokenBridge interface against a Web3 RPC connection, the
/// ABI is taken from compiling the Ethereum contracts with truffle. BridgeImplementation exposes
/// all relevant TokenBridge methods.
async fn open_contract(rpc: &str, addr: &str) -> Result<Contract<web3::transports::Http>> {
    let websocket = web3::transports::Http::new(&rpc).map_err(|e| CLIError(e.to_string()))?;
    let web3 = web3::Web3::new(websocket);
    let addr: &[u8; 20] = &hex::decode(addr).unwrap().try_into().unwrap();
    web3::contract::Contract::from_json(
        web3.eth(),
        addr.into(),
        include_bytes!("./BridgeImplementation.json"),
    )
    .map_err(|e| CLIError(e.to_string()))
}
