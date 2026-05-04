import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isColimaInstalled, isEngineAvailable } from '@flout/sandbox';
import type { Agent } from './types.js';

function checkBinary(name: string): boolean {
  const result = spawnSync('which', [name]);
  return result.status === 0;
}

function checkContainerEngine(): boolean {
  if (isColimaInstalled()) return true;
  if (isEngineAvailable('podman')) return true;
  if (isEngineAvailable('docker')) return true;
  if (isEngineAvailable('nerdctl')) return true;
  return false;
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

  if (checkContainerEngine()) {
    const engines: string[] = [];
    if (isColimaInstalled()) engines.push('colima');
    if (isEngineAvailable('podman')) engines.push('podman');
    if (isEngineAvailable('docker')) engines.push('docker');
    if (isEngineAvailable('nerdctl')) engines.push('nerdctl');
    console.log(`  ✓ container engine (${engines.join(', ')})`);
  } else {
    console.error('  ✗ container engine — no container runtime found');
    console.error('    Install Colima (recommended): https://colima.run/');
    console.error('    Or install Podman or Docker.');
    ok = false;
  }

  if (!ok) {
    console.error('\nInstall missing dependencies and try again.');
    process.exit(1);
  }

  console.log('\nRunning interactive login...');
  const login = spawnSync(agent.loginCommand(), { stdio: 'inherit', shell: true });
  if (login.status !== 0) {
    console.error('Login failed.');
    process.exit(1);
  }

  if (agent.setupTokenCommand) {
    console.log('\nSetting up long-lived token...');
    const token = spawnSync(agent.setupTokenCommand(), { stdio: 'inherit', shell: true });
    if (token.status !== 0) {
      console.error('Token setup failed.');
      process.exit(1);
    }
  }

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
