import { spawnSync } from 'child_process';
import path from 'path';

export function encodePath(dir: string): string {
  return '-' + path.resolve(dir).split('/').filter(Boolean).join('-');
}

export default {
  name: 'opencode',
  binary: 'opencode',
  installHint: 'curl -fsSL https://opencode.ai/install | bash',

  startCommand(): string {
    return 'opencode';
  },

  loginCommand(): string {
    return 'opencode auth login';
  },

  // opencode ships with built-in models that work without per-provider auth,
  // so being "authenticated" is equivalent to having the binary installed.
  isAuthenticated(): boolean {
    return spawnSync('which', ['opencode'], { stdio: 'ignore' }).status === 0;
  },

  isTrusted(): boolean {
    return true;
  },

  trustCommand(): string {
    return 'opencode';
  },

  encodePath,
};
