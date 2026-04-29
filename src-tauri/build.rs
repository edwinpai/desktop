use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=../VERSION");
    println!("cargo:rerun-if-changed=tauri.conf.json");

    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR missing");
    let repo_root = Path::new(&manifest_dir).join("..");
    let version_path = repo_root.join("VERSION");
    let expected_version = fs::read_to_string(&version_path)
        .expect("Failed to read ../VERSION")
        .trim()
        .to_string();

    let cargo_version = std::env::var("CARGO_PKG_VERSION").expect("CARGO_PKG_VERSION missing");
    if cargo_version != expected_version {
        panic!(
            "src-tauri/Cargo.toml version ({cargo_version}) does not match VERSION ({expected_version}). Run `npm run version:sync` or `npm run version:set -- <version>`."
        );
    }

    let tauri_conf = fs::read_to_string(Path::new(&manifest_dir).join("tauri.conf.json"))
        .expect("Failed to read tauri.conf.json");
    let expected_json_fragment = format!("\"version\": \"{}\"", expected_version);
    if !tauri_conf.contains(&expected_json_fragment) {
        panic!(
            "src-tauri/tauri.conf.json version does not match VERSION ({}). Run `npm run version:sync`.",
            expected_version
        );
    }

    tauri_build::build()
}
