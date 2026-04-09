const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync, execFileSync } = require('child_process');
const path = require('path');
const sessions = require('../lib/sessions');

// A real agent that runs bash instead of claude.
// This is a legitimate agent implementation — no mocks.
const bashAgent = {
  name: 'bash-test',
  binary: 'bash',
  remoteCommand(name) {
    return `bash -c "while true; do echo running-${name}; sleep 60; done"`;
  },
  startCommand() {
    return 'bash -c "echo started; sleep 60"';
  },
  isTrusted() {
    return true;
  },
};

const TEST_SESSION = 'gabbo-test-session';
const bin = path.join(__dirname, '..', 'bin', 'gabbo.js');

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
    // Test via subprocess since process.exit(1) would kill the test runner
    const result = spawnSync('node', [bin, 'start', 'test', '--path', '/nonexistent-gabbo-test-dir'], {
      encoding: 'utf8',
    });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('does not exist'));
  });

  it('refuses to start in an untrusted directory', () => {
    // Use a real directory that is unlikely to be trusted
    const result = spawnSync('node', [bin, 'start', 'test', '--path', '/var/empty'], {
      encoding: 'utf8',
    });
    // Either it doesn't exist or it's not trusted — both should exit 1
    assert.strictEqual(result.status, 1);
  });

  it('rejects duplicate session names', () => {
    sessions.start(TEST_SESSION, '/tmp', bashAgent);

    // Use a helper script that calls sessions.start with bashAgent to avoid
    // the CLI's claude agent (which won't trust /tmp).
    const result = spawnSync('node', ['-e', `
      const s = require('./lib/sessions');
      const a = { name:'t', binary:'bash', startCommand(){return 'bash'}, isTrusted(){return true} };
      s.start('${TEST_SESSION}', '/tmp', a);
    `], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
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
