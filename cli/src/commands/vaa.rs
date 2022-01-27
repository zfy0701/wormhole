use colored::Colorize;
use secp256k1::recovery::{
    RecoverableSignature,
    RecoveryId,
};
use secp256k1::{Message, Secp256k1};
use sha3::Digest;
use structopt::StructOpt;

use wormhole_sdk::vaa::{
    core,
    nft,
    token,
    VAA,
};

#[derive(Debug, StructOpt)]
#[structopt(about = "Generic helpers for working with VAA objects.")]
pub struct Vaa {
    #[structopt(short, long, help = "Dump VAA parsing in JSON format.")]
    pub json: bool,

    #[structopt(subcommand)]
    pub command: VaaCommand,
}

#[derive(Debug, StructOpt)]
pub enum VaaCommand {
    #[structopt(about = "Parse VAA and print in various readable formats")]
    Dump { vaa: String },
}

pub fn vaa(vaa: Vaa) {
    match vaa.command {
        VaaCommand::Dump { vaa } => {
            // Parse VAA.
            let decode = hex::decode(vaa).unwrap();
            let parsed = VAA::from_bytes(decode.clone()).unwrap();
            let digest = parsed.digest().unwrap();

            render_vaa(&parsed, &decode, &digest.hash);
            render_digest(&parsed, &digest.digest);
            render_payload(&parsed.payload);
        }
    }
}

// A small row printer that itertes over a byte slice with a position cursor. Could be better
// implemented than this but it's quick.
fn print_row<'r>(buffer: &mut (usize, &[u8]), len: usize, name: &str) {
    let bytes = &buffer.1[0..len];
    println!(
        " {} {} | {}",
        format!("{:04}:", buffer.0).blue(),
        format!("{:12}", name),
        format!(
            "{:32}",
            hex::encode(bytes)
                .chars()
                .collect::<Vec<char>>()
                .chunks(8)
                .map(|c| c.iter().collect::<String>())
                .collect::<Vec<String>>()
                .join(" ")
                .green()
        ),
    );
    buffer.0 = buffer.0 + len;
    buffer.1 = &buffer.1[len..];
}

fn render_digest(parsed: &VAA, digest: &[u8]) {
    println!("Dumping Digest, {} Bytes\n", digest.len());
    let mut buffer: (usize, &[u8]) = (0, &digest);
    print_row(&mut buffer, 4, "Timestamp");
    print_row(&mut buffer, 4, "Nonce");
    print_row(&mut buffer, 2, "Chain");
    print_row(&mut buffer, 32, "Emitter");
    print_row(&mut buffer, 8, "Sequence");
    print_row(&mut buffer, 1, "Consistency");

    for chunk in parsed.payload.chunks(32) {
        print_row(&mut buffer, chunk.len(), "Payload");
    }
}

fn render_vaa(parsed: &VAA, decode: &[u8], hash: &[u8]) {
    // Secp256k1 hash material.
    let secp256k1_hash: [u8; 32] = {
        let mut hasher = sha3::Keccak256::default();
        hasher.update(hash);
        hasher.finalize().into()
    };

    // Pretty print all signature rows, showing associated public keys when possible.
    let secp = Secp256k1::new();
    let signatures = parsed
        .signatures
        .iter()
        .fold(String::new(), |accum, signature| {
            // Recover PublicKey from Signature, first byte is RecoveryId.
            let pubkey: [u8; 32] = {
                let compressed = secp
                    .recover(
                        &Message::from_slice(&secp256k1_hash).unwrap(),
                        &RecoverableSignature::from_compact(
                            &signature[1..=64],
                            RecoveryId::from_i32(signature[65].into()).unwrap(),
                        )
                        .unwrap(),
                    )
                    .unwrap();

                let mut hasher = sha3::Keccak256::default();
                hasher.update(&compressed.serialize_uncompressed()[1..]);
                hasher.finalize().into()
            };

            // Render Signature alongside its Public key.
            let encoded_key = &hex::encode(&pubkey[12..]);
            format!(
                "{} {} | 0x{}... | {}\n",
                accum,
                format!("{:04}", signature[0]).blue(),
                &encoded_key[..6],
                signer(encoded_key).green(),
            )
        });

    println!("\nDumping VAA, {} Bytes\n", decode.len());
    let mut buffer: (usize, &[u8]) = (0, &decode);
    print_row(&mut buffer, 1, "Version");
    print_row(&mut buffer, 4, "Index");
    print_row(&mut buffer, 1, "Siglen");

    // Render Signatures with Public Keys
    for (i, signature) in parsed.signatures.iter().enumerate() {
        print_row(&mut buffer, 66, &format!("Sig {}", parsed.signatures[i][0]));
    }

    print_row(&mut buffer, 4, "Timestamp");
    print_row(&mut buffer, 4, "Nonce");
    print_row(&mut buffer, 2, "Chain");
    print_row(&mut buffer, 32, "Emitter");
    print_row(&mut buffer, 8, "Sequence");
    print_row(&mut buffer, 1, "Consistency");

    println!("\nSigners ({}):\n", parsed.signatures.len());
    println!("{}", signatures);
}

