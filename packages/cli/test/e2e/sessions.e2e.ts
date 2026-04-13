import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { encodePath } from '@flout/claude';
import { startMockServer, installMockCredentials, restoreCredentials } from '@flout/claude-mock-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const pkgRoot = path.resolve(__dirname, '..', '..');

let mockPort: number;
let mockServer: { server: import('http').Server; port: number };
let credentialsBackup: string | null = null;
let mockBinDir: string;
const credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
const createdSessions: string[] = [];

function flout(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pkgRoot,
    env: {
      ...process.env,
      CLAUDE_CODE_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
      PATH: `${mockBinDir}${path.delimiter}${process.env.PATH}`,
    },
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

function extractSessionId(output: string): string | null {
  const match = output.match(/Session '(flout-\d{4}-\d{6}-[a-z0-9-]+)'/);
  return match ? match[1] : null;
}

function killFloutSessions(): void {
  const result = spawnSync('tmux', ['list-sessions', '-F', '#{session_name}'], { encoding: 'utf8' });
  if (result.status !== 0) return;
  for (const s of result.stdout.trim().split('\n')) {
    if (s.startsWith('flout-')) {
      spawnSync('tmux', ['kill-session', '-t', s]);
    }
  }
}

describe('e2e: sessions', () => {
  before(async () => {
    mockServer = await startMockServer();
    mockPort = mockServer.port;
    credentialsBackup = installMockCredentials(credentialsPath);

    const trustDir = path.join(os.homedir(), '.claude', 'projects', encodePath('/tmp'));
    fs.mkdirSync(trustDir, { recursive: true });

    // Create a mock claude binary so tmux sessions stay alive in CI
    mockBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flout-mock-bin-'));
    fs.writeFileSync(path.join(mockBinDir, 'claude'), '#!/bin/sh\nif [ "$1" = "auth" ]; then exit 0; fi\nsleep 300\n');
    fs.chmodSync(path.join(mockBinDir, 'claude'), 0o755);
    // Ensure tmux sessions can find the mock claude binary
    spawnSync('tmux', ['set-environment', '-g', 'PATH', `${mockBinDir}${path.delimiter}${process.env.PATH}`]);
  });

  after(() => {
    mockServer.server.close();
    restoreCredentials(credentialsPath, credentialsBackup);
    for (const s of createdSessions) {
      spawnSync('tmux', ['kill-session', '-t', s]);
    }
    killFloutSessions();
    fs.rmSync(mockBinDir, { recursive: true, force: true });
  });

  it('starts a session with a name', () => {
    const result = flout('start', 'e2etest', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const id = extractSessionId(result.stdout);
    assert.ok(id, 'should output session ID');
    createdSessions.push(id!);
    assert.match(id!, /^flout-\d{4}-\d{6}-e2etest$/);
  });

  it('starts a session with default name from cwd', () => {
    const result = flout('start', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const id = extractSessionId(result.stdout);
    assert.ok(id, 'should output session ID');
    createdSessions.push(id!);
    assert.ok(id!.includes('flout'), 'should contain cwd basename');
  });

  it('lists sessions with directories', () => {
    const result = flout('list');
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('flout-'), 'should list flout sessions');
  });

  it('stops a session by label', () => {
    const startResult = flout('start', 'stopme', '--path', '/tmp');
    const id = extractSessionId(startResult.stdout);
    assert.ok(id);
    createdSessions.push(id!);

    const stopResult = flout('stop', 'stopme');
    assert.strictEqual(stopResult.exitCode, 0);
    assert.ok(stopResult.stdout.includes('stopped'));

    const check = spawnSync('tmux', ['has-session', '-t', id!]);
    assert.notStrictEqual(check.status, 0, 'session should be gone');
  });

  it('stops a session by full ID', () => {
    const startResult = flout('start', 'byid', '--path', '/tmp');
    const id = extractSessionId(startResult.stdout);
    assert.ok(id);
    createdSessions.push(id!);

    const stopResult = flout('stop', id!);
    assert.strictEqual(stopResult.exitCode, 0);
  });

  it('allows multiple sessions with the same label', () => {
    const r1 = flout('start', 'multi', '--path', '/tmp');
    const id1 = extractSessionId(r1.stdout);
    assert.ok(id1);
    createdSessions.push(id1!);

    spawnSync('sleep', ['1']);

    const r2 = flout('start', 'multi', '--path', '/tmp');
    const id2 = extractSessionId(r2.stdout);
    assert.ok(id2);
    createdSessions.push(id2!);

    assert.notStrictEqual(id1, id2, 'IDs should differ');

    const check1 = spawnSync('tmux', ['has-session', '-t', id1!]);
    const check2 = spawnSync('tmux', ['has-session', '-t', id2!]);
    assert.strictEqual(check1.status, 0);
    assert.strictEqual(check2.status, 0);
  });

  it('disambiguates when multiple sessions match', () => {
    const result = flout('stop', 'multi');
    assert.strictEqual(result.exitCode, 1);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('Multiple sessions'), 'should show disambiguation');
  });

  it('shows status', () => {
    const result = flout('status');
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!result.stdout.includes('Not logged in'));
  });

  it('fails for nonexistent session', () => {
    const result = flout('stop', 'nonexistent-xyz-999');
    assert.strictEqual(result.exitCode, 1);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('No sessions matching'));
  });
});
