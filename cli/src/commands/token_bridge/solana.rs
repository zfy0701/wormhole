use std::path::PathBuf;
use std::str::FromStr;

use borsh::BorshDeserialize;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{
    Keypair,
    Signer,
};
use structopt::StructOpt;
use wormhole_sdk::{
    Chain,
    DeserializePayload,
    PostVAAData,
    VAA,
};

use crate::error::{
    CLIError,
    Result,
};
use crate::networks;

mod dump;

#[derive(Debug, StructOpt)]
pub enum SolanaCommand {
    #[structopt(about = "Initialize Solana Contract")]
    Initialize,

    #[structopt(about = "Dump current Token Bridge State")]
    Dump,

    #[structopt(about = "Submit VAA to register an AssetMeta")]
    RegisterAsset {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,

        #[structopt(short, long, help = "Hex-encoded secret key for signing transactions.")]
        key: String,
    },

    #[structopt(about = "Submit VAA to register a new chain.")]
    RegisterChain {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,

        #[structopt(short, long, help = "Hex-encoded secret key for signing transactions.")]
        key: String,
    },

    #[structopt(about = "Submit VAA to register a new chain.")]
    ContractUpgrade {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,

        #[structopt(short, long, help = "Hex-encoded secret key for signing transactions.")]
        key: String,
    },

    #[structopt(about = "Submit VAA to complete a transfer.")]
    CompleteTransfer {
        #[structopt(short, long, help = "Hex-encoding of a VAA (without 0x prefix).")]
        vaa: String,

        #[structopt(short, long, help = "Hex-encoded secret key for signing transactions.")]
        key: String,

        #[structopt(short, long, help = "Also unwrap when the token is SOL.")]
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
}

/// Command handler for all commands in the Ethereum namespace.
pub async fn process(network: &str, rpc: &str, command: SolanaCommand) {
    if let Some((_, network)) = networks::NETWORKS[network].get_entry("solana") {
        match command {
            SolanaCommand::Dump => {
                if let Err(CLIError(e)) = dump::process(rpc, network.token_bridge).await {
                    println!("{}", e);
                }
            }

            SolanaCommand::RegisterAsset { vaa, key } => {
                let vaa = &*hex::decode(vaa).unwrap();
                if let Err(CLIError(e)) = register_asset(rpc, network.token_bridge, vaa, key).await
                {
                    println!("{}", e);
                }
            }

            SolanaCommand::RegisterChain { vaa, key } => {
                let vaa = &*hex::decode(vaa).unwrap();
                if let Err(CLIError(e)) = register_chain(rpc, network.token_bridge, vaa, key).await
                {
                    println!("{}", e);
                }
            }

            SolanaCommand::CompleteTransfer { vaa, key, unwrap: _ } => {
                let vaa = &*hex::decode(vaa).unwrap();
                if let Err(CLIError(e)) =
                    complete_transfer(rpc, network.token_bridge, vaa, key).await
                {
                    println!("{}", e);
                }
            }

            SolanaCommand::ContractUpgrade { vaa, key } => {
                let vaa = &*hex::decode(vaa).unwrap();
                if let Err(CLIError(e)) =
                    complete_transfer(rpc, network.token_bridge, vaa, key).await
                {
                    println!("{}", e);
                }
            }

            SolanaCommand::Transfer {
                token,
                amount,
                chain,
                recipient,
                fee,
                key,
                wrap,
                output,
            } => {
                if let Err(CLIError(e)) = transfer(
                    rpc,
                    network.token_bridge,
                    Transfer {
                        chain: &chain,
                        fee: fee.unwrap_or(0),
                        recipient: &recipient,
                        token: &token,
                        amount,
                        wrap,
                    },
                    output,
                    key,
                )
                .await
                {
                    println!("{}", e);
                }
            }

            _ => {}
        }
    }
}

/// Returns a Solana network RPC endpoint, and for any unknown short code simply returns the
/// network itself so users can pass arbitrary URLs on the commandline.
fn rpc_endpoint<'r>(network: &'r str) -> &'r str {
    match network {
        "m" => "https://api.mainnet-beta.solana.com",
        "t" => "https://testnet.solana.com",
        "d" => "https://devnet.solana.com",
        v@_ => v,
    }
}

/// Dump the Token Bridge state, which currently is just a pointer to the core wormhole contract
/// used to emit messages.
async fn dump(rpc: &str, contract: &str) -> Result<()> {
    use wormhole_sdk::token_bridge;
    let rpc = rpc_endpoint(rpc);
    let client = solana_client::rpc_client::RpcClient::new(rpc.into());
    let config = token_bridge::config(&solana_sdk::pubkey::Pubkey::from_str(contract).unwrap());
    let config = client.get_account_data(&config).unwrap();
    let config = token_bridge::Config::try_from_slice(&config).unwrap();

    println!("");
    println!("Token Bridge State\n");
    println!("Bridge: {}", config.wormhole_bridge);
    Ok(())
}

