import { execFileSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import tty from 'tty';
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

const IMAGE_BASE = 'flout-sandbox';
const CONTAINER_PREFIX = 'flout-';

// node:20-slim ships with a pre-existing 'node' user at UID 1000. We delete it
// so 'dev' can take UID 1000, which matches typical Linux host users — that
// way bind-mounted credential files (~/.claude, ~/.local/share/opencode) are
// readable/writable by 'dev' without permission gymnastics.
const EMBEDDED_DOCKERFILE = `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    bash curl git sudo tmux \\
    && rm -rf /var/lib/apt/lists/*

RUN userdel -r node 2>/dev/null || true \\
    && useradd -m -s /bin/bash -u 1000 dev \\
    && adduser dev sudo \\
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

RUN npm install -g @flout/cli @flout/claude opencode-ai

USER dev
WORKDIR /home/dev
RUN echo 'echo ""; flout status; echo ""' >> /home/dev/.bashrc

RUN curl -fsSL https://claude.ai/install.sh | bash
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc
ENV PATH="/home/dev/.local/bin:\${PATH}"

CMD ["sleep", "infinity"]
`;

// Tag the image with a hash of its Dockerfile so any change to the build
// definition transparently triggers a rebuild on the next sandbox start.
const DOCKERFILE_TAG = crypto.createHash('sha256').update(EMBEDDED_DOCKERFILE).digest('hex').slice(0, 12);
const IMAGE_NAME = `${IMAGE_BASE}:${DOCKERFILE_TAG}`;

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

/** Build exec flags: -it when stdin is a real TTY, -i otherwise. */
function execFlags(): string[] {
  return tty.isatty(0) ? ['-it'] : ['-i'];
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
    console.log(`Building ${IMAGE_NAME} image with ${engine.type}...`);
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

  // Ensure host opencode state dir exists so the bind mount has something to point at.
  const opencodeStateDir = path.join(os.homedir(), '.local', 'share', 'opencode');
  fs.mkdirSync(opencodeStateDir, { recursive: true });

  const runArgs = engineArgs(e, [
    'run', '-d',
    ...(e.type !== 'podman' ? ['--init'] : []),
    // Map the host user to UID 1000 (dev) inside the container so
    // bind-mounted credential files appear owned by dev. Only podman needs
    // this — rootful docker already runs without a user namespace.
    ...(e.type === 'podman' ? ['--userns=keep-id:uid=1000,gid=1000'] : []),
    '--name', full,
    '--label', `flout.cwd=${path.resolve(cwd)}`,
    '-v', `${cwd}:${mountTarget}`,
    '-v', `${os.homedir()}/.claude:/home/dev/.claude`,
    '-v', `${opencodeStateDir}:/home/dev/.local/share/opencode`,
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

  const result = spawnSync(e.binary, engineArgs(e, ['exec', ...execFlags(), resolved.name, 'bash']), { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export interface SandboxAgentExecOptions {
  name: string;
  engine?: EngineType;
}

export type SandboxClaudeOptions = SandboxAgentExecOptions;
export type SandboxOpencodeOptions = SandboxAgentExecOptions;

export function claude({ name, engine: preferredEngine }: SandboxClaudeOptions): void {
  const resolved = resolveContainer(name, preferredEngine);
  const e = resolved.engine;

  if (!containerRunning(e, resolved.name)) {
    console.error(`Container '${resolved.name}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync(e.binary, engineArgs(e, [
    'exec', ...execFlags(), resolved.name,
    'claude', '--permission-mode', 'bypassPermissions',
  ]), { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export function opencode({ name, engine: preferredEngine }: SandboxOpencodeOptions): void {
  const resolved = resolveContainer(name, preferredEngine);
  const e = resolved.engine;

  if (!containerRunning(e, resolved.name)) {
    console.error(`Container '${resolved.name}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync(e.binary, engineArgs(e, [
    'exec', ...execFlags(), resolved.name,
    'opencode',
  ]), { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export interface SandboxListRow {
  name: string;       // full container name (used for ops, not display)
  label: string;      // human-friendly suffix
  type: string;       // 'sandbox/<engine>', e.g. 'sandbox/podman'
  directory: string;  // host-side cwd that was mounted in
  age: string;        // e.g. '3m', '12h', '6w'
}

const SANDBOX_NAME_RE = /^flout-\d{4}-\d{6}-(.+)$/;

function getContainerAge(e: Engine, name: string): string {
  // Use {{json ...}} so podman emits an ISO-8601 string instead of Go's
  // default time format (e.g. "2026-05-04 06:57:28.78... +0200 CEST"), which
  // Date.parse can't handle. Docker's StartedAt is already a JSON string.
  const r = spawnSync(e.binary, engineArgs(e, ['inspect', '--format', '{{json .State.StartedAt}}', name]), { encoding: 'utf8' });
  if (r.status !== 0) return '?';
  const raw = r.stdout.trim().replace(/^"|"$/g, '');
  const t = Date.parse(raw);
  if (isNaN(t)) return '?';
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

function getContainerHostCwd(e: Engine, name: string): string {
  // Preferred: read the flout.cwd label set at start-time.
  const label = spawnSync(
    e.binary,
    engineArgs(e, ['inspect', '--format', '{{index .Config.Labels "flout.cwd"}}', name]),
    { encoding: 'utf8' },
  );
  const v = label.stdout?.trim();
  if (label.status === 0 && v && v !== '<no value>') return v;

  // Fallback for containers created before the label existed: scan mounts and
  // pick the one whose destination is /home/dev/<basename> (not .claude / .local).
  const mounts = spawnSync(
    e.binary,
    engineArgs(e, ['inspect', '--format', '{{range .Mounts}}{{.Source}}|{{.Destination}}{{"\\n"}}{{end}}', name]),
    { encoding: 'utf8' },
  );
  if (mounts.status !== 0) return '?';
  for (const line of mounts.stdout.trim().split('\n')) {
    const [source, dest] = line.split('|');
    if (!dest) continue;
    if (!dest.startsWith('/home/dev/')) continue;
    if (dest === '/home/dev/.claude') continue;
    if (dest.startsWith('/home/dev/.local/')) continue;
    return source;
  }
  return '?';
}

export function listRows(preferredEngine?: EngineType): SandboxListRow[] {
  const engines = preferredEngine ? [getEngine(preferredEngine)] : availableEngines();
  const rows: SandboxListRow[] = [];
  for (const e of engines) {
    for (const name of listFloutContainers(e)) {
      const m = name.match(SANDBOX_NAME_RE);
      rows.push({
        name,
        label: m ? m[1] : name,
        type: `sandbox/${e.type}`,
        directory: getContainerHostCwd(e, name),
        age: getContainerAge(e, name),
      });
    }
  }
  return rows;
}

export function usage(): void {
  console.log(`flout sandbox — manage container sandboxes

Usage:
  flout sandbox start [--name <n>] [--engine docker|podman|containerd] [-- <args>]
                                          Build image & start container
  flout sandbox stop [<name|id>]          Stop a container
  flout sandbox shell [<name|id>]         Exec into a container
  flout sandbox claude [<name|id>]        Exec into a container running Claude
  flout sandbox opencode [<name|id>]      Exec into a container running opencode

Use 'flout list' to see running sandboxes alongside local sessions.

Engines:
  docker       Docker Engine (default on Linux)
  podman       Podman (rootless containers)
  containerd   containerd via nerdctl (requires Colima or native containerd)

Auto-detection picks the fastest available engine. On macOS, Colima is preferred.
Colima is started automatically if needed.`);
}

