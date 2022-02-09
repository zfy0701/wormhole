//! Address types for safe parsing for various networks.

use crate::error::CLIError;
use crate::require;
use bech32::FromBase32;
use solana_sdk::bs58::decode;
use std::str::FromStr;

pub trait Address: FromStr + From<Self> {}
impl<T: FromStr + From<Self>> Address for T {}

/// Ethereum Address type, which makes it easier to parse H160 formatted addresses from command
/// line string inputs.
pub struct EthereumAddress(String);

impl FromStr for EthereumAddress {
    type Err = CLIError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Remove 0x only if present, result should be a 40 byte hex string for a 20 byte H160
        // encoded address.
        let s = s.trim_start_matches("0x");
        require!(s.len() == 40, CLIError("Unexpected hex length".to_string()));
        Ok(Self(s.to_string()))
    }
}

impl From<EthereumAddress> for Vec<u8> {
    fn from(other: EthereumAddress) -> Vec<u8> {
        hex::decode(other.0).unwrap()
    }
}

/// Oasis Address type, which makes it easier to parse Oasis bech32 formatted addresses from
/// command line string inputs.
pub struct OasisAddress(String);

impl FromStr for OasisAddress {
    type Err = CLIError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        require!(s.starts_with("oasis"), "Key must begin with 'oasis'".into());
        Ok(Self(s.to_string()))
    }
}

impl From<OasisAddress> for Vec<u8> {
    fn from(other: OasisAddress) -> Vec<u8> {
        Vec::<u8>::from_base32(&bech32::decode(&other.0).unwrap().1).unwrap()
    }
}

/// Solana Address type, which makes it easier to parse Base58 formatted addresses from command
/// line string inputs.
pub struct SolanaAddress(String);

impl FromStr for SolanaAddress {
    type Err = CLIError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        require!(decode(s).into_vec().is_ok(), "Key is invalid Base58".into());
        Ok(Self(s.to_string()))
    }
}

impl From<SolanaAddress> for Vec<u8> {
    fn from(other: SolanaAddress) -> Vec<u8> {
        decode(other.0).into_vec().unwrap()
    }
}

/// Terra Address type, which makes it easier to parse Terra bech32 formatted addresses from
/// command line string inputs.
pub struct TerraAddress(String);

impl FromStr for TerraAddress {
    type Err = CLIError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        require!(s.starts_with("terra"), "Key must begin with 'terra'".into());
        Ok(Self(s.to_string()))
    }
}

impl From<TerraAddress> for Vec<u8> {
    fn from(other: TerraAddress) -> Vec<u8> {
        Vec::<u8>::from_base32(&bech32::decode(&other.0).unwrap().1).unwrap()
    }
}
