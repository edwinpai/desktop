import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const nextVersion = process.argv[2]?.trim();

if (!nextVersion) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'VERSION'), `${nextVersion}\n`);
const result = spawnSync(process.execPath, [path.join(__dirname, 'sync-version.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
