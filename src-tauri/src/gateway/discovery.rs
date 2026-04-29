use std::env;
use std::path::PathBuf;

/// Find the EdwinPAI Gateway binary in common installation locations.
///
/// Searches in the following order:
/// 1. Directories in PATH environment variable
/// 2. ~/.npm-global/bin
/// 3. /usr/local/bin
/// 4. node_modules/.bin (relative to current working directory)
///
/// Returns the first valid executable found, or None if not found.
pub fn find_edwinpai_binary() -> Option<PathBuf> {
    // The npm package installs as "edwinpai" (not "edwinpai-gateway").
    // The gateway is started with `edwinpai gateway`.
    // Check both names for compatibility.
    let binary_names: &[&str] = if cfg!(windows) {
        &["edwinpai.exe", "edwinpai-gateway.exe"]
    } else {
        &["edwinpai", "edwinpai-gateway"]
    };

    // Collect all candidate directories (PATH + common Node manager locations)
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    // 1. PATH environment variable
    if let Ok(path_var) = env::var("PATH") {
        search_dirs.extend(env::split_paths(&path_var));
    }

    // 2. nvm paths (Tauri apps don't inherit shell PATH from .bashrc/.zshrc)
    if let Some(home_dir) = dirs::home_dir() {
        // nvm default location
        let nvm_dir = env::var("NVM_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir.join(".nvm"));
        // Check nvm versions directory for any installed Node
        if let Ok(entries) = std::fs::read_dir(nvm_dir.join("versions").join("node")) {
            for entry in entries.flatten() {
                search_dirs.push(entry.path().join("bin"));
            }
        }

        // XDG config nvm (e.g., ~/.config/nvm used by some setups)
        let xdg_nvm = home_dir.join(".config").join("nvm").join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(&xdg_nvm) {
            for entry in entries.flatten() {
                search_dirs.push(entry.path().join("bin"));
            }
        }

        // fnm (Fast Node Manager)
        let fnm_dir = home_dir.join(".local").join("share").join("fnm").join("node-versions");
        if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
            for entry in entries.flatten() {
                search_dirs.push(entry.path().join("installation").join("bin"));
            }
        }

        // volta
        search_dirs.push(home_dir.join(".volta").join("bin"));

        // ~/.npm-global/bin
        search_dirs.push(home_dir.join(".npm-global").join("bin"));
    }

    // 3. Common system paths
    search_dirs.push(PathBuf::from("/usr/local/bin"));

    // 4. node_modules/.bin (relative to CWD)
    if let Ok(cwd) = env::current_dir() {
        search_dirs.push(cwd.join("node_modules").join(".bin"));
    }

    // Search all directories for both binary names
    for binary_name in binary_names {
        for dir in &search_dirs {
            let candidate = dir.join(binary_name);
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }

    None
}

/// Check if a path exists and is executable.
fn is_executable(path: &PathBuf) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            return metadata.is_file() && (metadata.permissions().mode() & 0o111) != 0;
        }
        false
    }

    #[cfg(not(unix))]
    {
        // On Windows, just check if file exists
        std::fs::metadata(path).map(|m| m.is_file()).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    /// Helper to create an executable file in a temporary directory
    fn create_executable(dir: &TempDir, name: &str) -> PathBuf {
        let path = dir.path().join(name);
        let mut file = File::create(&path).unwrap();
        file.write_all(b"#!/bin/sh\necho test").unwrap();
        drop(file);

        #[cfg(unix)]
        {
            let mut perms = fs::metadata(&path).unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&path, perms).unwrap();
        }

        path
    }

    #[test]
    fn test_find_binary_in_path() {
        let temp_dir = TempDir::new().unwrap();
        let binary_name = if cfg!(windows) {
            "edwinpai.exe"
        } else {
            "edwinpai"
        };

        let binary_path = create_executable(&temp_dir, binary_name);

        // Temporarily modify PATH to include our test directory
        let original_path = env::var("PATH").unwrap_or_default();
        let new_path = format!("{}:{}", temp_dir.path().display(), original_path);
        env::set_var("PATH", &new_path);

        let result = find_edwinpai_binary();

        // Restore original PATH
        env::set_var("PATH", original_path);

        assert!(result.is_some());
        assert_eq!(result.unwrap(), binary_path);
    }

    #[test]
    fn test_find_binary_in_npm_global() {
        // Save original PATH
        let original_path = env::var("PATH").unwrap_or_default();

        // Set PATH to empty to skip PATH search
        env::set_var("PATH", "");

        let temp_home = TempDir::new().unwrap();
        let npm_global_bin = temp_home.path().join(".npm-global").join("bin");
        fs::create_dir_all(&npm_global_bin).unwrap();

        let binary_name = if cfg!(windows) {
            "edwinpai.exe"
        } else {
            "edwinpai"
        };
        let binary_path = npm_global_bin.join(binary_name);

        // Create executable
        let mut file = File::create(&binary_path).unwrap();
        file.write_all(b"#!/bin/sh\necho test").unwrap();
        drop(file);

        #[cfg(unix)]
        {
            let mut perms = fs::metadata(&binary_path).unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&binary_path, perms).unwrap();
        }

        // Temporarily override HOME
        let original_home = env::var("HOME").ok();
        env::set_var("HOME", temp_home.path());

        let result = find_edwinpai_binary();

        // Restore original environment
        env::set_var("PATH", original_path);
        if let Some(home) = original_home {
            env::set_var("HOME", home);
        } else {
            env::remove_var("HOME");
        }

        assert!(result.is_some());
        assert_eq!(result.unwrap(), binary_path);
    }

    #[test]
    fn test_binary_not_found() {
        // Save original PATH
        let original_path = env::var("PATH").unwrap_or_default();
        let original_home = env::var("HOME").ok();

        // Set PATH to empty and HOME to a non-existent directory
        env::set_var("PATH", "");
        env::set_var("HOME", "/nonexistent/directory/that/does/not/exist");

        let result = find_edwinpai_binary();

        // Restore original environment
        env::set_var("PATH", original_path);
        if let Some(home) = original_home {
            env::set_var("HOME", home);
        } else {
            env::remove_var("HOME");
        }

        assert!(result.is_none());
    }
}
