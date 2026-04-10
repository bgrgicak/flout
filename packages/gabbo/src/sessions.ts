import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Agent } from './types.js';

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

function generateSessionId(label: string): string {
  return `gabbo-${timestamp()}-${sanitizeLabel(label)}`;
}

function listGabboSessions(): string[] {
  const result = spawnSync('tmux', ['list-sessions', '-F', '#{session_name}'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.trim().split('\n').filter(s => s.startsWith('gabbo-'));
}

export function resolveSession(query: string): string {
  const sessions = listGabboSessions();
  const q = sanitizeLabel(query);

  const exact = sessions.find(s => s === q);
  if (exact) return exact;

  const matches = sessions.filter(s => s.endsWith('-' + q));
  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    console.error(`No sessions matching '${query}' found.`);
    process.exit(1);
  }

  console.error(`Multiple sessions match '${query}':`);
  for (const s of matches) {
    const info = spawnSync('tmux', ['display-message', '-t', s, '-p', '#{pane_current_path}'], { encoding: 'utf8' });
    const dir = info.stdout?.trim() || '?';
    console.error(`  ${s}  ${dir}`);
  }
  console.error(`\nUse the full session ID to specify which one.`);
  process.exit(1);
}

export function start(label: string, dir: string, agent: Agent): string {
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
  const session = generateSessionId(label);
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved,
    agent.startCommand(),
  ]);
  console.log(`Session '${session}' started in ${resolved}`);
  return session;
}

export function remote(label: string, dir: string, agent: Agent): string {
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
  const session = generateSessionId(label);
  const cmd = `while true; do ${agent.remoteCommand(session)}; echo "Connection dropped. Restarting in 5s..."; sleep 5; done`;
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved, cmd,
  ]);
  console.log(`Remote session '${session}' started in ${resolved} (auto-reconnect enabled)`);
  return session;
}

export function stop(query: string): void {
  const session = resolveSession(query);
  const result = spawnSync('tmux', ['kill-session', '-t', session]);
  if (result.status === 0) {
    console.log(`Session '${session}' stopped.`);
  } else {
    console.error(`Failed to stop session '${session}'.`);
    process.exit(1);
  }
}

export function join(query: string): void {
  const session = resolveSession(query);
  const result = spawnSync('tmux', ['attach', '-t', session], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Failed to attach to session '${session}'.`);
    process.exit(1);
  }
}

export function list(): void {
  const sessions = listGabboSessions();
  if (sessions.length === 0) {
    console.log('No active sessions.');
    return;
  }
  for (const s of sessions) {
    const info = spawnSync('tmux', ['display-message', '-t', s, '-p', '#{pane_current_path}'], { encoding: 'utf8' });
    const dir = info.stdout?.trim() || '?';
    console.log(`${s}  ${dir}`);
  }
}

export function restart(query: string, dir: string, agent: Agent): string {
  const session = resolveSession(query);
  spawnSync('tmux', ['kill-session', '-t', session]);
  const label = session.replace(/^gabbo-\d{4}-\d{6}-/, '');
  return remote(label, dir, agent);
}

export function status(agent: Agent): void {
  if (!agent.isAuthenticated()) {
    console.log('Not logged in. Run: claude auth login');
    console.log('Then: gabbo remote claude');
    return;
  }
  list();
}
