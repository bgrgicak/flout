import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function encodePath(dir: string): string {
  return '-' + path.resolve(dir).split('/').filter(Boolean).join('-');
}

export default {
  name: 'claude',
  binary: 'claude',
  installHint: 'curl -fsSL https://claude.ai/install.sh | bash',

  remoteCommand(sessionName: string): string {
    return `claude remote-control --spawn=session --permission-mode bypassPermissions --name ${sessionName}`;
  },

  startCommand(): string {
    return 'claude --permission-mode bypassPermissions';
  },

  loginCommand(): string {
    return 'claude';
  },

  setupTokenCommand(): string {
    return 'claude setup-token';
  },

  isAuthenticated(): boolean {
    const result = spawnSync(this.binary, ['auth', 'status']);
    return result.status === 0;
  },

  isTrusted(dir: string): boolean {
    const encoded = encodePath(dir);
    const trustDir = path.join(os.homedir(), '.claude', 'projects', encoded);
    return fs.existsSync(trustDir);
  },

  trustCommand(): string {
    return 'claude';
  },

  encodePath,
};
