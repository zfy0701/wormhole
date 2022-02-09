use phf::{
    phf_map,
    Map,
};
use wormhole_sdk::Chain;

pub struct Network {
    pub chain_id:     Chain,
    pub network_id:   Option<u16>,
    pub wormhole:     &'static str,
    pub token_bridge: &'static str,
    pub nft_bridge:   Option<&'static str>,
}

/// Mapping of network name to network details. Static map means this is exhaustively checked at
/// compile time when used through the codebase.
pub type NetworkMap = Map<&'static str, Network>;

/// Network Groupings.
pub static NETWORKS: Map<&'static str, &'static NetworkMap> = phf_map! {
    "mainnet" => &MAINNET,
    "testnet" => &TESTNET,
};

/// Mainnet Network Definitions
pub static MAINNET: NetworkMap = phf_map! {
    "solana" => Network {
        chain_id:     Chain::Solana,
        network_id:   None,
        wormhole:     "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth",
        token_bridge: "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb",
        nft_bridge:   Some("WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD"),
    },

    "ethereum" => Network {
        chain_id:     Chain::Ethereum,
        network_id:   Some(1),
        wormhole:     "98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
        token_bridge: "3ee18B2214AFF97000D974cf647E7C347E8fa585",
        nft_bridge:   Some("6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE"),
    },

    "terra" => Network {
        chain_id:     Chain::Terra,
        network_id:   None,
        wormhole:     "terra1dq03ugtd40zu9hcgdzrsq6z2z4hwhc9tqk2uy5",
        token_bridge: "terra10nmmwe8r3g99a9newtqa7a75xfgs2e8z87r2sf",
        nft_bridge:   None,
    },

    "binance" => Network {
        chain_id:     Chain::Binance,
        network_id:   Some(56),
        wormhole:     "98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
        token_bridge: "B6F6D86a8f9879A9c87f643768d9efc38c1Da6E7",
        nft_bridge:   Some("5a58505a96D1dbf8dF91cB21B54419FC36e93fdE"),
    },

    "polygon" => Network {
        chain_id:     Chain::Polygon,
        network_id:   Some(137),
        wormhole:     "7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
        token_bridge: "5a58505a96D1dbf8dF91cB21B54419FC36e93fdE",
        nft_bridge:   Some("90BBd86a6Fe93D3bc3ed6335935447E75fAb7fCf"),
    },

    "avalanche" => Network {
        chain_id:     Chain::AVAX,
        network_id:   Some(43114),
        wormhole:     "54a8e5f9c4CbA08F9943965859F6c34eAF03E26c",
        token_bridge: "0e082F06FF657D94310cB8cE8B0D9a04541d8052",
        nft_bridge:   Some("f7B6737Ca9c4e08aE573F75A97B73D7a813f5De5"),
    },

    "oasis" => Network {
        chain_id:     Chain::Oasis,
        network_id:   Some(42262),
        wormhole:     "fE8cD454b4A1CA468B57D79c0cc77Ef5B6f64585",
        token_bridge: "5848C791e09901b40A9Ef749f2a6735b418d7564",
        nft_bridge:   Some("04952D522Ff217f40B5Ef3cbF659EcA7b952a6c1"),
    },
};

/// Testnet Network Definitions
pub static TESTNET: NetworkMap = phf_map! {
    "solana" => Network {
        chain_id:     Chain::Solana,
        network_id:   None,
        wormhole:     "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
        token_bridge: "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe",
        nft_bridge:   Some("2rHhojZ7hpu1zA91nvZmT8TqWWvMcKmmNBCr2mKTtMq4"),
    },

    "ethereum" => Network {
        chain_id:     Chain::Ethereum,
        network_id:   Some(1),
        wormhole:     "706abc4E45D419950511e474C7B9Ed348A4a716c",
        token_bridge: "F890982f9310df57d00f659cf4fd87e65adEd8d7",
        nft_bridge:   Some("D8E4C2DbDd2e2bd8F1336EA691dBFF6952B1a6eB"),
    },

    "terra" => Network {
        chain_id:     Chain::Terra,
        network_id:   None,
        wormhole:     "terra1pd65m0q9tl3v8znnz5f5ltsfegyzah7g42cx5v",
        token_bridge: "terra1pseddrv0yfsn76u4zxrjmtf45kdlmalswdv39a",
        nft_bridge:   None,
    },

    "binance" => Network {
        chain_id:     Chain::Binance,
        network_id:   Some(56),
        wormhole:     "68605AD7b15c732a30b1BbC62BE8F2A509D74b4D",
        token_bridge: "9dcF9D205C9De35334D646BeE44b2D2859712A09",
        nft_bridge:   Some("cD16E5613EF35599dc82B24Cb45B5A93D779f1EE"),
    },

    "polygon" => Network {
        chain_id:     Chain::Polygon,
        network_id:   Some(137),
        wormhole:     "0CBE91CF822c73C2315FB05100C2F714765d5c20",
        token_bridge: "377D55a7928c046E18eEbb61977e714d2a76472a",
        nft_bridge:   Some("51a02d0dcb5e52F5b92bdAA38FA013C91c7309A9"),
    },

    "avalanche" => Network {
        chain_id:     Chain::AVAX,
        network_id:   Some(43114),
        wormhole:     "7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C",
        token_bridge: "61E44E506Ca5659E6c0bba9b678586fA2d729756",
        nft_bridge:   Some("D601BAf2EEE3C028344471684F6b27E789D9075D"),
    },

    "oasis" => Network {
        chain_id:     Chain::Oasis,
        network_id:   Some(42262),
        wormhole:     "c1C338397ffA53a2Eb12A7038b4eeb34791F8aCb",
        token_bridge: "88d8004A9BdbfD9D28090A02010C19897a29605c",
        nft_bridge:   Some("C5c25B41AB0b797571620F5204Afa116A44c0ebA"),
    },

    "ropsten" => Network {
        chain_id:     Chain::Ropsten,
        network_id:   Some(42262),
        wormhole:     "210c5F5e2AF958B4defFe715Dc621b7a3BA888c5",
        token_bridge: "F174F9A837536C449321df1Ca093Bb96948D5386",
        nft_bridge:   Some("2b048Da40f69c8dc386a56705915f8E966fe1eba"),
    },
};
