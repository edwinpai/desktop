use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct PortCleanupResult {
    pub port: u16,
    pub killed_pids: Vec<u32>,
    pub skipped_pids: Vec<u32>,
}

fn command_for_pid(pid: u32) -> Option<String> {
    let output = Command::new("/bin/ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn is_edwin_ssh_tunnel_command(command: &str, port: u16) -> bool {
    let port_fragment = format!("{}:localhost:", port);
    let localhost_fragment = format!("localhost:{}:localhost:", port);
    command.contains("ssh")
        && command.contains(" -N")
        && command.contains(" -L")
        && (command.contains(&port_fragment) || command.contains(&localhost_fragment))
}

#[tauri::command]
pub fn cleanup_ssh_tunnel_port(port: u16) -> Result<PortCleanupResult, String> {
    let output = Command::new("/usr/sbin/lsof")
        .args([
            "-nP",
            &format!("-iTCP:{}", port),
            "-sTCP:LISTEN",
            "-t",
        ])
        .output()
        .map_err(|e| format!("Failed to inspect port {}: {}", port, e))?;

    if !output.status.success() && output.stdout.is_empty() {
        return Ok(PortCleanupResult {
            port,
            killed_pids: vec![],
            skipped_pids: vec![],
        });
    }

    let mut killed_pids = Vec::new();
    let mut skipped_pids = Vec::new();

    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let Ok(pid) = line.trim().parse::<u32>() else {
            continue;
        };
        let Some(command) = command_for_pid(pid) else {
            skipped_pids.push(pid);
            continue;
        };

        if !is_edwin_ssh_tunnel_command(&command, port) {
            skipped_pids.push(pid);
            continue;
        }

        let kill = Command::new("/bin/kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill stale SSH tunnel PID {}: {}", pid, e))?;
        if kill.status.success() {
            killed_pids.push(pid);
        } else {
            skipped_pids.push(pid);
        }
    }

    Ok(PortCleanupResult {
        port,
        killed_pids,
        skipped_pids,
    })
}
