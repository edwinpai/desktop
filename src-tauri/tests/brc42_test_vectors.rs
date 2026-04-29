// BRC-42 Test Vector Validation
//
// This integration test validates EdwinPAI Desktop's BRC-42 implementation
// against the official test vectors from:
// https://github.com/bitcoin-sv/BRCs/blob/master/key-derivation/0042.md#test-vectors
//
// CRITICAL: All 10 test vectors MUST pass for Phase 1 completion.

use edwinpai_desktop_lib::crypto_domain::Brc42KeyDerivation;
use edwinpai_desktop_lib::crypto_domain::brc42::Brc42Deriver;

#[test]
fn test_brc42_private_key_vector_01() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_private_key(
        "6a1751169c111b4667a6539ee1be6b7cd9f6e9c8fe011a5f2fe31e03a15e0ede",
        "033f9160df035156f1c48e75eae99914fa1a1546bec19781e8eddb900200bff9d1",
        "f3WCaUmnN9U=",
    ).expect("BRC-42 vector 01 failed");

    assert_eq!(result, "761656715bbfa172f8f9f58f5af95d9d0dfd69014cfdcacc9a245a10ff8893ef");
}

#[test]
fn test_brc42_private_key_vector_02() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_private_key(
        "cab2500e206f31bc18a8af9d6f44f0b9a208c32d5cca2b22acfe9d1a213b2f36",
        "027775fa43959548497eb510541ac34b01d5ee9ea768de74244a4a25f7b60fae8d",
        "2Ska++APzEc=",
    ).expect("BRC-42 vector 02 failed");

    assert_eq!(result, "09f2b48bd75f4da6429ac70b5dce863d5ed2b350b6f2119af5626914bdb7c276");
}

#[test]
fn test_brc42_private_key_vector_03() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_private_key(
        "7a66d0896f2c4c2c9ac55670c71a9bc1bdbdfb4e8786ee5137cea1d0a05b6f20",
        "0338d2e0d12ba645578b0955026ee7554889ae4c530bd7a3b6f688233d763e169f",
        "cN/yQ7+k7pg=",
    ).expect("BRC-42 vector 03 failed");

    assert_eq!(result, "7114cd9afd1eade02f76703cc976c241246a2f26f5c4b7a3a0150ecc745da9f0");
}

#[test]
fn test_brc42_private_key_vector_04() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_private_key(
        "6e8c3da5f2fb0306a88d6bcd427cbfba0b9c7f4c930c43122a973d620ffa3036",
        "02830212a32a47e68b98d477000bde08cb916f4d44ef49d47ccd4918d9aaabe9c8",
        "m2/QAsmwaA4=",
    ).expect("BRC-42 vector 04 failed");

    assert_eq!(result, "f1d6fb05da1225feeddd1cf4100128afe09c3c1aadbffbd5c8bd10d329ef8f40");
}

#[test]
fn test_brc42_private_key_vector_05() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_private_key(
        "e9d174eff5708a0a41b32624f9b9cc97ef08f8931ed188ee58d5390cad2bf68e",
        "03f20a7e71c4b276753969e8b7e8b67e2dbafc3958d66ecba98dedc60a6615336d",
        "jgpUIjWFlVQ=",
    ).expect("BRC-42 vector 05 failed");

    assert_eq!(result, "c5677c533f17c30f79a40744b18085632b262c0c13d87f3848c385f1389f79a6");
}

#[test]
fn test_brc42_public_key_vector_01() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_public_key(
        "583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c",
        "02c0c1e1a1f7d247827d1bcf399f0ef2deef7695c322fd91a01a91378f101b6ffc",
        "IBioA4D/OaE=",
    ).expect("BRC-42 vector 01 public key derivation failed");

    assert_eq!(result, "03c1bf5baadee39721ae8c9882b3cf324f0bf3b9eb3fc1b8af8089ca7a7c2e669f");
}

