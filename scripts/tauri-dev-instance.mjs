#!/usr/bin/env node
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const HOST = process.env.TAURI_DEV_HOST || "127.0.0.1";
const BASE_PORT = Number.parseInt(
  process.env.EDWINPAI_DESKTOP_DEV_PORT || "1420",
  10,
);
const BASE_HMR_PORT = Number.parseInt(
  process.env.EDWINPAI_DESKTOP_HMR_PORT || "1421",
  10,
);
const BASE_GATEWAY_PORT = Number.parseInt(
  process.env.EDWINPAI_DESKTOP_GATEWAY_PORT || "18789",
  10,
);

async function isPortFree(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function findFreePair() {
  for (let offset = 0; offset < 100; offset += 1) {
    const port = BASE_PORT + offset * 10;
    const hmrPort = BASE_HMR_PORT + offset * 10;
    if ((await isPortFree(port)) && (await isPortFree(hmrPort))) {
      return { port, hmrPort, offset };
    }
  }
  throw new Error(
    `No free Tauri/Vite dev port pair found from ${BASE_PORT}/${BASE_HMR_PORT}`,
  );
}

function shellEnvPrefix(env) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${signal || code}`,
          ),
        );
    });
  });
}

const { port, hmrPort, offset } = await findFreePair();
const instanceId =
  process.env.EDWINPAI_DESKTOP_INSTANCE_ID || `dev-${port}`;
const configPath =
  process.env.EDWINPAI_DESKTOP_CONFIG ||
  path.join(os.homedir(), ".edwinpai", `desktop-config.${instanceId}.json`);
const gatewayPort = Number.parseInt(
  process.env.EDWINPAI_DESKTOP_INSTANCE_GATEWAY_PORT ||
    String(BASE_GATEWAY_PORT + offset),
  10,
);

const instanceEnv = {
  EDWINPAI_DESKTOP_INSTANCE_ID: instanceId,
  EDWINPAI_DESKTOP_CONFIG: configPath,
  EDWINPAI_DESKTOP_INSTANCE_GATEWAY_PORT: String(gatewayPort),
  VITE_EDWINPAI_DESKTOP_INSTANCE_ID: instanceId,
  VITE_EDWINPAI_DESKTOP_CONFIG: configPath,
  VITE_EDWINPAI_GATEWAY_PORT: String(gatewayPort),
};

const env = {
  ...process.env,
  ...instanceEnv,
  VITE_PORT: String(port),
  VITE_HMR_PORT: String(hmrPort),
  TAURI_DEV_HOST: HOST,
};

await run("npm", ["run", "version:sync", "--silent"], { env });

const beforeDevCommand = `${shellEnvPrefix({
  ...instanceEnv,
  VITE_PORT: String(port),
  VITE_HMR_PORT: String(hmrPort),
  TAURI_DEV_HOST: HOST,
})} npm run dev`;
const config = JSON.stringify({
  build: {
    beforeDevCommand,
    devUrl: `http://${HOST}:${port}`,
  },
});

console.log(
  [
    `Starting EdwinPAI Desktop dev instance '${instanceId}'`,
    `  UI:      http://${HOST}:${port} (HMR ${hmrPort})`,
    `  Config:  ${configPath}`,
    `  Gateway: ${gatewayPort}`,
  ].join("\n"),
);
await run("npm", ["exec", "--", "tauri", "dev", "--config", config], { env });