/// Mapping of known Guardian keys to their public node name.
fn signer(key: &str) -> &'static str {
    match key {
        // Devnet Guardians
        "befa429d57cd18b7f8a4d91a2da9ab4af05d0fbe" => "Devnet",

        // Production Guardians
        "000ac0076727b35fbea2dac28fee5ccb0fea768e" => "Staking Fund",
        "107a0086b32d7a0977926a205131d8731d39cbeb" => "ChainodeTech",
        "114de8460193bdf3a2fcf81f86a09765f4762fd1" => "Figment",
        "11b39756c042441be6d8650b69b54ebe715e2343" => "HashQuark",
        "178e21ad2e77ae06711549cfbb1f9c7a9d8096e8" => "syncnode",
        "54ce5b4d348fb74b958e8966e2ec3dbd4958a7cd" => "ChainLayer",
        "58cc3ae5c097b213ce3c81979e1b9f9570746aa5" => "Certus One",
        "5e1487f35515d02a92753504a8d75471b9f49edb" => "Triton",
        "6fbebc898f403e4773e95feb15e80c9a99c8348d" => "Staking Facilities",
        "71aa1be1d36cafe3867910f99c09e347899c19c3" => "Everstake",
        "74a3bf913953d695260d88bc1aa25a4eee363ef0" => "Forbole",
        "8c82b2fd82faed2711d59af0f2499d16e726f6b2" => "Inotel",
        "af45ced136b9d9e24903464ae889f5c8a723fc14" => "MoonletWallet",
        "d2cc37a4dc036a8d232b48f62cdd4731412f4890" => "01node",
        "da798f6896a3331f64b48c12d1d57fd9cbe70811" => "MCF-V2-MAINNET",
        "eb5f7389fa26941519f0863349c223b73a6ddee7" => "DokiaCapital",
        "f93124b7c738843cbb89e864c862c38cddcccf95" => "P2P Validator",
        "ff6cb952589bde862c25ef4392132fb9d4a42157" => "Staked",

        // Unknown Guardian
        _ => { "Unknown Guardian" },
    }
}

/// Attempts to decode the VAA Payload in any of the known formats, if none just column format the
/// hex for readability. Rather than a trait on the VAA we render each possible variant here
/// in-line, this is so we don't inadvertantly define a defacto rendering for VAAs.
fn render_payload(payload: &[u8]) {
    use wormhole_sdk::vaa::GovernanceAction;

    print!("\nDumping Payload: ");

    match payload {
        // TokenBridge: Transfer
        payload if let Ok(_r) = token::Transfer::from_bytes(payload) => {
            println!("TokenBridge Transfer, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "Amount");
            print_row(&mut buffer, 32, "Origin");
            print_row(&mut buffer, 2, "Origin Chain");
            print_row(&mut buffer, 32, "Destination");
            print_row(&mut buffer, 2, "Dest Chain");
            print_row(&mut buffer, 32, "Fee");
        }

        // TokenBridge: Attest
        payload if let Ok(r) = token::AssetMeta::from_bytes(payload) => {
            println!("TokenBridge Attest, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "Address");
            print_row(&mut buffer, 2, "Chain");
            print_row(&mut buffer, 32, "Symbol");
            print_row(&mut buffer, 32, "Name");
        }

        // TokenBridge: RegisterChain
        payload if let Ok((_, r)) = token::GovernanceRegisterChain::from_bytes(payload, None) => {
            println!("TokenBridge RegisterChain, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 2, "Chain");
            print_row(&mut buffer, 32, "Endpoint");
        }

        // TokenBridge: Upgrade
        payload if let Ok((_, r)) = token::GovernanceContractUpgrade::from_bytes(payload, None) => {
            println!("TokenBridge Upgrade, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "New Contract");
        }

        // NFTBridge: Transfer
        payload if let Ok(r) = nft::Transfer::from_bytes(payload) => {
            println!("NFTBridge Transfer, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "Origin");
            print_row(&mut buffer, 2, "Origin Chain");
            print_row(&mut buffer, 32, "Symbol");
            print_row(&mut buffer, 32, "Name");
        }

        // NFTBridge: RegisterChain
        payload if let Ok((_, r)) = nft::GovernanceRegisterChain::from_bytes(payload, None) => {
            println!("NFTBridge RegisterChain, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 2, "Chain");
            print_row(&mut buffer, 32, "Endpoint");
        }

        // NFTBridge: Upgrade
        payload if let Ok((_, r)) = nft::GovernanceContractUpgrade::from_bytes(payload, None) => {
            println!("NFTBridge Upgrade, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "Endpoint");
        }

        // Core: Upgrade
        payload if let Ok((_, r)) = core::GovernanceContractUpgrade::from_bytes(payload, None) => {
            println!("Core Upgrade, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Type");
            print_row(&mut buffer, 32, "Address");
        }

        payload if let Ok((_, r)) = core::GovernanceGuardianSetChange::from_bytes(payload, None) => {
            println!("Core GuardianSetChange, {} Bytes\n", payload.len());
            let mut buffer: (usize, &[u8]) = (0, &payload);
            print_row(&mut buffer, 32, "Module");
            print_row(&mut buffer, 1, "Action");
            print_row(&mut buffer, 2, "Chain");
            print_row(&mut buffer, 4, "NewGuardianSetIndex");
            let len = buffer.1[0];
            print_row(&mut buffer, 1, "NewGuardianSetLen");
            let mut i = 0;
            while i < len {
                  print_row(&mut buffer, 20, "key");
                  i = i + 1;
            }           
        }

        payload if let Ok((_, r)) = core::GovernanceSetMessageFee::from_bytes(payload, None) => {
            println!("Core SetMessageFee, {} Bytes\n", payload.len());
        }

        payload if let Ok((_, r)) = core::GovernanceTransferFees::from_bytes(payload, None) => {
            println!("Core TransferFees, {} Bytes\n", payload.len());
        }

        _ => { 
            format!("\n{:x?}", payload); 
        },
    }
}
