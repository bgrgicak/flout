import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function encodePath(dir: string): string {
  return '-' + path.resolve(dir).split('/').filter(Boolean).join('-');
}

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function isTrustedProject(config: string, dir: string): boolean {
  const header = `[projects.${tomlString(path.resolve(dir))}]`;
  const lines = config.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === header);
  if (start === -1) return false;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('[')) return false;
    if (/^trust_level\s*=\s*["']trusted["']\s*$/.test(line)) return true;
  }
  return false;
}

export default {
  name: 'codex',
  binary: 'codex',
  installHint: 'npm install -g @openai/codex',

  remoteCommand(): string {
    return 'codex remote-control start';
  },

  startCommand(): string {
    return 'codex --dangerously-bypass-approvals-and-sandbox';
  },

  loginCommand(): string {
    return 'codex login';
  },

  isAuthenticated(): boolean {
    const result = spawnSync(this.binary, ['login', 'status']);
    return result.status === 0;
  },

  isTrusted(dir: string): boolean {
    const configPath = path.join(codexHome(), 'config.toml');
    if (!fs.existsSync(configPath)) return false;
    return isTrustedProject(fs.readFileSync(configPath, 'utf8'), dir);
  },

  trustCommand(): string {
    return 'codex';
  },

  encodePath,
};

export { isTrustedProject };