#[test]
fn test_brc42_public_key_vector_02() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_public_key(
        "2c378b43d887d72200639890c11d79e8f22728d032a5733ba3d7be623d1bb118",
        "039a9da906ecb8ced5c87971e9c2e7c921e66ad450fd4fc0a7d569fdb5bede8e0f",
        "PWYuo9PDKvI=",
    ).expect("BRC-42 vector 02 public key derivation failed");

    assert_eq!(result, "0398cdf4b56a3b2e106224ff3be5253afd5b72de735d647831be51c713c9077848");
}

#[test]
fn test_brc42_public_key_vector_03() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_public_key(
        "d5a5f70b373ce164998dff7ecd93260d7e80356d3d10abf928fb267f0a6c7be6",
        "02745623f4e5de046b6ab59ce837efa1a959a8f28286ce9154a4781ec033b85029",
        "X9pnS+bByrM=",
    ).expect("BRC-42 vector 03 public key derivation failed");

    assert_eq!(result, "0273eec9380c1a11c5a905e86c2d036e70cbefd8991d9a0cfca671f5e0bbea4a3c");
}

#[test]
fn test_brc42_public_key_vector_04() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_public_key(
        "46cd68165fd5d12d2d6519b02feb3f4d9c083109de1bfaa2b5c4836ba717523c",
        "031e18bb0bbd3162b886007c55214c3c952bb2ae6c33dd06f57d891a60976003b1",
        "+ktmYRHv3uQ=",
    ).expect("BRC-42 vector 04 public key derivation failed");

    assert_eq!(result, "034c5c6bf2e52e8de8b2eb75883090ed7d1db234270907f1b0d1c2de1ddee5005d");
}

#[test]
fn test_brc42_public_key_vector_05() {
    let deriver = Brc42Deriver;

    let result = deriver.derive_public_key(
        "7c98b8abd7967485cfb7437f9c56dd1e48ceb21a4085b8cdeb2a647f62012db4",
        "03c8885f1e1ab4facd0f3272bb7a48b003d2e608e1619fb38b8be69336ab828f37",
        "PPfDTTcl1ao=",
    ).expect("BRC-42 vector 05 public key derivation failed");

    assert_eq!(result, "03304b41cfa726096ffd9d8907fe0835f888869eda9653bca34eb7bcab870d3779");
}

