// Identity generation: petnames and identicons (SPEC §4.2)
//
// Deterministic generation of human-readable petnames and visual identicons
// from BSV public keys.

use sha2::{Digest, Sha256};

use super::traits::IdentityGenerator;
use super::types::{CryptoError, CryptoErrorCode, CryptoResult, Petname};

// Curated word lists (subset for Phase 1, can be expanded)
const ADJECTIVES: &[&str] = &[
    "Swift", "Quiet", "Bright", "Bold", "Calm", "Deep", "Fierce", "Gentle",
    "Happy", "Keen", "Loyal", "Noble", "Quick", "Rare", "Silent", "Vivid",
    "Wise", "Brave", "Clear", "Daring", "Eager", "Fair", "Grand", "Humble",
    "Iron", "Jade", "Kind", "Light", "Mystic", "Noble", "Open", "Pure",
    "Royal", "Sharp", "True", "Unique", "Vast", "Wild", "Young", "Zealous",
    "Amber", "Crystal", "Diamond", "Emerald", "Golden", "Ivory", "Lunar",
    "Midnight", "Ocean", "Pristine", "Quantum", "Ruby", "Sapphire", "Topaz",
    "Velvet", "Willow", "Xenon", "Yellow", "Zephyr", "Arctic", "Bronze",
    "Cosmic", "Dawn", "Electric", "Frost", "Glacial", "Horizon", "Inferno",
];

const NOUNS: &[&str] = &[
    "Falcon", "Ember", "River", "Mountain", "Storm", "Phoenix", "Shadow",
    "Tiger", "Eagle", "Wolf", "Dragon", "Bear", "Hawk", "Lion", "Owl",
    "Panther", "Raven", "Serpent", "Unicorn", "Viper", "Whale", "Fox",
    "Crane", "Dolphin", "Elephant", "Gazelle", "Heron", "Jaguar", "Kestrel",
    "Leopard", "Mongoose", "Nightingale", "Otter", "Pegasus", "Quail",
    "Rhino", "Stallion", "Turtle", "Vanguard", "Warbler", "Yak", "Zebra",
    "Atlas", "Beacon", "Cipher", "Dynamo", "Echo", "Flame", "Guardian",
    "Horizon", "Infinity", "Journey", "Keeper", "Legend", "Maverick", "Nexus",
    "Oracle", "Pioneer", "Quest", "Ranger", "Sentinel", "Titan", "Unity",
    "Vector", "Warden", "Zenith", "Anchor", "Bastion", "Compass", "Defender",
];

pub struct IdentityGen;

impl IdentityGenerator for IdentityGen {
    /// Generate petname from public key (SPEC §4.2)
    ///
    /// Uses first 4 bytes of SHA-256(publicKey) to index into word lists
    fn generate_petname(&self, public_key: &str) -> CryptoResult<Petname> {
        // Hash the public key
        let hash = sha256_hex(public_key)?;
        let hash_bytes = hex::decode(&hash).map_err(|e| CryptoError {
            code: CryptoErrorCode::InvalidKey,
            message: format!("Hash decode failed: {}", e),
        })?;

        // Use first 4 bytes for indexing
        let adj_index = u16::from_be_bytes([hash_bytes[0], hash_bytes[1]]) as usize % ADJECTIVES.len();
        let noun_index = u16::from_be_bytes([hash_bytes[2], hash_bytes[3]]) as usize % NOUNS.len();

        let adjective = ADJECTIVES[adj_index].to_string();
        let noun = NOUNS[noun_index].to_string();
        let display = format!("{} {}", adjective, noun);

        Ok(Petname {
            adjective,
            noun,
            display,
        })
    }

    /// Generate identicon SVG from public key
    ///
    /// Uses a blockies-style deterministic grid pattern
    fn generate_identicon(&self, public_key: &str, size: u32) -> CryptoResult<String> {
        let hash = sha256_hex(public_key)?;
        let hash_bytes = hex::decode(&hash).map_err(|e| CryptoError {
            code: CryptoErrorCode::InvalidKey,
            message: format!("Hash decode failed: {}", e),
        })?;

        // Grid: 8x8 symmetrical pattern
        let grid_size: usize = 8;
        let cell_size = size as usize / grid_size;

        // Generate color from hash
        let hue = (hash_bytes[0] as u32 * 360) / 256;
        let saturation = 60 + ((hash_bytes[1] as u32 * 20) / 256);
        let lightness = 45 + ((hash_bytes[2] as u32 * 10) / 256);
        let color = format!("hsl({}, {}%, {}%)", hue, saturation, lightness);

        // Build SVG
        let mut svg = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 {} {}">"#,
            size, size, size, size
        );

        // Background
        svg.push_str(&format!(
            r##"<rect width="{}" height="{}" fill="#f0f0f0"/>"##,
            size, size
        ));

        // Generate symmetrical grid pattern
        for y in 0..grid_size {
            for x in 0..(grid_size / 2) {
                let byte_index = (y * (grid_size / 2) + x) % hash_bytes.len();
                let bit = (hash_bytes[byte_index] >> (x % 8)) & 1;

                if bit == 1 {
                    // Draw cell (and its mirror)
                    let x1 = x * cell_size;
                    let x2 = (grid_size - 1 - x) * cell_size;
                    let y1 = y * cell_size;

                    svg.push_str(&format!(
                        r##"<rect x="{}" y="{}" width="{}" height="{}" fill="{}"/>"##,
                        x1, y1, cell_size, cell_size, color
                    ));
                    if x != grid_size / 2 - 1 {
                        svg.push_str(&format!(
                            r##"<rect x="{}" y="{}" width="{}" height="{}" fill="{}"/>"##,
                            x2, y1, cell_size, cell_size, color
                        ));
                    }
                }
            }
        }

        svg.push_str("</svg>");
        Ok(svg)
    }

    /// Generate short ID from public key (SPEC §4.2)
    ///
    /// Format: edw:<first 8 hex chars of SHA-256(publicKey)>
    fn generate_short_id(&self, public_key: &str) -> CryptoResult<String> {
        let hash = sha256_hex(public_key)?;
        Ok(format!("edw:{}", &hash[..8]))
    }
}

// --- Helpers ---

fn sha256_hex(data: &str) -> CryptoResult<String> {
    let bytes = hex::decode(data).map_err(|e| CryptoError {
        code: CryptoErrorCode::InvalidKey,
        message: format!("Invalid hex data: {}", e),
    })?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_petname_generation() {
        let gen = IdentityGen;
        let pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let petname = gen.generate_petname(pubkey).unwrap();
        assert!(!petname.adjective.is_empty());
        assert!(!petname.noun.is_empty());
        assert!(petname.display.contains(' '));

        // Deterministic: same pubkey → same petname
        let petname2 = gen.generate_petname(pubkey).unwrap();
        assert_eq!(petname.display, petname2.display);
    }

    #[test]
    fn test_identicon_generation() {
        let gen = IdentityGen;
        let pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let svg = gen.generate_identicon(pubkey, 64).unwrap();
        assert!(svg.starts_with("<svg"));
        assert!(svg.contains("</svg>"));
        assert!(svg.contains("rect"));

        // Deterministic
        let svg2 = gen.generate_identicon(pubkey, 64).unwrap();
        assert_eq!(svg, svg2);
    }

    #[test]
    fn test_short_id_generation() {
        let gen = IdentityGen;
        let pubkey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

        let short_id = gen.generate_short_id(pubkey).unwrap();
        assert!(short_id.starts_with("edw:"));
        assert_eq!(short_id.len(), 12); // "edw:" + 8 hex chars
    }
}
