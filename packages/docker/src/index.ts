import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface DockerAgent {
  encodePath(dir: string): string;
}

const IMAGE_NAME = 'gabbo';
const CONTAINER_PREFIX = 'gabbo-';

const EMBEDDED_DOCKERFILE = `FROM node:20-slim

RUN apt-get update && apt-get install -y \\
    bash curl git sudo tmux \\
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev \\
    && adduser dev sudo \\
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

USER dev
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN npm install -g gabbo

WORKDIR /home/dev
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc \\
    && echo 'echo ""; gabbo status; echo ""' >> /home/dev/.bashrc

ENV PATH="/home/dev/.local/bin:\${PATH}"
CMD ["sleep", "infinity"]
`;

function containerName(name: string): string {
  return CONTAINER_PREFIX + name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function imageExists(): boolean {
  const result = spawnSync('docker', ['image', 'inspect', IMAGE_NAME], { stdio: 'ignore' });
  return result.status === 0;
}

function containerExists(name: string): boolean {
  const full = containerName(name);
  const result = spawnSync('docker', ['container', 'inspect', full], { stdio: 'ignore' });
  return result.status === 0;
}

function containerRunning(name: string): boolean {
  const full = containerName(name);
  const result = spawnSync('docker', ['container', 'inspect', '--format', '{{.State.Running}}', full], { encoding: 'utf8' });
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
  console.log('Building gabbo image...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gabbo-'));
  fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), EMBEDDED_DOCKERFILE);
  try {
    execFileSync('docker', ['build', '-t', IMAGE_NAME, tmpDir], { stdio: 'inherit' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export interface DockerStartOptions {
  name: string;
  cwd: string;
  extraArgs: string[];
  agent: DockerAgent;
}

export function start({ name, cwd, extraArgs, agent }: DockerStartOptions): void {
  checkDocker();

  if (!imageExists()) {
    buildImage();
  }

  const full = containerName(name);
  const basename = path.basename(cwd);
  const mountTarget = `/home/dev/${basename}`;

  if (containerRunning(name)) {
    console.log(`Container '${full}' is already running.`);
    return;
  }

  if (containerExists(name)) {
    execFileSync('docker', ['start', full], { stdio: 'inherit' });
    console.log(`Container '${full}' started.`);
    return;
  }

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
}

export interface DockerStopOptions {
  name: string;
}

export function stop({ name }: DockerStopOptions): void {
  checkDocker();
  const full = containerName(name);
  const result = spawnSync('docker', ['stop', full], { stdio: 'inherit' });
  if (result.status === 0) {
    console.log(`Container '${full}' stopped.`);
  } else {
    console.error(`No running container '${full}' found.`);
    process.exit(1);
  }
}

export interface DockerShellOptions {
  name: string;
}

export function shell({ name }: DockerShellOptions): void {
  checkDocker();
  const full = containerName(name);
  const mountTarget = `/home/dev/${name}`;

  if (!containerRunning(name)) {
    console.error(`Container '${full}' is not running.`);
    process.exit(1);
  }

  const result = spawnSync('docker', ['exec', '-it', '-w', mountTarget, full, 'bash'], { stdio: 'inherit' });
  if (result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }
}

export function status(): void {
  checkDocker();
  const result = spawnSync('docker', ['ps', '-a', '--filter', `name=${CONTAINER_PREFIX}`, '--format', 'table {{.Names}}\t{{.Status}}'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) {
    console.log(result.stdout.trimEnd());
  } else {
    console.log('No gabbo containers found.');
  }
}

export function usage(): void {
  console.log(`gabbo docker — manage Docker containers

Usage:
  gabbo docker start [--name <n>] [-- <docker args>]  Build image & start container
  gabbo docker stop [--name <n>]                       Stop a container
  gabbo docker shell [--name <n>]                      Exec into a container
  gabbo docker status                                  List gabbo containers`);
}