/// Submit an AssetMeta VAA to the Solana Wormhole contract.
async fn register_asset(rpc: &str, contract: &str, vaa: &[u8], key: String) -> Result<()> {
    use wormhole_sdk::solana::token_bridge;

    // Decode Contract Pubkey
    let contract = solana_sdk::pubkey::Pubkey::from_str(contract).unwrap();

    // Open RPC.
    let rpc = rpc_endpoint(rpc);
    let client = solana_client::rpc_client::RpcClient::new(rpc.into());

    // Read Config to find Bridge.
    let config = token_bridge::config(&contract);
    let config = client.get_account_data(&config).unwrap();
    let config = token_bridge::Config::try_from_slice(&config).unwrap();

    // Deserialize incoming VAA and assert that It's an AssetMeta VAA. Construct the PostVAA
    // structure that's needed.
    let vaa = VAA::from_bytes(vaa).unwrap();
    let asset_meta = token_bridge::PayloadAssetMeta::deserialize(&mut vaa.payload.as_slice()).unwrap();

    // Generate Instruction
    let payer = Keypair::from_bytes(&hex::decode(key).unwrap()).unwrap();
    let (message, _) = solana_sdk::pubkey::Pubkey::try_find_program_address(
        &[b"PostedVAA", &vaa.digest().unwrap().hash],
        &contract,
    ).unwrap();

    let instruction = token_bridge::instructions::create_wrapped(
        contract,
        config.wormhole_bridge,
        payer.pubkey(),
        message,
        PostVAAData {
            version: vaa.version,
            guardian_set_index: vaa.guardian_set_index,
            timestamp: vaa.timestamp,
            nonce: vaa.nonce,
            emitter_chain: vaa.emitter_chain as u16,
            emitter_address: vaa.emitter_address,
            sequence: vaa.sequence,
            consistency_level: vaa.consistency_level,
            payload: vaa.payload,
        },
        asset_meta,
        token_bridge::CreateWrappedData {},
    ).unwrap();

    // Sign Instruction with relevant Keypairs.
    let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        client.get_recent_blockhash().unwrap().0,
    );

    client.send_and_confirm_transaction_with_spinner(&tx).unwrap();
    Ok(())
}

/// Submit an RegisterChain VAA to the Solana Wormhole contract.
async fn register_chain(rpc: &str, contract: &str, vaa: &[u8], key: String) -> Result<()> {
    use wormhole_sdk::solana::token_bridge;

    // Decode Contract Pubkey
    let contract = solana_sdk::pubkey::Pubkey::from_str(contract).unwrap();

    // Open RPC.
    let rpc = rpc_endpoint(rpc);
    let client = solana_client::rpc_client::RpcClient::new(rpc.into());

    // Read Config to find Bridge.
    let config = token_bridge::config(&contract);
    let config = client.get_account_data(&config).unwrap();
    let config = token_bridge::Config::try_from_slice(&config).unwrap();

    // Deserialize incoming VAA and assert that It's an AssetMeta VAA. Construct the PostVAA
    // structure that's needed.
    let vaa = VAA::from_bytes(vaa).unwrap();
    let chain_registration = token_bridge::PayloadGovernanceRegisterChain::deserialize(
        &mut vaa.payload.as_slice()
    ).unwrap();

    // Generate Instruction
    let payer = Keypair::from_bytes(&hex::decode(key).unwrap()).unwrap();
    let (message, _) = solana_sdk::pubkey::Pubkey::try_find_program_address(
        &[b"PostedVAA", &vaa.digest().unwrap().hash],
        &contract,
    ).unwrap();

    let instruction = token_bridge::instructions::register_chain(
        contract,
        config.wormhole_bridge,
        payer.pubkey(),
        message,
        PostVAAData {
            version: vaa.version,
            guardian_set_index: vaa.guardian_set_index,
            timestamp: vaa.timestamp,
            nonce: vaa.nonce,
            emitter_chain: vaa.emitter_chain as u16,
            emitter_address: vaa.emitter_address,
            sequence: vaa.sequence,
            consistency_level: vaa.consistency_level,
            payload: vaa.payload,
        },
        chain_registration,
        token_bridge::RegisterChainData {},
    ).unwrap();

    // Sign Instruction with relevant Keypairs.
    let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        client.get_recent_blockhash().unwrap().0,
    );

    client.send_and_confirm_transaction_with_spinner(&tx).unwrap();
    Ok(())
}

