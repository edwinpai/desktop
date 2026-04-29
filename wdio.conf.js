import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// keep track of the `tauri-driver` child process
let tauriDriver;
let exit = false;

export const config = {
  host: '127.0.0.1',
  port: 4444,

  specs: ['./test/specs/**/*.js'],
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: path.resolve(__dirname, 'src-tauri/target/debug/edwinpai-desktop'),
      },
    },
  ],

  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Build the Tauri app in debug mode before tests (skip if binary is fresh)
  onPrepare: () => {
    const binary = path.resolve(__dirname, 'src-tauri/target/debug/edwinpai-desktop');
    const skipBuild = process.env.WDIO_SKIP_BUILD === '1';

    if (skipBuild && fs.existsSync(binary)) {
      console.log('[wdio] WDIO_SKIP_BUILD=1 and binary exists, skipping build');
      return;
    }

    console.log('[wdio] Building Tauri app (debug, no-bundle)...');
    const buildResult = spawnSync(
      'npm',
      ['run', 'tauri', 'build', '--', '--debug', '--no-bundle'],
      {
        cwd: __dirname,
        stdio: 'inherit',
        shell: true,
      }
    );
    if (buildResult.status !== 0) {
      throw new Error(`Tauri build failed with code ${buildResult.status}`);
    }
  },

  // Start tauri-driver before the session
  beforeSession: () => {
    tauriDriver = spawn(
      path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
      [],
      { stdio: [null, process.stdout, process.stderr] }
    );
    tauriDriver.on('error', (error) => {
      console.error('tauri-driver error:', error);
      process.exit(1);
    });
    tauriDriver.on('exit', (code) => {
      if (!exit) {
        console.error('tauri-driver exited with code:', code);
        process.exit(1);
      }
    });
  },

  // Clean up tauri-driver
  afterSession: () => {
    closeTauriDriver();
  },
};

function closeTauriDriver() {
  exit = true;
  tauriDriver?.kill();
}

function onShutdown(fn) {
  const cleanup = () => {
    try {
      fn();
    } finally {
      process.exit();
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  process.on('SIGBREAK', cleanup);
}

onShutdown(() => {
  closeTauriDriver();
});