#[test]
fn test_all_brc42_vectors_comprehensive() {
    // Master test that runs all 10 vectors and reports comprehensive results
    let deriver = Brc42Deriver;
    let mut passed = 0;
    let mut failed = 0;

    // Private key vectors (5)
    let priv_vectors = [
        ("6a1751169c111b4667a6539ee1be6b7cd9f6e9c8fe011a5f2fe31e03a15e0ede", "033f9160df035156f1c48e75eae99914fa1a1546bec19781e8eddb900200bff9d1", "f3WCaUmnN9U=", "761656715bbfa172f8f9f58f5af95d9d0dfd69014cfdcacc9a245a10ff8893ef"),
        ("cab2500e206f31bc18a8af9d6f44f0b9a208c32d5cca2b22acfe9d1a213b2f36", "027775fa43959548497eb510541ac34b01d5ee9ea768de74244a4a25f7b60fae8d", "2Ska++APzEc=", "09f2b48bd75f4da6429ac70b5dce863d5ed2b350b6f2119af5626914bdb7c276"),
        ("7a66d0896f2c4c2c9ac55670c71a9bc1bdbdfb4e8786ee5137cea1d0a05b6f20", "0338d2e0d12ba645578b0955026ee7554889ae4c530bd7a3b6f688233d763e169f", "cN/yQ7+k7pg=", "7114cd9afd1eade02f76703cc976c241246a2f26f5c4b7a3a0150ecc745da9f0"),
        ("6e8c3da5f2fb0306a88d6bcd427cbfba0b9c7f4c930c43122a973d620ffa3036", "02830212a32a47e68b98d477000bde08cb916f4d44ef49d47ccd4918d9aaabe9c8", "m2/QAsmwaA4=", "f1d6fb05da1225feeddd1cf4100128afe09c3c1aadbffbd5c8bd10d329ef8f40"),
        ("e9d174eff5708a0a41b32624f9b9cc97ef08f8931ed188ee58d5390cad2bf68e", "03f20a7e71c4b276753969e8b7e8b67e2dbafc3958d66ecba98dedc60a6615336d", "jgpUIjWFlVQ=", "c5677c533f17c30f79a40744b18085632b262c0c13d87f3848c385f1389f79a6"),
    ];

    // Public key vectors (5)
    let pub_vectors = [
        ("583755110a8c059de5cd81b8a04e1be884c46083ade3f779c1e022f6f89da94c", "02c0c1e1a1f7d247827d1bcf399f0ef2deef7695c322fd91a01a91378f101b6ffc", "IBioA4D/OaE=", "03c1bf5baadee39721ae8c9882b3cf324f0bf3b9eb3fc1b8af8089ca7a7c2e669f"),
        ("2c378b43d887d72200639890c11d79e8f22728d032a5733ba3d7be623d1bb118", "039a9da906ecb8ced5c87971e9c2e7c921e66ad450fd4fc0a7d569fdb5bede8e0f", "PWYuo9PDKvI=", "0398cdf4b56a3b2e106224ff3be5253afd5b72de735d647831be51c713c9077848"),
        ("d5a5f70b373ce164998dff7ecd93260d7e80356d3d10abf928fb267f0a6c7be6", "02745623f4e5de046b6ab59ce837efa1a959a8f28286ce9154a4781ec033b85029", "X9pnS+bByrM=", "0273eec9380c1a11c5a905e86c2d036e70cbefd8991d9a0cfca671f5e0bbea4a3c"),
        ("46cd68165fd5d12d2d6519b02feb3f4d9c083109de1bfaa2b5c4836ba717523c", "031e18bb0bbd3162b886007c55214c3c952bb2ae6c33dd06f57d891a60976003b1", "+ktmYRHv3uQ=", "034c5c6bf2e52e8de8b2eb75883090ed7d1db234270907f1b0d1c2de1ddee5005d"),
        ("7c98b8abd7967485cfb7437f9c56dd1e48ceb21a4085b8cdeb2a647f62012db4", "03c8885f1e1ab4facd0f3272bb7a48b003d2e608e1619fb38b8be69336ab828f37", "PPfDTTcl1ao=", "03304b41cfa726096ffd9d8907fe0835f888869eda9653bca34eb7bcab870d3779"),
    ];

    println!("\n=== BRC-42 Test Vector Validation ===\n");

    // Test private key derivations
    for (i, (recip_priv, sender_pub, invoice, expected)) in priv_vectors.iter().enumerate() {
        match deriver.derive_private_key(recip_priv, sender_pub, invoice) {
            Ok(result) if &result == expected => {
                passed += 1;
                println!("✓ Private key vector {:02} PASS", i + 1);
            }
            Ok(result) => {
                failed += 1;
                println!("✗ Private key vector {:02} FAIL", i + 1);
                println!("  Expected: {}", expected);
                println!("  Got:      {}", result);
            }
            Err(e) => {
                failed += 1;
                println!("✗ Private key vector {:02} ERROR: {}", i + 1, e);
            }
        }
    }

    // Test public key derivations
    for (i, (sender_priv, recip_pub, invoice, expected)) in pub_vectors.iter().enumerate() {
        match deriver.derive_public_key(sender_priv, recip_pub, invoice) {
            Ok(result) if &result == expected => {
                passed += 1;
                println!("✓ Public key vector {:02} PASS", i + 1);
            }
            Ok(result) => {
                failed += 1;
                println!("✗ Public key vector {:02} FAIL", i + 1);
                println!("  Expected: {}", expected);
                println!("  Got:      {}", result);
            }
            Err(e) => {
                failed += 1;
                println!("✗ Public key vector {:02} ERROR: {}", i + 1, e);
            }
        }
    }

    println!("\n=== Results ===");
    println!("Passed: {}/10", passed);
    println!("Failed: {}/10", failed);

    assert_eq!(passed, 10, "CRITICAL: All 10 BRC-42 test vectors must pass");
    assert_eq!(failed, 0, "CRITICAL: No BRC-42 test vectors should fail");
}
