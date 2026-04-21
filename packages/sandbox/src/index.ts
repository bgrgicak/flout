import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectEngine, availableEngines } from './engine.js';
import { isColimaRunning } from './colima.js';
import type { Engine, EngineType } from './engine.js';

export type { Engine, EngineType, EngineInput } from './engine.js';
export { detectEngine, isEngineAvailable, resetEngineCache, normalizeEngine, availableEngines } from './engine.js';
export { isColimaInstalled, isColimaRunning, getColimaRuntime, ensureColimaRunning } from './colima.js';
export type { ColimaRuntime } from './colima.js';

export interface SandboxAgent {
  encodePath(dir: string): string;
}

const IMAGE_NAME = 'flout-claude';
const CONTAINER_PREFIX = 'flout-';

const EMBEDDED_DOCKERFILE = `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    bash curl git sudo tmux \\
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev \\
    && adduser dev sudo \\
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

RUN npm install -g @flout/cli @flout/claude

USER dev
WORKDIR /home/dev
RUN echo 'echo ""; flout status; echo ""' >> /home/dev/.bashrc

RUN curl -fsSL https://claude.ai/install.sh | bash
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc
ENV PATH="/home/dev/.local/bin:\${PATH}"

CMD ["sleep", "infinity"]
`;

function timestamp(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${mm}${dd}-${hh}${min}${ss}`;
}

function sanitizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function generateContainerName(label: string): string {
  return `flout-${timestamp()}-${sanitizeLabel(label)}`;
}

function getEngine(preferred?: EngineType): Engine {
  return detectEngine(preferred);
}

/** Build the full args array for an engine command: prefix + subcommand args */
function engineArgs(engine: Engine, args: string[]): string[] {
  return [...engine.prefix, ...args];
}


function imageExists(engine: Engine, name: string): boolean {
  const result = spawnSync(engine.binary, engineArgs(engine, ['image', 'inspect', name]), { stdio: 'ignore' });
  return result.status === 0;
}

function containerRunning(engine: Engine, name: string): boolean {
  const result = spawnSync(engine.binary, engineArgs(engine, ['container', 'inspect', '--format', '{{.State.Running}}', name]), { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'true';
}

/**
 * Choose a temp directory for the build context.
 * When using Colima, /tmp is inside the VM and not accessible from the host.
 * Colima mounts ~ by default, so we use ~/.cache/flout/ as the build context.
 */
function buildTmpDir(engine: Engine): string {
  if (engine.viaColima) {
    const cacheDir = path.join(os.homedir(), '.cache', 'flout');
    fs.mkdirSync(cacheDir, { recursive: true });
    return fs.mkdtempSync(path.join(cacheDir, 'build-'));
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flout-'));
}

function checkBuildSupport(engine: Engine): void {
  // Colima bundles buildkit inside the VM — no host-side check needed.
  // Only standalone nerdctl (not via Colima) needs buildkit on the host.
  if (engine.type === 'nerdctl' && !engine.viaColima) {
    const buildctl = spawnSync('which', ['buildctl'], { stdio: 'ignore' });
    if (buildctl.status !== 0) {
      console.error('nerdctl build requires buildkit (buildctl + buildkitd).');
      console.error('Install buildkit: https://github.com/moby/buildkit');
      console.error('Or use Colima which bundles buildkit: https://colima.run/');
      process.exit(1);
    }
  }
}

function buildImage(engine: Engine): void {
  checkBuildSupport(engine);
  const tmpDir = buildTmpDir(engine);
  try {
    console.log(`Building flout-claude image with ${engine.type}...`);
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), EMBEDDED_DOCKERFILE);
    execFileSync(engine.binary, engineArgs(engine, ['build', '-t', IMAGE_NAME, tmpDir]), { stdio: 'inherit' });
  } catch {
    if (engine.viaColima && !isColimaRunning()) {
      console.error('Colima VM is not running. It may have crashed or been stopped.');
      console.error('Restart it with: colima start');
    }
    process.exit(1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function listFloutContainers(engine: Engine): string[] {
  const result = spawnSync(engine.binary, engineArgs(engine, ['ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', '{{.Names}}']), { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  return result.stdout.trim().split('\n');
}

export interface ResolvedContainer {
  name: string;
  engine: Engine;
}

export function resolveContainer(name: string, engine?: EngineType): ResolvedContainer {
  const engines = engine ? [getEngine(engine)] : availableEngines();
  const q = sanitizeLabel(name);

  const allMatches: { container: string; engine: Engine }[] = [];

  for (const e of engines) {
    const containers = listFloutContainers(e);
    const exact = containers.find(c => c === q);
    if (exact) return { name: exact, engine: e };
    for (const c of containers.filter(c => c.endsWith('-' + q))) {
      allMatches.push({ container: c, engine: e });
    }
  }

  if (allMatches.length === 1) return { name: allMatches[0].container, engine: allMatches[0].engine };

  if (allMatches.length === 0) {
    console.error(`No containers matching '${name}' found.`);
    process.exit(1);
  }

  console.error(`Multiple containers match '${name}':`);
  for (const { container, engine: e } of allMatches) {
    const info = spawnSync(e.binary, engineArgs(e, ['inspect', '--format', '{{.State.Status}}', container]), { encoding: 'utf8' });
    const state = info.stdout?.trim() || '?';
    const label = e.viaColima ? `${e.type} (colima)` : e.type;
    console.error(`  ${container}  (${state}) [${label}]`);
  }
  console.error(`\nUse the full container name or --engine to specify which one.`);
  process.exit(1);
}

export interface SandboxStartOptions {
  name: string;
  cwd: string;
  extraArgs: string[];
  agent: SandboxAgent;
  engine?: EngineType;
}

function validateMountPath(engine: Engine, hostPath: string): void {
  if (!engine.viaColima) return;
  const home = os.homedir();
  const resolved = path.resolve(hostPath);
  if (!resolved.startsWith(home + '/') && resolved !== home) {
    console.error(`Error: '${resolved}' is outside your home directory.`);
    console.error(`Colima can only mount paths under ${home}.`);
    console.error('Move your project under ~ or use a native engine (--engine docker).');
    process.exit(1);
  }
}

export function start({ name, cwd, extraArgs, agent, engine: preferredEngine }: SandboxStartOptions): string {
  const e = getEngine(preferredEngine);

  validateMountPath(e, cwd);

  if (!imageExists(e, IMAGE_NAME)) {
    buildImage(e);
  }

  const full = generateContainerName(name);
  const basename = path.basename(cwd);
  const mountTarget = `/home/dev/${basename}`;

  const gitName = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' }).stdout.trim();
  const gitEmail = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' }).stdout.trim();

  const runArgs = engineArgs(e, [
    'run', '-d',
    ...(e.type !== 'podman' ? ['--init'] : []),
    '--name', full,
    '-v', `${cwd}:${mountTarget}`,
    '-v', `${os.homedir()}/.claude:/home/dev/.claude`,
    '-w', mountTarget,
    '-e', `GIT_AUTHOR_NAME=${gitName}`,
    '-e', `GIT_AUTHOR_EMAIL=${gitEmail}`,
    '-e', `GIT_COMMITTER_NAME=${gitName}`,
    '-e', `GIT_COMMITTER_EMAIL=${gitEmail}`,
    '-e', 'TERM=xterm-256color',
    '-e', 'COLORTERM=truecolor',
    ...extraArgs,
    IMAGE_NAME,
  ]);
  try {
    execFileSync(e.binary, runArgs, { stdio: 'inherit' });
  } catch {
    if (e.viaColima && !isColimaRunning()) {
      console.error('Colima VM is not running. It may have crashed or been stopped.');
      console.error('Restart it with: colima start');
    }
    process.exit(1);
  }

  const encoded = agent.encodePath(mountTarget);
  const trustDir = `/home/dev/.claude/projects/${encoded}`;
  spawnSync(e.binary, engineArgs(e, ['exec', full, 'mkdir', '-p', trustDir]));

  console.log(`Container '${full}' created and running (engine: ${e.type}${e.viaColima ? ' via colima' : ''}).`);
  return full;
}

export interface SandboxStopOptions {
  name: string;
  engine?: EngineType;
}

export function stop({ name, engine: preferredEngine }: SandboxStopOptions): void {
  const resolved = resolveContainer(name, preferredEngine);
  const result = spawnSync(resolved.engine.binary, engineArgs(resolved.engine, ['rm', '-f', resolved.name]), { stdio: 'inherit' });
  if (result.status === 0) {
    console.log(`Container '${resolved.name}' removed.`);
  } else {
    console.error(`Failed to remove container '${resolved.name}'.`);
    process.exit(1);
  }
}

export interface SandboxShellOptions {
  name: string;
  engine?: EngineType;
}

export function shell({ name, engine: preferredEngine }: SandboxShellOptions): void {
  const resolved = resolveContainer(name, preferredEngine);
  const e = resolved.engine;

  if (!containerRunning(e, resolved.name)) {
    console.error(`Container '${resolved.name}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync(e.binary, engineArgs(e, ['exec', '-it', resolved.name, 'bash']), { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export interface SandboxClaudeOptions {
  name: string;
  engine?: EngineType;
}

