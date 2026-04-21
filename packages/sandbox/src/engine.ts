import { spawnSync } from 'child_process';
import os from 'os';
import { isColimaInstalled, isColimaRunning, getColimaRuntime, ensureColimaRunning } from './colima.js';

export type EngineType = 'docker' | 'podman' | 'nerdctl';

// User-facing engine names that map to EngineType
export type EngineInput = EngineType | 'containerd';

export interface Engine {
  /** The command to invoke: 'docker', 'podman', 'nerdctl', or 'colima' */
  binary: string;
  /** Extra args prepended before subcommands (e.g. ['nerdctl', '--'] for colima) */
  prefix: string[];
  type: EngineType;
  viaColima: boolean;
  platform: 'linux' | 'darwin';
}

let cachedEngine: Engine | null = null;

/** Normalize user-facing engine name to internal EngineType */
export function normalizeEngine(input: string): EngineType {
  if (input === 'containerd') return 'nerdctl';
  if (input === 'docker' || input === 'podman' || input === 'nerdctl') return input;
  console.error(`Unknown engine '${input}'. Valid engines: docker, podman, containerd (nerdctl).`);
  process.exit(1);
}

export function isEngineAvailable(binary: string): boolean {
  const which = spawnSync('which', [binary], { stdio: 'ignore' });
  if (which.status !== 0) return false;

  // For docker and podman, also check the daemon is reachable
  if (binary === 'docker' || binary === 'podman') {
    const info = spawnSync(binary, ['info'], { stdio: 'ignore', timeout: 5000 });
    return info.status === 0;
  }

  // nerdctl: just check it exists (containerd must be running)
  return true;
}

function getPlatform(): 'linux' | 'darwin' {
  const p = os.platform();
  if (p === 'darwin') return 'darwin';
  return 'linux';
}

function engineFromBinary(binary: string): EngineType {
  if (binary === 'podman') return 'podman';
  if (binary === 'nerdctl') return 'nerdctl';
  return 'docker';
}

function makeEngine(binary: string, viaColima: boolean): Engine {
  // When using Colima with containerd, we need `colima nerdctl --` instead
  // of bare `nerdctl` because buildkit and containerd run inside the VM.
  if (viaColima && binary === 'nerdctl') {
    return {
      binary: 'colima',
      prefix: ['nerdctl', '--'],
      type: 'nerdctl',
      viaColima: true,
      platform: getPlatform(),
    };
  }
  return {
    binary,
    prefix: [],
    type: engineFromBinary(binary),
    viaColima,
    platform: getPlatform(),
  };
}

/** Map EngineType to the Colima --runtime value it needs */
function colimaRuntimeFor(engine: EngineType): string {
  return engine === 'nerdctl' ? 'containerd' : 'docker';
}

/** Try to get engine via Colima (already running) */
function engineFromColima(preferred?: EngineType): Engine | null {
  if (!isColimaRunning()) return null;
  const runtime = getColimaRuntime();
  if (!runtime) return null;
  if (preferred && preferred !== runtime) return null;
  const binary = runtime === 'nerdctl' ? 'nerdctl' : runtime;
  return makeEngine(binary, true);
}

/** Start Colima with the right runtime for the requested engine, then return the engine */
function startColimaForEngine(preferred?: EngineType): Engine | null {
  if (!isColimaInstalled()) return null;
  const runtime = preferred ? colimaRuntimeFor(preferred) : undefined;
  ensureColimaRunning(runtime);
  return engineFromColima(preferred);
}

/**
 * Detection priority (same on both platforms):
 *   1. Colima (already running)
 *   2. Podman (native — no VM on Linux, lightweight on macOS)
 *   3. Docker (native)
 *   4. Standalone nerdctl (rare, needs manual buildkit)
 *   5. Start Colima if installed but not running
 *
 * On Linux, native engines (steps 2-4) have no VM overhead so they're
 * tried before starting a Colima VM. On macOS all container engines
 * need a VM anyway, so running Colima is preferred.
 */
function detect(preferred?: EngineType): Engine | null {
  // 1. Colima (already running) — always checked first, even with --engine
  const fromColima = engineFromColima(preferred);
  if (fromColima) return fromColima;

  // If a specific engine is requested, try it natively
  if (preferred) {
    const binary = preferred === 'nerdctl' ? 'nerdctl' : preferred;
    if (isEngineAvailable(binary)) return makeEngine(binary, false);
  }

  if (!preferred) {
    // 2. Podman
    if (isEngineAvailable('podman')) return makeEngine('podman', false);
    // 3. Docker
    if (isEngineAvailable('docker')) return makeEngine('docker', false);
    // 4. Standalone nerdctl
    if (isEngineAvailable('nerdctl')) return makeEngine('nerdctl', false);
  }

  // 5. Start Colima if installed
  return startColimaForEngine(preferred);
}

export function detectEngine(preferred?: EngineType): Engine {
  if (cachedEngine && !preferred) return cachedEngine;

  const engine = detect(preferred);

  if (!engine) {
    console.error(`No container engine found.${preferred ? ` Requested engine '${preferred}' is not available.` : ''}`);
    console.error('Install Colima (https://colima.run/), Podman, or Docker.');
    process.exit(1);
  }

  if (!preferred) cachedEngine = engine;
  return engine;
}

export function resetEngineCache(): void {
  cachedEngine = null;
}
