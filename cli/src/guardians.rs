use phf::{Map, phf_map};
use rand::seq::SliceRandom;

/// Metadata describing Guardian nodes.
pub struct Guardian {
    pub name: &'static str,
    pub rpc:  Option<&'static str>,
}

/// Mapping of network name to guardian details. Static map means this is exhaustively checked at
/// compile time when used through the codebase.
pub type GuardianMap = Map<&'static str, Guardian>;

/// Network Groupings.
pub static NETWORKS: Map<&'static str, &'static GuardianMap> = phf_map! {
    "mainnet" => &MAINNET,
    "testnet" => &TESTNET,
};

/// Mainnet Guardian Definitions
pub static MAINNET: GuardianMap = phf_map! {
    "000ac0076727b35fbea2dac28fee5ccb0fea768e" => Guardian {
        name: "Staking Fund",
        rpc:  Some("https://wormhole-v2-mainnet-api.staking.fund"),
    },

    "107a0086b32d7a0977926a205131d8731d39cbeb" => Guardian {
        name: "ChainodeTech",
        rpc: None,
    },

    "114de8460193bdf3a2fcf81f86a09765f4762fd1" => Guardian {
        name: "Figment",
        rpc:  None,
    },

    "11b39756c042441be6d8650b69b54ebe715e2343" => Guardian {
        name: "HashQuark",
        rpc:  None,
    },

    "178e21ad2e77ae06711549cfbb1f9c7a9d8096e8" => Guardian {
        name: "syncnode",
        rpc:  None,
    },

    "54ce5b4d348fb74b958e8966e2ec3dbd4958a7cd" => Guardian {
        name: "ChainLayer",
        rpc:  Some("https://wormhole-v2-mainnet-api.chainlayer.network"),
    },

    "58cc3ae5c097b213ce3c81979e1b9f9570746aa5" => Guardian {
        name: "Certus One",
        rpc:  Some("https://wormhole-v2-mainnet-api.certus.one"),
    },

    "5e1487f35515d02a92753504a8d75471b9f49edb" => Guardian {
        name: "Triton",
        rpc:  None
    },

    "6fbebc898f403e4773e95feb15e80c9a99c8348d" => Guardian {
        name: "Staking Facilities",
        rpc:  None
    },

    "71aa1be1d36cafe3867910f99c09e347899c19c3" => Guardian {
        name: "Everstake",
        rpc:  None
    },

    "74a3bf913953d695260d88bc1aa25a4eee363ef0" => Guardian {
        name: "Forbole",
        rpc:  None
    },

    "8c82b2fd82faed2711d59af0f2499d16e726f6b2" => Guardian {
        name: "Inotel",
        rpc:  Some("https://wormhole.inotel.ro"),
    },

    "af45ced136b9d9e24903464ae889f5c8a723fc14" => Guardian {        
        name: "MoonletWallet",
        rpc:  None
    },

    "d2cc37a4dc036a8d232b48f62cdd4731412f4890" => Guardian {
        name: "01node",
        rpc:  None
    },

    "da798f6896a3331f64b48c12d1d57fd9cbe70811" => Guardian {
        name: "MCF-V2-MAINNET",
        rpc:  Some("https://wormhole-v2-mainnet-api.mcf.rocks"),
    },

    "eb5f7389fa26941519f0863349c223b73a6ddee7" => Guardian {
        name: "DokiaCapital",
        rpc:  None
    },

    "f93124b7c738843cbb89e864c862c38cddcccf95" => Guardian {
        name: "P2P Validator",
        rpc:  None
    },

    "ff6cb952589bde862c25ef4392132fb9d4a42157" => Guardian {
        name: "Staked",
        rpc:  None
    },
};

/// Testnet Guardian Definitions
pub static TESTNET: Map<&'static str, Guardian> = phf_map! {
    "befa429d57cd18b7f8a4d91a2da9ab4af05d0fbe" => Guardian {
        name: "Devnet",
        rpc:  None,
    },
};

/// Choose a random RPC node for VAA querying. Randomizing to avoid reliance on any particular RPC
/// provider.
pub fn random_rpc(network: GuardianMap) -> &'static str {
    network
        .values()
        .filter_map(|v| v.rpc)
        .collect::<Vec<&'static str>>()
        .choose(&mut rand::thread_rng())
        .unwrap()
}
