import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Agent } from './types.js';

function checkBinary(name: string): boolean {
  const result = spawnSync('which', [name]);
  return result.status === 0;
}

export function setup(agent: Agent): void {
  let ok = true;

  for (const bin of ['tmux', 'node', agent.binary]) {
    if (checkBinary(bin)) {
      console.log(`  ✓ ${bin}`);
    } else {
      console.error(`  ✗ ${bin} — not found in PATH`);
      if (bin === agent.binary && agent.installHint) {
        console.error(`    Install with: ${agent.installHint}`);
      }
      ok = false;
    }
  }

  if (!ok) {
    console.error('\nInstall missing dependencies and try again.');
    process.exit(1);
  }

  console.log('\nRunning interactive login...');
  spawnSync(agent.loginCommand(), { stdio: 'inherit', shell: true });

  console.log('\nSetting up long-lived token...');
  spawnSync(agent.setupTokenCommand(), { stdio: 'inherit', shell: true });

  console.log('\nSetup complete.');
}

export function trust(dir: string, agent: Agent): void {
  const expanded = dir.startsWith('~') ? dir.replace(/^~/, os.homedir()) : dir;
  const resolved = path.resolve(expanded);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: directory '${resolved}' does not exist`);
    process.exit(1);
  }

  console.log(`Opening ${agent.name} in ${resolved} — accept the trust prompt, then exit.`);
  spawnSync(agent.trustCommand(), { cwd: resolved, stdio: 'inherit', shell: true });
}
