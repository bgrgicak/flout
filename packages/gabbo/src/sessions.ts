import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Agent } from './types.js';

function sessionName(name: string): string {
  return name.toLowerCase();
}

function sessionExists(session: string): boolean {
  const result = spawnSync('tmux', ['has-session', '-t', `=${session}`]);
  return result.status === 0;
}

export function start(name: string, dir: string, agent: Agent): void {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: directory '${resolved}' does not exist`);
    process.exit(1);
  }
  if (!agent.isTrusted(resolved)) {
    console.error(`Directory '${resolved}' is not trusted.`);
    console.error(`Run: gabbo trust ${resolved}`);
    process.exit(1);
  }
  const session = sessionName(name);
  if (sessionExists(session)) {
    console.error(`Session '${name}' already exists.`);
    process.exit(1);
  }
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved,
    agent.startCommand(),
  ]);
  console.log(`Session '${name}' started in ${resolved}`);
}

export function remote(name: string, dir: string, agent: Agent): void {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: directory '${resolved}' does not exist`);
    process.exit(1);
  }
  if (!agent.isAuthenticated()) {
    console.error(`Not logged in. Run: ${agent.loginCommand()}`);
    process.exit(1);
  }
  if (!agent.isTrusted(resolved)) {
    console.error(`Directory '${resolved}' is not trusted.`);
    console.error(`Run: gabbo trust ${resolved}`);
    process.exit(1);
  }
  const session = sessionName(name);
  if (sessionExists(session)) {
    console.error(`Session '${name}' already exists.`);
    process.exit(1);
  }
  const cmd = `while true; do ${agent.remoteCommand(name)}; echo "Connection dropped. Restarting in 5s..."; sleep 5; done`;
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved, cmd,
  ]);
  console.log(`Remote session '${name}' started in ${resolved} (auto-reconnect enabled)`);
}

export function stop(name: string): void {
  const session = sessionName(name);
  const result = spawnSync('tmux', ['kill-session', '-t', session]);
  if (result.status === 0) {
    console.log(`Session '${name}' stopped.`);
  } else {
    console.error(`No session named '${session}' found.`);
    process.exit(1);
  }
}

export function join(name: string): void {
  const session = sessionName(name);
  const result = spawnSync('tmux', ['attach', '-t', session], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`No session named '${session}' found.`);
    process.exit(1);
  }
}

export function list(): void {
  const result = spawnSync('tmux', ['list-sessions'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.log('No active sessions.');
  }
}

export function restart(name: string, dir: string, agent: Agent): void {
  const session = sessionName(name);
  spawnSync('tmux', ['kill-session', '-t', session]);
  remote(name, dir, agent);
}

export function status(agent: Agent): void {
  if (!agent.isAuthenticated()) {
    console.log('Not logged in. Run: claude auth login');
    console.log('Then: gabbo remote claude');
    return;
  }
  const result = spawnSync('tmux', ['list-sessions'], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(result.stdout.trimEnd());
  } else {
    console.log('No sessions running. Run: gabbo remote claude');
  }
}
