use phf::{Map, phf_map};
use wormhole_sdk::Chain;

pub struct Network {
    pub chain_id:     Chain,
    pub network_id:   Option<u16>,
    pub wormhole:     &'static str,
    pub token_bridge: &'static str,
    pub nft_bridge:   Option<&'static str>,
}

pub static NETWORKS: Map<&'static str, Network> = phf_map! {
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
