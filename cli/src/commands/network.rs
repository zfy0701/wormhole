use colored::Colorize;
use crate::networks;
use structopt::StructOpt;

#[derive(Debug, StructOpt)]
pub struct Network {
    #[structopt(short, long, help = "Dump Network map in a JSON format.")]
    pub json: bool,

    #[structopt(subcommand)]
    pub command: NetworkCommand,
}

#[derive(Debug, StructOpt)]
pub enum NetworkCommand {
    #[structopt(about = "Print full Wormhole network map.")]
    Dump,
}

/// Entrypoint for Network commands.
pub fn process(network: &str, cmd: Network) {
    match cmd.command {
        NetworkCommand::Dump => network_map(network),
    }
}

/// Dump information about the full Wormhole network map.
pub fn network_map(network: &str) {
    // Select NetworkMap and sort it by chain id.
    let network_map = &networks::NETWORKS[network];
    let mut network = network_map.values().collect::<Vec<&networks::Network>>();
    network.sort_by_key(|v| format!("{:?}", v.chain_id.clone()));

    println!("\nWormhole Network Map ({} Networks)", network_map.len());

    // For each network render it in a clean format.
    for n in network {
        println!("\n\
            {: <14} {:?}\n\
            {: <14} {}\n\
            {: <14} {}\n\
            {: <14} {}\n\
            {: <14} {}",
            format!("Network:").blue(),
            n.chain_id,
            format!("Network ID:").blue(),
            n.network_id.unwrap_or(0),
            format!("Wormhole:").blue(),
            n.wormhole,
            format!("Token Bridge:").blue(),
            n.token_bridge,
            format!("NFT Bridge:").blue(),
            n.nft_bridge.unwrap_or("N/A"),
        );
    }
}
