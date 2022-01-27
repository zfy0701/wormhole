use structopt::StructOpt;

mod ethereum;
mod solana;
mod terra;

#[derive(Debug, StructOpt)]
#[structopt(about = "Commands for working with Token Bridge contracts.")]
pub struct TokenBridge {
    #[structopt(subcommand)]
    pub command: TokenBridgeCommand,
}

#[derive(Debug, StructOpt)]
pub enum TokenBridgeCommand {
    #[structopt(about = "Interact with Ethereum Token Bridge")]
    Ethereum {
        #[structopt(short, long, help = "RPC Endpoint for Ethereum Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Avalanche (EVM) Token Bridge")]
    Avalanche {
        #[structopt(short, long, help = "RPC Endpoint for Avalanche Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Binance (EVM) Token Bridge")]
    Binance {
        #[structopt(short, long, help = "RPC Endpoint for Binance Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Polygon (EVM) Token Bridge")]
    Polygon {
        #[structopt(short, long, help = "RPC Endpoint for Polygon Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Oasis (EVM) Token Bridge")]
    Oasis {
        #[structopt(short, long, help = "RPC Endpoint for Oasis Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: ethereum::EthereumCommand,
    },

    #[structopt(about = "Interact with Solana Token Bridge")]
    Solana {
        #[structopt(short, long, default_value = "m", help = "RPC Endpoint for Oasis Web3 Provider.")]
        rpc: String,

        #[structopt(subcommand)]
        command: solana::SolanaCommand,
    },

    #[structopt(about = "Interact with Terra Token Bridge")]
    Terra {
        #[structopt(subcommand)]
        command: terra::TerraCommand,
    },
}

pub async fn process(command: TokenBridge) {
    match command.command {
        // EVM Networks
        TokenBridgeCommand::Avalanche { rpc, command } => ethereum::process(&rpc, "avalanche", command).await,
        TokenBridgeCommand::Binance   { rpc, command } => ethereum::process(&rpc, "binance", command).await,
        TokenBridgeCommand::Ethereum  { rpc, command } => ethereum::process(&rpc, "ethereum", command).await,
        TokenBridgeCommand::Oasis     { rpc, command } => ethereum::process(&rpc, "oasis", command).await,
        TokenBridgeCommand::Polygon   { rpc, command } => ethereum::process(&rpc, "polygon", command).await,

        // Non-EVM Networks
        TokenBridgeCommand::Solana    { rpc, command } => solana::process(&rpc, command).await,
        //TokenBridgeCommand::Terra(cmd)  => terra::process(cmd),
        _ => {},
    };
}
