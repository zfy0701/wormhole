//! The Wormhole CLI is an all purpose tool for interacting with Wormhole contracts on various
//! networks, as well as tooling for working with binary data frequently transferred on the
//! Wormhole network itself.
//!
//! The interface is intended to be as intuitive as possible to a user; it should be possible for a
//! user to execute any action they can conceive of using only the `--help` interface.

#![allow(incomplete_features)]
#![feature(if_let_guard)]

use structopt::StructOpt;

mod commands;
mod guardians;
mod networks;
mod types;

#[macro_use]
mod error;

use commands::network;
use commands::vaa;
use commands::token_bridge;

/// Main structopt Options type, entrypoint to the CLI interface.
#[derive(Debug, StructOpt)]
#[structopt(name = "wormhole", about = "The Wormhole All-In-One CLI Toolkit.")]
pub struct Options {
    #[structopt(short, long, default_value="m", about = "Target Wormhole Network [m, t]")]
    network: String,

    #[structopt(subcommand)]
    command: Command,
}

/// Wrapper around all subcommands, structured as a structopt subcommand so that we can have global
/// arguments in the `Options` struct such as network.
#[derive(Debug, StructOpt)]
pub enum Command {
    #[structopt(about = "Command for exploring the Wormhole network map.")]
    Network(network::Network),

    #[structopt(about = "Command for working with the NFT Bridge on all chains.")]
    NFTBridge(token_bridge::TokenBridge),

    #[structopt(about = "Command for working with the Token Bridge on all chains.")]
    TokenBridge(token_bridge::TokenBridge),

    #[structopt(about = "Command for working with raw VAA bytes.")]
    Vaa(vaa::Vaa),
}

#[tokio::main]
async fn main() {
    let options = Options::from_args();
    let network = match &*options.network {
        "m" => "mainnet",
        "t" => "testnet",
        "d" => "devnet",
        _   => {
            println!("Unknown Network {}", options.network);
            return;
        },
    };

    match options.command {
        Command::NFTBridge(cmd) => {
            token_bridge::process(network, cmd).await;
        }

        Command::Network(cmd) => {
            network::process(network, cmd);
        }

        Command::TokenBridge(cmd) => {
            token_bridge::process(network, cmd).await;
        }

        Command::Vaa(cmd) => {
            vaa::vaa(cmd);
        }
    }
}
