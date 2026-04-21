import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';

export function isColimaInstalled(): boolean {
  return spawnSync('which', ['colima'], { stdio: 'ignore' }).status === 0;
}

/** On Linux, Colima needs KVM access. Check if we need `sg kvm` to get it. */
function needsKvmGroup(): boolean {
  if (os.platform() !== 'linux') return false;
  try {
    fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK);
    return false;
  } catch {
    // Check if /dev/kvm exists but we lack permission
    try {
      fs.statSync('/dev/kvm');
      return true;
    } catch {
      return false; // /dev/kvm doesn't exist (no KVM support)
    }
  }
}

export function isColimaRunning(): boolean {
  if (!isColimaInstalled()) return false;
  return spawnSync('colima', ['status'], { stdio: 'ignore' }).status === 0;
}

export type ColimaRuntime = 'docker' | 'nerdctl';

export function getColimaRuntime(): ColimaRuntime | null {
  if (!isColimaRunning()) return null;

  const result = spawnSync('colima', ['status', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  });
  if (result.status !== 0 || !result.stdout) return null;

  try {
    const status = JSON.parse(result.stdout);
    const runtime = status.runtime;
    if (runtime === 'containerd') return 'nerdctl';
    if (runtime === 'docker') return 'docker';
    return 'docker'; // default assumption
  } catch {
    return null;
  }
}

export function ensureColimaRunning(runtime?: string, extraArgs?: string[]): void {
  if (!isColimaInstalled()) {
    console.error('Colima is not installed. Install it from https://colima.run/');
    process.exit(1);
  }

  if (isColimaRunning()) return;

  const args = ['start'];
  if (runtime) {
    args.push('--runtime', runtime === 'nerdctl' ? 'containerd' : runtime);
  }
  if (extraArgs && extraArgs.length > 0) {
    args.push(...extraArgs);
  }

  console.log('Starting Colima VM, this may take a minute...');

  if (needsKvmGroup()) {
    // Shell session may not have the kvm group yet — use sg to run with it
    const colimaCmd = ['colima', ...args].map(a => `'${a}'`).join(' ');
    spawnSync('sg', ['kvm', '-c', colimaCmd], { stdio: 'inherit' });
  } else {
    execFileSync('colima', args, { stdio: 'inherit' });
  }

  if (!isColimaRunning()) {
    console.error('Failed to start Colima.');
    if (os.platform() === 'linux') {
      console.error('On Linux, Colima needs KVM access. Ensure your user is in the kvm group:');
      console.error('  sudo usermod -aG kvm $USER');
      console.error('Then restart your shell session.');
    }
    process.exit(1);
  }
}
