import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sessions from '../src/sessions.js';
import type { Agent } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(__dirname, '..', '..', 'bin', 'gabbo.js');

// A real agent that runs bash instead of claude.
// This is a legitimate agent implementation — no mocks.
const bashAgent: Agent = {
  name: 'bash-test',
  binary: 'bash',
  remoteCommand(name: string) {
    return `bash -c "while true; do echo running-${name}; sleep 60; done"`;
  },
  startCommand() {
    return 'bash -c "echo started; sleep 60"';
  },
  loginCommand() {
    return 'bash';
  },
  setupTokenCommand() {
    return 'bash';
  },
  isAuthenticated() {
    return true;
  },
  isTrusted() {
    return true;
  },
  trustCommand() {
    return 'bash';
  },
  encodePath(dir: string) {
    return '-' + path.resolve(dir).split('/').filter(Boolean).join('-');
  },
};

const TEST_SESSION = 'gabbo-test-session';

// Clean up any leftover test sessions
after(() => {
  spawnSync('tmux', ['kill-session', '-t', TEST_SESSION]);
  spawnSync('tmux', ['kill-session', '-t', 'gabbo-test']);
});

describe('sessions', () => {
  it('starts and stops a session', () => {
    sessions.start(TEST_SESSION, '/tmp', bashAgent);

    const result = spawnSync('tmux', ['has-session', '-t', TEST_SESSION]);
    assert.strictEqual(result.status, 0, 'session should exist after start');

    sessions.stop(TEST_SESSION);

    const result2 = spawnSync('tmux', ['has-session', '-t', TEST_SESSION]);
    assert.notStrictEqual(result2.status, 0, 'session should not exist after stop');
  });

  it('starts a remote session with respawn loop', () => {
    sessions.remote(TEST_SESSION, '/tmp', bashAgent);

    const result = spawnSync('tmux', ['has-session', '-t', TEST_SESSION]);
    assert.strictEqual(result.status, 0, 'remote session should exist');

    sessions.stop(TEST_SESSION);
  });

  it('refuses to start in a nonexistent directory', () => {
    const result = spawnSync('node', [bin, 'start', 'test', '--path', '/nonexistent-gabbo-test-dir'], {
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('does not exist'));
  });

  it('refuses to start in an untrusted directory', () => {
    const result = spawnSync('node', [bin, 'start', 'test', '--path', '/var/empty'], {
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 1);
  });

  it('rejects duplicate session names', () => {
    sessions.start(TEST_SESSION, '/tmp', bashAgent);

    const result = spawnSync('node', ['-e', `
      import * as s from './dist/src/sessions.js';
      const a = { name:'t', binary:'bash', startCommand(){return 'bash'}, isTrusted(){return true} };
      s.start('${TEST_SESSION}', '/tmp', a);
    `], { encoding: 'utf8', cwd: path.join(__dirname, '..', '..') });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('already exists'));

    sessions.stop(TEST_SESSION);
  });

  it('lowercases session names', () => {
    sessions.start('GaBbO-TeSt', '/tmp', bashAgent);

    const result = spawnSync('tmux', ['has-session', '-t', 'gabbo-test']);
    assert.strictEqual(result.status, 0, 'session should be lowercase');

    spawnSync('tmux', ['kill-session', '-t', 'gabbo-test']);
  });
});
