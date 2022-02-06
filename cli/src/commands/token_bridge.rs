//! Provide entrypoints to each network that Wormhole supports. For EVM chains there's a separate
//! command per network, even though these all use the underlying command. This is just to provide
//! a more intuitive CLI interface to users instead of calling it "ethereum" for all networks
//! despite being EVM.
 
use structopt::StructOpt;

mod ethereum;
mod solana;
mod terra;

#[derive(Debug, StructOpt)]
pub struct TokenBridge {
    #[structopt(subcommand)]
    pub command: TokenBridgeCommand,
}

#[derive(Debug, StructOpt)]
pub enum TokenBridgeCommand {
    #[structopt(about = "Interact with Ethereum Token Bridge")]
    Ethereum {
        #[structopt(short, long, help = "URI for Ethereum Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Avalanche (EVM) Token Bridge")]
    Avalanche {
        #[structopt(short, long, help = "URI for Avalanche Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Binance (EVM) Token Bridge")]
    Binance {
        #[structopt(short, long, help = "URI for Binance Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Polygon (EVM) Token Bridge")]
    Polygon {
        #[structopt(short, long, help = "URI for Polygon Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Oasis (EVM) Token Bridge")]
    Oasis {
        #[structopt(short, long, help = "URI for Oasis Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Solana Token Bridge")]
    Solana {
        #[structopt(short, long, default_value = "m", help = "URI for Solana RPC Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: solana::SolanaCommand,
    },

    #[structopt(about = "Interact with Terra Token Bridge")]
    Terra {
        #[structopt(short, long, default_value = "m", help = "URI for Terra LCD/FCD Endpoint.")]
        rpc: String,

        #[structopt(subcommand)]
        command: terra::TerraCommand,
    },
}

pub async fn process(network: &str, command: TokenBridge) {
    match command.command {
        // EVM Networks
        TokenBridgeCommand::Avalanche { rpc, command } => {
            ethereum::process(network, &rpc, "avalanche", command).await
        }

        TokenBridgeCommand::Binance { rpc, command } => {
            ethereum::process(network, &rpc, "binance", command).await
        }

        TokenBridgeCommand::Ethereum { rpc, command } => {
            ethereum::process(network, &rpc, "ethereum", command).await
        }

        TokenBridgeCommand::Oasis { rpc, command } => {
            ethereum::process(network, &rpc, "oasis", command).await
        }

        TokenBridgeCommand::Polygon { rpc, command } => {
            ethereum::process(network, &rpc, "polygon", command).await
        }

        // Non-EVM Networks
        TokenBridgeCommand::Solana { rpc, command } => {
            solana::process(network, &rpc, command).await
        }

        TokenBridgeCommand::Terra { rpc: _, command: _ } => {
        }
    };
}