export function claude({ name, engine: preferredEngine }: SandboxClaudeOptions): void {
  const resolved = resolveContainer(name, preferredEngine);
  const e = resolved.engine;

  if (!containerRunning(e, resolved.name)) {
    console.error(`Container '${resolved.name}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync(e.binary, engineArgs(e, [
    'exec', '-it', resolved.name,
    'claude', '--permission-mode', 'bypassPermissions',
  ]), { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export function status(preferredEngine?: EngineType): void {
  const engines = preferredEngine ? [getEngine(preferredEngine)] : availableEngines();

  let found = false;
  for (const e of engines) {
    const containers = listFloutContainers(e);
    if (containers.length === 0) continue;
    const result = spawnSync(e.binary, engineArgs(e, ['ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', `{{.Names}}\t{{.Status}}`]), { encoding: 'utf8' });
    if (result.status !== 0 || !result.stdout.trim()) continue;
    const engineLabel = e.viaColima ? `${e.type} (colima)` : e.type;
    for (const line of result.stdout.trim().split('\n')) {
      const [name, ...rest] = line.split('\t');
      console.log(`${name}\t${rest.join('\t')}\t[${engineLabel}]`);
      found = true;
    }
  }

  if (!found) {
    console.log('No flout containers found.');
  }
}

export function usage(): void {
  console.log(`flout sandbox — manage container sandboxes

Usage:
  flout sandbox start [--name <n>] [--engine docker|podman|containerd] [-- <args>]
                                          Build image & start container
  flout sandbox stop [<name|id>]          Stop a container
  flout sandbox shell [<name|id>]         Exec into a container
  flout sandbox claude [<name|id>]        Exec into a container running Claude
  flout sandbox status                    List flout containers

Engines:
  docker       Docker Engine (default on Linux)
  podman       Podman (rootless containers)
  containerd   containerd via nerdctl (requires Colima or native containerd)

Auto-detection picks the fastest available engine. On macOS, Colima is preferred.
Colima is started automatically if needed.`);
}

