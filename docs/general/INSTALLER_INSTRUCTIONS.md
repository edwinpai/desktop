# EdwinPAI Desktop - Installer Build & Distribution Guide

**Version**: 1.0.0
**Date**: 2026-02-12
**Status**: Production-Ready

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Builds](#local-development-builds)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Installer Artifacts](#installer-artifacts)
5. [Code Signing](#code-signing)
6. [Auto-Updater Configuration](#auto-updater-configuration)
7. [Distribution](#distribution)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### All Platforms

- **Node.js**: 18+ (20 LTS recommended)
- **Rust**: 1.70+ (installed via rustup)
- **Tauri CLI**: `npm install -g @tauri-apps/cli@^2.0.0`

### Linux (Ubuntu/Debian)

```bash
# Required system dependencies
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

### macOS

```bash
# Xcode Command Line Tools (includes signing tools)
xcode-select --install

# Optional: Homebrew for additional deps
brew install gnu-tar
```

### Windows

- **Visual Studio 2022**: C++ build tools
- **WebView2**: Bundled by Tauri (automatic download)

---

## Local Development Builds

### 1. Debug Build (No Installer)

```bash
cd edwinpai-desktop

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build debug binary (no installer)
npm run tauri build -- --debug
```

**Output**: `src-tauri/target/debug/edwinpai-desktop` (executable only)

### 2. Release Build (With Installer)

```bash
# Full release build with installers
npm run tauri build

# Custom target directory
npm run tauri build -- --target-dir ./custom-output

# Verbose logging
npm run tauri build -- --verbose
```

**Output**: See [Installer Artifacts](#installer-artifacts) section below.

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build Installers

on:
  push:
    tags:
      - 'v*.*.*'  # Trigger on version tags (e.g., v1.0.0)
  workflow_dispatch:  # Manual trigger

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        platform:
          - os: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            artifact: |
              src-tauri/target/release/bundle/deb/*.deb
              src-tauri/target/release/bundle/appimage/*.AppImage
          - os: macos-latest
            target: x86_64-apple-darwin
            artifact: src-tauri/target/release/bundle/dmg/*.dmg
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact: src-tauri/target/release/bundle/dmg/*.dmg
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: src-tauri/target/release/bundle/msi/*.msi

    runs-on: ${{ matrix.platform.os }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          target: ${{ matrix.platform.target }}

      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            libgtk-3-dev \
            libsoup-3.0-dev \
            libjavascriptcoregtk-4.1-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Run tests
        run: |
          npm run test
          cargo test --manifest-path=src-tauri/Cargo.toml

      - name: Build Tauri app
        run: npm run tauri build -- --target ${{ matrix.platform.target }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform.os }}-${{ matrix.platform.target }}
          path: ${{ matrix.platform.artifact }}
          retention-days: 30

  release:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')

    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            **/*.deb
            **/*.AppImage
            **/*.dmg
            **/*.msi
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Triggering Builds

#### Automatic (Tag-Based)

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

#### Manual (Workflow Dispatch)

1. Go to GitHub → Actions → Build Installers
2. Click "Run workflow"
3. Select branch (usually `main`)
4. Click "Run workflow"

---

## Installer Artifacts

### Linux

#### Debian/Ubuntu (.deb)

- **Path**: `src-tauri/target/release/bundle/deb/edwinpai-desktop_1.0.0_amd64.deb`
- **Size**: ~18 MB
- **Install**: `sudo dpkg -i edwinpai-desktop_1.0.0_amd64.deb`
- **Uninstall**: `sudo apt-get remove edwinpai-desktop`

#### AppImage (Universal)

- **Path**: `src-tauri/target/release/bundle/appimage/edwinpai-desktop_1.0.0_x86_64.AppImage`
- **Size**: ~22 MB
- **Run**: `chmod +x edwinpai-desktop_1.0.0_x86_64.AppImage && ./edwinpai-desktop_1.0.0_x86_64.AppImage`
- **Uninstall**: Delete AppImage file

### macOS

#### DMG (Intel)

- **Path**: `src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/edwinpai-desktop_1.0.0_x64.dmg`
- **Size**: ~20 MB
- **Install**: Drag to Applications folder
- **Uninstall**: Move to Trash

#### DMG (Apple Silicon)

- **Path**: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/edwinpai-desktop_1.0.0_aarch64.dmg`
- **Size**: ~19 MB
- **Install**: Drag to Applications folder
- **Uninstall**: Move to Trash

### Windows

#### MSI Installer

- **Path**: `src-tauri/target/release/bundle/msi/edwinpai-desktop_1.0.0_x64-setup.msi`
- **Size**: ~24 MB
- **Install**: Double-click MSI file
- **Uninstall**: Control Panel → Programs and Features

---

## Code Signing

### macOS (Developer ID)

**Prerequisites**:

1. Apple Developer account ($99/year)
2. Developer ID Application certificate
3. Install certificate in Keychain

**Configure** `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
        "providerShortName": "TEAM_ID",
        "entitlements": "entitlements.plist"
      }
    }
  }
}
```

**Sign manually**:

```bash
# Sign app bundle
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  "src-tauri/target/release/bundle/macos/EdwinPAI Desktop.app"

# Notarize (required for macOS 10.15+)
xcrun notarytool submit \
  "src-tauri/target/release/bundle/dmg/edwinpai-desktop_1.0.0_x64.dmg" \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# Staple notarization ticket
xcrun stapler staple "src-tauri/target/release/bundle/dmg/edwinpai-desktop_1.0.0_x64.dmg"
```

### Windows (Authenticode)

**Prerequisites**:

1. Code signing certificate (.pfx file)
2. Install certificate in Windows Certificate Store

**Configure** `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
        "timestampUrl": "http://timestamp.digicert.com"
      }
    }
  }
}
```

**Sign manually**:

```bash
# Sign MSI installer
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 \
  /sha1 YOUR_CERT_THUMBPRINT \
  "src-tauri/target/release/bundle/msi/edwinpai-desktop_1.0.0_x64-setup.msi"
```

### Linux (GPG)

**Optional** - GPG signature for .deb packages:

```bash
# Sign .deb package
dpkg-sig --sign builder "src-tauri/target/release/bundle/deb/edwinpai-desktop_1.0.0_amd64.deb"

# Verify signature
dpkg-sig --verify "src-tauri/target/release/bundle/deb/edwinpai-desktop_1.0.0_amd64.deb"
```

---

## Auto-Updater Configuration

### 1. Generate Signing Key

```bash
# Generate Ed25519 keypair (one-time setup)
npm run tauri signer generate

# Output:
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFBQUFBQUFBQUFBQUFBQUE=
# Private key: (save to secure location, NOT in repo)
```

### 2. Configure Updater

**Update** `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "updater": {
      "active": true,
      "dialog": true,
      "endpoints": [
        "https://releases.edwinpai-desktop.dev/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFBQUFBQUFBQUFBQUFBQUE="
    }
  }
}
```

### 3. Host Update Manifest

**Example** `https://releases.edwinpai-desktop.dev/darwin/x86_64/1.0.0`:

```json
{
  "version": "1.0.1",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-02-15T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXk=",
      "url": "https://releases.edwinpai-desktop.dev/edwinpai-desktop_1.0.1_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXk=",
      "url": "https://releases.edwinpai-desktop.dev/edwinpai-desktop_1.0.1_aarch64.dmg"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXk=",
      "url": "https://releases.edwinpai-desktop.dev/edwinpai-desktop_1.0.1_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXk=",
      "url": "https://releases.edwinpai-desktop.dev/edwinpai-desktop_1.0.1_x64-setup.msi"
    }
  }
}
```

### 4. Sign Update Artifacts

```bash
# Sign artifact with private key
npm run tauri signer sign \
  "src-tauri/target/release/bundle/dmg/edwinpai-desktop_1.0.1_x64.dmg" \
  --private-key "~/.tauri/private.key"

# Output: signature (base64) - add to update manifest
```

---

## Distribution

### Option 1: GitHub Releases (Recommended)

1. Create release via GitHub Actions (see [CI/CD Pipeline](#cicd-pipeline))
2. Artifacts automatically uploaded to GitHub Releases
3. Users download from `https://github.com/yourusername/edwinpai-ux/releases/latest`

### Option 2: Custom CDN

1. Upload installers to CDN (AWS S3, Cloudflare R2, etc.)
2. Configure auto-updater endpoints in `tauri.conf.json`
3. Host update manifest JSON files

### Option 3: Package Managers

#### Homebrew (macOS)

```bash
# Create Homebrew formula
brew create https://github.com/yourusername/edwinpai-ux/releases/download/v1.0.0/edwinpai-desktop_1.0.0_x64.dmg

# Submit to Homebrew Cask
# See: https://docs.brew.sh/How-to-Open-a-Homebrew-Pull-Request
```

#### winget (Windows)

```bash
# Create winget manifest
# See: https://github.com/microsoft/winget-pkgs
```

#### Flatpak (Linux)

```bash
# Create Flatpak manifest
# See: https://docs.flatpak.org/en/latest/
```

---

## Troubleshooting

### Build fails: "webkit2gtk not found" (Linux)

**Solution**: Install system dependencies:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev
```

### Build fails: "Missing Xcode" (macOS)

**Solution**: Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Build fails: "MSVC not found" (Windows)

**Solution**: Install Visual Studio 2022 C++ build tools:

- Download from: https://visualstudio.microsoft.com/downloads/
- Select "Desktop development with C++"

### DMG not opening: "Damaged or incomplete" (macOS)

**Solution**: Sign and notarize DMG (see [Code Signing](#code-signing))

### MSI installer blocked: "Unknown publisher" (Windows)

**Solution**: Sign MSI with Authenticode certificate (see [Code Signing](#code-signing))

### AppImage won't run: "Permission denied" (Linux)

**Solution**: Make AppImage executable:

```bash
chmod +x edwinpai-desktop_1.0.0_x86_64.AppImage
```

### Auto-updater fails: "Invalid signature"

**Solution**: Verify public key in `tauri.conf.json` matches signing key:

```bash
# Re-generate keypair if needed
npm run tauri signer generate
```

### Build size too large (>50 MB)

**Solutions**:

1. Enable `strip` in `Cargo.toml`:

```toml
[profile.release]
strip = true  # Remove debug symbols
lto = true    # Link-time optimization
opt-level = "z"  # Optimize for size
```

2. Exclude unused dependencies:

```bash
cargo tree --edges no-dev | grep -v "(dev)"
```

---

## CI Build Times

**Typical build times in GitHub Actions**:

- **Linux**: 8-12 minutes
- **macOS (Intel)**: 10-15 minutes
- **macOS (Apple Silicon)**: 10-15 minutes (cross-compile)
- **Windows**: 12-18 minutes

**Total parallel time**: ~18 minutes (all platforms)

---

## Release Checklist

- [ ] Update version in `package.json`
- [ ] Update version in `src-tauri/Cargo.toml`
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run tests: `npm run test && cargo test`
- [ ] Build installers: `npm run tauri build`
- [ ] Test installers on all platforms (Linux, macOS, Windows)
- [ ] Sign installers (macOS + Windows)
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Wait for CI build to complete
- [ ] Download artifacts from GitHub Actions
- [ ] Create GitHub Release with artifacts
- [ ] Update auto-updater manifest (if applicable)
- [ ] Announce release (Discord, Twitter, etc.)

---

## Additional Resources

- **Tauri v2 Docs**: https://v2.tauri.app/
- **Tauri Bundler**: https://v2.tauri.app/reference/cli/#bundle
- **Tauri Updater**: https://v2.tauri.app/plugin/updater/
- **Code Signing Guide**: https://v2.tauri.app/guides/distribution/sign-macos/
- **GitHub Actions**: https://docs.github.com/en/actions

---

**EdwinPAI Desktop v1.0.0** - Installer Build Guide
**Last Updated**: 2026-02-12
**Status**: Production-Ready
