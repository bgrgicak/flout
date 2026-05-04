import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sessions from '../src/sessions.js';
import type { Agent } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');

sessions.setKnownAgents(['bashtest']);

const createdSessions: string[] = [];

const bashAgent: Agent = {
  name: 'bashtest',
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

after(() => {
  for (const s of createdSessions) {
    spawnSync('tmux', ['kill-session', '-t', s]);
  }
});

describe('sessions', () => {
  it('generates timestamped session IDs', () => {
    const id = sessions.start('myproject', '/tmp', bashAgent);
    createdSessions.push(id);
    assert.match(id, /^flout-\d{4}-\d{6}-bashtest-myproject$/);

    const result = spawnSync('tmux', ['has-session', '-t', id]);
    assert.strictEqual(result.status, 0, 'session should exist');
  });

  it('starts and stops a session by label', () => {
    const id = sessions.start('stoptest', '/tmp', bashAgent);
    createdSessions.push(id);

    const result = spawnSync('tmux', ['has-session', '-t', id]);
    assert.strictEqual(result.status, 0, 'session should exist after start');

    sessions.stop('stoptest');

    const result2 = spawnSync('tmux', ['has-session', '-t', id]);
    assert.notStrictEqual(result2.status, 0, 'session should not exist after stop');
  });

  it('starts a remote session with respawn loop', () => {
    const id = sessions.remote('remotetest', '/tmp', bashAgent);
    createdSessions.push(id);

    const result = spawnSync('tmux', ['has-session', '-t', id]);
    assert.strictEqual(result.status, 0, 'remote session should exist');

    sessions.stop(id);
  });

  it('allows multiple sessions with the same label', () => {
    const id1 = sessions.start('multi', '/tmp', bashAgent);
    createdSessions.push(id1);

    // sleep 1s to get a different timestamp
    spawnSync('sleep', ['1']);

    const id2 = sessions.start('multi', '/tmp', bashAgent);
    createdSessions.push(id2);

    assert.notStrictEqual(id1, id2, 'IDs should differ');

    const r1 = spawnSync('tmux', ['has-session', '-t', id1]);
    const r2 = spawnSync('tmux', ['has-session', '-t', id2]);
    assert.strictEqual(r1.status, 0, 'first session should exist');
    assert.strictEqual(r2.status, 0, 'second session should exist');

    spawnSync('tmux', ['kill-session', '-t', id1]);
    spawnSync('tmux', ['kill-session', '-t', id2]);
  });

  it('resolves a unique label to the full session ID', () => {
    const id = sessions.start('uniquelabel', '/tmp', bashAgent);
    createdSessions.push(id);

    const resolved = sessions.resolveSession('uniquelabel');
    assert.strictEqual(resolved, id);

    spawnSync('tmux', ['kill-session', '-t', id]);
  });

  it('resolves an exact full ID', () => {
    const id = sessions.start('exactmatch', '/tmp', bashAgent);
    createdSessions.push(id);

    const resolved = sessions.resolveSession(id);
    assert.strictEqual(resolved, id);

    spawnSync('tmux', ['kill-session', '-t', id]);
  });

  it('refuses to start in a nonexistent directory', () => {
    const cli = path.join(pkgRoot, 'src', 'cli.ts');
    const result = spawnSync('npx', ['tsx', cli, 'claude', 'test', '--path', '/nonexistent-flout-test-dir'], {
      encoding: 'utf8',
      cwd: pkgRoot,
    });
    assert.strictEqual(result.status, 1);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('does not exist'));
  });

  it('extracts the agent name from a session id', () => {
    const id = sessions.start('agentparse', '/tmp', bashAgent);
    createdSessions.push(id);
    assert.strictEqual(sessions.getAgentFromSession(id), 'bashtest');
    assert.strictEqual(sessions.getLabelFromSession(id), 'agentparse');
    spawnSync('tmux', ['kill-session', '-t', id]);
  });

  it('sanitizes and lowercases labels', () => {
    const id = sessions.start('My_Project.Name', '/tmp', bashAgent);
    createdSessions.push(id);
    assert.match(id, /^flout-\d{4}-\d{6}-bashtest-my-project-name$/);

    spawnSync('tmux', ['kill-session', '-t', id]);
  });
});
