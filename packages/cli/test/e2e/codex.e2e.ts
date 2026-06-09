import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const pkgRoot = path.resolve(__dirname, '..', '..');

let mockBinDir: string;
let codexHome: string;
const createdSessions: string[] = [];

function flout(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pkgRoot,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

function extractSessionId(output: string): string | null {
  const match = output.match(/(?:Remote session|Session) '(flout-\d{4}-\d{6}-[a-z0-9-]+)'/);
  return match ? match[1] : null;
}

function tmuxHasSession(name: string): boolean {
  return spawnSync('tmux', ['has-session', '-t', name]).status === 0;
}

function paneCommand(session: string): string {
  const start = spawnSync('tmux', ['display-message', '-t', session, '-p', '#{pane_start_command}'], { encoding: 'utf8' }).stdout.trim();
  const current = spawnSync('tmux', ['display-message', '-t', session, '-p', '#{pane_current_command}'], { encoding: 'utf8' }).stdout.trim();
  return `${start} ${current}`;
}

describe('e2e: codex agent', () => {
  before(() => {
    codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'flout-codex-home-'));
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
      '[projects."/tmp"]',
      'trust_level = "trusted"',
      '',
    ].join('\n'));

    mockBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flout-mock-bin-'));
    fs.writeFileSync(path.join(mockBinDir, 'codex'), [
      '#!/bin/sh',
      'if [ "$1" = "login" ] && [ "$2" = "status" ]; then exit 0; fi',
      'sleep 300',
      '',
    ].join('\n'));
    fs.chmodSync(path.join(mockBinDir, 'codex'), 0o755);

    spawnSync('tmux', ['set-environment', '-g', 'PATH', `${mockBinDir}${path.delimiter}${process.env.PATH}`]);
    spawnSync('tmux', ['set-environment', '-g', 'CODEX_HOME', codexHome]);
  });

  after(() => {
    for (const s of createdSessions) {
      spawnSync('tmux', ['kill-session', '-t', s]);
    }
    spawnSync('tmux', ['set-environment', '-gu', 'CODEX_HOME']);
    fs.rmSync(mockBinDir, { recursive: true, force: true });
    fs.rmSync(codexHome, { recursive: true, force: true });
  });

  it('starts a local session that runs codex', () => {
    const result = flout('codex', 'codex-e2e', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const id = extractSessionId(result.stdout);
    assert.ok(id, `should output session ID, got: ${result.stdout}`);
    createdSessions.push(id!);

    assert.match(id!, /^flout-\d{4}-\d{6}-codex-codex-e2e$/);
    assert.ok(tmuxHasSession(id!), 'tmux session should exist');
    assert.ok(paneCommand(id!).includes('codex'), `pane command should invoke codex, got: ${paneCommand(id!)}`);
  });

  it('starts a remote Codex session', () => {
    const result = flout('codex', 'remote', 'codex-remote', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const id = extractSessionId(result.stdout);
    assert.ok(id, `should output remote session ID, got: ${result.stdout}`);
    createdSessions.push(id!);

    assert.match(id!, /^flout-\d{4}-\d{6}-codex-codex-remote$/);
    assert.ok(tmuxHasSession(id!), 'remote tmux session should exist');
    assert.ok(paneCommand(id!).includes('codex remote-control start'), `pane command should invoke codex remote-control, got: ${paneCommand(id!)}`);
  });

  it('status reports codex logged in', () => {
    const result = flout('status');
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('codex: logged in'), `expected codex logged-in line, got: ${result.stdout}`);
  });

  it('stops a Codex session', () => {
    const id = createdSessions[0];
    const result = flout('stop', id);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!tmuxHasSession(id), 'tmux session should be gone');
  });
});
