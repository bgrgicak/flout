import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface DockerAgent {
  encodePath(dir: string): string;
}

const IMAGE_NAME = 'flout';
const CONTAINER_PREFIX = 'flout-';

const EMBEDDED_DOCKERFILE = `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    bash curl git tmux \\
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g flout

RUN useradd -m -s /bin/bash dev

USER dev
RUN curl -fsSL https://claude.ai/install.sh | bash

WORKDIR /home/dev
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc \\
    && echo 'echo ""; flout status; echo ""' >> /home/dev/.bashrc

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

function imageExists(): boolean {
  const result = spawnSync('docker', ['image', 'inspect', IMAGE_NAME], { stdio: 'ignore' });
  return result.status === 0;
}

function containerRunning(name: string): boolean {
  const result = spawnSync('docker', ['container', 'inspect', '--format', '{{.State.Running}}', name], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function checkDocker(): void {
  const result = spawnSync('which', ['docker']);
  if (result.status !== 0) {
    console.error('Docker is not installed or not in PATH.');
    process.exit(1);
  }
}

function buildImage(): void {
  console.log('Building flout image...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flout-'));
  fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), EMBEDDED_DOCKERFILE);
  try {
    execFileSync('docker', ['build', '-t', IMAGE_NAME, tmpDir], { stdio: 'inherit' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function listFloutContainers(): string[] {
  const result = spawnSync('docker', ['ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', '{{.Names}}'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  return result.stdout.trim().split('\n');
}

export function resolveContainer(query: string): string {
  const containers = listFloutContainers();
  const q = sanitizeLabel(query);

  const exact = containers.find(c => c === q);
  if (exact) return exact;

  const matches = containers.filter(c => c.endsWith('-' + q));
  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    console.error(`No containers matching '${query}' found.`);
    process.exit(1);
  }

  console.error(`Multiple containers match '${query}':`);
  for (const c of matches) {
    const info = spawnSync('docker', ['inspect', '--format', '{{.State.Status}}', c], { encoding: 'utf8' });
    const state = info.stdout?.trim() || '?';
    console.error(`  ${c}  (${state})`);
  }
  console.error(`\nUse the full container name to specify which one.`);
  process.exit(1);
}

export interface DockerStartOptions {
  name: string;
  cwd: string;
  extraArgs: string[];
  agent: DockerAgent;
}

export function start({ name, cwd, extraArgs, agent }: DockerStartOptions): string {
  checkDocker();

  if (!imageExists()) {
    buildImage();
  }

  const full = generateContainerName(name);
  const basename = path.basename(cwd);
  const mountTarget = `/home/dev/${basename}`;

  const gitName = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' }).stdout.trim();
  const gitEmail = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' }).stdout.trim();

  const args = [
    'run', '-d', '--init',
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
  ];
  execFileSync('docker', args, { stdio: 'inherit' });

  const encoded = agent.encodePath(mountTarget);
  const trustDir = `/home/dev/.claude/projects/${encoded}`;
  spawnSync('docker', ['exec', full, 'mkdir', '-p', trustDir]);

  console.log(`Container '${full}' created and running.`);
  return full;
}

export interface DockerStopOptions {
  name: string;
}

export function stop({ name }: DockerStopOptions): void {
  checkDocker();
  const full = resolveContainer(name);
  const result = spawnSync('docker', ['stop', full], { stdio: 'inherit' });
  if (result.status === 0) {
    console.log(`Container '${full}' stopped.`);
  } else {
    console.error(`Failed to stop container '${full}'.`);
    process.exit(1);
  }
}

export interface DockerShellOptions {
  name: string;
}

export function shell({ name }: DockerShellOptions): void {
  checkDocker();
  const full = resolveContainer(name);

  if (!containerRunning(full)) {
    console.error(`Container '${full}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync('docker', ['exec', '-it', full, 'bash'], { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export interface DockerClaudeOptions {
  name: string;
}

export function claude({ name }: DockerClaudeOptions): void {
  checkDocker();
  const full = resolveContainer(name);

  if (!containerRunning(full)) {
    console.error(`Container '${full}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync('docker', [
    'exec', '-it', full,
    'claude', '--permission-mode', 'bypassPermissions',
  ], { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export function status(): void {
  checkDocker();
  const containers = listFloutContainers();
  if (containers.length === 0) {
    console.log('No flout containers found.');
    return;
  }
  const result = spawnSync('docker', ['ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', 'table {{.Names}}\t{{.Status}}'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    console.log(result.stdout.trimEnd());
  }
}

export function usage(): void {
  console.log(`flout docker — manage Docker containers

Usage:
  flout docker start [--name <n>] [-- <docker args>]  Build image & start container
  flout docker stop [<name|id>]                        Stop a container
  flout docker shell [<name|id>]                       Exec into a container
  flout docker claude [<name|id>]                      Exec into a container running Claude
  flout docker status                                  List flout containers`);
}