/// Submit an RegisterChain VAA to the Solana Wormhole contract.
async fn complete_transfer(rpc: &str, contract: &str, vaa: &[u8], key: String) -> Result<()> {
    use wormhole_sdk::solana::token_bridge;

    // Decode Contract Pubkey
    let contract = solana_sdk::pubkey::Pubkey::from_str(contract).unwrap();

    // Open RPC.
    let rpc = rpc_endpoint(rpc);
    let client = solana_client::rpc_client::RpcClient::new(rpc.into());

    // Read Config to find Bridge.
    let config = token_bridge::config(&contract);
    let config = client.get_account_data(&config).unwrap();
    let config = token_bridge::Config::try_from_slice(&config).unwrap();

    // Deserialize incoming VAA and assert that It's an AssetMeta VAA. Construct the PostVAA
    // structure that's needed.
    let vaa = VAA::from_bytes(vaa).unwrap();
    let transfer = token_bridge::PayloadTransfer::deserialize(
        &mut vaa.payload.as_slice()
    ).unwrap();

    // Generate Instruction
    let payer = Keypair::from_bytes(&hex::decode(key).unwrap()).unwrap();
    let (message, _) = solana_sdk::pubkey::Pubkey::try_find_program_address(
        &[b"PostedVAA", &vaa.digest().unwrap().hash],
        &contract,
    ).unwrap();

    // We only complete native transfers for tokens that originate on Solana.
    let instruction = if transfer.token_chain == Chain::Solana as u16 {
        token_bridge::instructions::complete_native(
            contract,
            config.wormhole_bridge,
            payer.pubkey(),
            message,
            PostVAAData {
                version: vaa.version,
                guardian_set_index: vaa.guardian_set_index,
                timestamp: vaa.timestamp,
                nonce: vaa.nonce,
                emitter_chain: vaa.emitter_chain as u16,
                emitter_address: vaa.emitter_address,
                sequence: vaa.sequence,
                consistency_level: vaa.consistency_level,
                payload: vaa.payload,
            },
            Pubkey::new_from_array(transfer.to),
            Some(Pubkey::new_from_array(transfer.to)),
            Pubkey::new_from_array(transfer.token_address),
            token_bridge::CompleteNativeData {},
        ).unwrap()
    } else {
        token_bridge::instructions::complete_wrapped(
            contract,
            config.wormhole_bridge,
            payer.pubkey(),
            message,
            PostVAAData {
                version: vaa.version,
                guardian_set_index: vaa.guardian_set_index,
                timestamp: vaa.timestamp,
                nonce: vaa.nonce,
                emitter_chain: vaa.emitter_chain as u16,
                emitter_address: vaa.emitter_address,
                sequence: vaa.sequence,
                consistency_level: vaa.consistency_level,
                payload: vaa.payload,
            },
            transfer.clone(),
            Pubkey::new_from_array(transfer.to),
            Some(Pubkey::new_from_array(transfer.to)),
            token_bridge::CompleteWrappedData {},
        ).unwrap()
    };

    // Sign Instruction with relevant Keypairs.
    let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[&payer],
        client.get_recent_blockhash().unwrap().0,
    );

    client.send_and_confirm_transaction_with_spinner(&tx).unwrap();
    Ok(())
}

/// Transfer describes a Transfer request to the Wormhole bridge.
pub struct Transfer<'r> {
    pub amount:    u64,
    pub chain:     &'r str,
    pub fee:       u64,
    pub recipient: &'r str,
    pub token:     &'r str,
    pub wrap:      bool,
}

pub async fn transfer(
    rpc: &str,
    contract: &str,
    transfer: Transfer<'_>,
    _output: Option<PathBuf>,
    key: String,
) -> Result<()> {
    // Derive the transfer token's metadata, if it exists we know the token was attested and so not
    // native to Solana.
    // let contract = Pubkey::from_str(contract).unwrap();
    // let mint_key = Pubkey::new(hex::decode(transfer.token).unwrap());
    // let meta_key = Pubkey::try_find_program_address(
    //     &[b"meta", mint_key.0.as_bytes()],
    //     &contract,
    // ).unwrap();

    // // Open RPC.
    // let rpc = rpc_endpoint(rpc);
    // let rpc = solana_client::rpc_client::RpcClient::new(rpc.into());

    // // Read Config to find Bridge.
    // let config = token_bridge::config(&contract);
    // let config = client.get_account_data(&config).unwrap();
    // let config = token_bridge::Config::try_from_slice(&config).unwrap();

    // // Generate Instruction
    // let payer = Keypair::from_bytes(&hex::decode(key).unwrap()).unwrap();
    // let message = Keypair::new();

    // // If the Meta key exists we know the asset is wrapped from another chain, so we can choose
    // // which transfer method to invoke.
    // let instruction = if rpc.get_account_data(&meta_key).is_ok() {
    //     transfer_wrapped(
    //         contract,
    //         config.wormhole_bridge,
    //         payer.pubkey(),
    //         message,
    //         unimplemented!(),
    //         unimplemented!(),
    //         unimplemented!(),
    //         mint_key,
    //         token_bridge::TransferWrappedData {}
    //     )
    // } else {
    //     transfer_native(
    //         contract,
    //         config.wormhole_bridge,
    //         payer.pubkey(),
    //         message,
    //         unimplemented!(),
    //         mint_key,
    //         token_bridge::TransferNativeData {}
    //     )
    // };

    Ok(())
}
