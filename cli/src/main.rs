#![feature(if_let_guard)]

use structopt::StructOpt;
use commands::vaa;
use commands::token_bridge;

mod commands;
mod error;
mod guardians;
mod networks;

#[derive(Debug, StructOpt)]
#[structopt(name = "wormhole", about = "The Wormhole All-In-One CLI Toolkit.")]
pub enum Options {
    #[structopt(about = "Display full wormhole network map.")]
    Network,

    NFTBridge(token_bridge::TokenBridge),
    TokenBridge(token_bridge::TokenBridge),
    Vaa(vaa::Vaa),
}

#[tokio::main]
async fn main() {
    match Options::from_args() {
        Options::Vaa(cmd)         => { vaa::vaa(cmd); }
        Options::TokenBridge(cmd) => { token_bridge::process(cmd).await; }
        Options::NFTBridge(cmd)   => { token_bridge::process(cmd).await; }
        Options::Network          => { network_map(); }
    }
}

/// Dump information about the full Wormhole network map.
pub fn network_map() {
    println!("");
    println!("Wormhole Network Map ({} Networks)", networks::NETWORKS.len());

    let mut networks = networks::NETWORKS.values().collect::<Vec<&networks::Network>>();
    networks.sort_by_key(|v| v.chain_id.clone() as u16);
    for network in networks {
        println!("\n\
            Network:      {:?}\n\
            Network ID:   {}\n\
            Wormhole:     {}\n\
            Token Bridge: {}\n\
            NFT Bridge:   {}",
            network.chain_id,
            network.network_id.unwrap_or(0),
            network.wormhole,
            network.token_bridge,
            network.nft_bridge.unwrap_or(""),
        );
    }
}
