#!/usr/bin/env node
import { readFileSync } from "node:fs";

const manifests = [
  "src-tauri/Cargo.toml",
  "src-tauri/crates/identity-core/Cargo.toml",
];
const required = [
  "apple-native",
  "windows-native",
  "linux-native-sync-persistent",
  "crypto-rust",
];

let failed = false;
for (const manifest of manifests) {
  const text = readFileSync(manifest, "utf8");
  const line = text
    .split(/\r?\n/)
    .find((entry) => /^keyring\s*=/.test(entry.trim()));
  if (!line) {
    console.error(`${manifest}: missing keyring dependency`);
    failed = true;
    continue;
  }
  if (!line.includes("{")) {
    console.error(
      `${manifest}: keyring must be declared with explicit platform features, not bare version`,
    );
    failed = true;
  }
  for (const feature of required) {
    if (!line.includes(`"${feature}"`)) {
      console.error(`${manifest}: keyring missing required feature ${feature}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    "keyring feature check failed: supported desktop builds must use real OS keychain backends, never mock fallback",
  );
  process.exit(1);
}
console.log("keyring feature check passed");
