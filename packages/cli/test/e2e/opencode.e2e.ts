import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const pkgRoot = path.resolve(__dirname, '..', '..');

const opencodeAvailable = spawnSync('which', ['opencode'], { stdio: 'ignore' }).status === 0;

const createdSessions: string[] = [];

function flout(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pkgRoot,
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

function extractSessionId(output: string): string | null {
  const match = output.match(/Session '(flout-\d{4}-\d{6}-[a-z0-9-]+)'/);
  return match ? match[1] : null;
}

function tmuxHasSession(name: string): boolean {
  return spawnSync('tmux', ['has-session', '-t', name]).status === 0;
}

function paneCommand(session: string): string {
  // Check both "what was launched" and "what's running now". Different tmux
  // versions populate these differently; either being non-empty is fine.
  const start = spawnSync('tmux', ['display-message', '-t', session, '-p', '#{pane_start_command}'], { encoding: 'utf8' }).stdout.trim();
  const current = spawnSync('tmux', ['display-message', '-t', session, '-p', '#{pane_current_command}'], { encoding: 'utf8' }).stdout.trim();
  return `${start} ${current}`;
}

const suite = opencodeAvailable ? describe : describe.skip;

suite('e2e: opencode agent', () => {
  before(() => {
    if (!opencodeAvailable) {
      console.log('  (skipped: opencode binary not found in PATH)');
    }
  });

  after(() => {
    for (const s of createdSessions) {
      spawnSync('tmux', ['kill-session', '-t', s]);
    }
  });

  it('starts a session that runs opencode', () => {
    const result = flout('opencode', 'oc-e2e', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const id = extractSessionId(result.stdout);
    assert.ok(id, `should output session ID, got: ${result.stdout}`);
    createdSessions.push(id!);

    assert.match(id!, /^flout-\d{4}-\d{6}-opencode-oc-e2e$/);
    assert.ok(tmuxHasSession(id!), 'tmux session should exist');
    assert.ok(paneCommand(id!).includes('opencode'), `pane command should invoke opencode, got: ${paneCommand(id!)}`);
  });

  it('list shows the opencode session', () => {
    const result = flout('list');
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('oc-e2e'), `list should contain oc-e2e, got: ${result.stdout}`);
  });

  it('status reports opencode logged in (built-in models)', () => {
    const result = flout('status');
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('opencode: logged in'), `expected opencode logged-in line, got: ${result.stdout}`);
  });

  it('stops the session', () => {
    const id = createdSessions[0];
    const result = flout('stop', id);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(!tmuxHasSession(id), 'tmux session should be gone');
  });

  it('refuses opencode remote (opencode has no remote-control mode)', () => {
    const result = flout('opencode', 'remote', 'oc-remote', '--path', '/tmp');
    assert.strictEqual(result.exitCode, 1);
    assert.ok(result.stderr.includes('does not support remote-control'));
  });
});
