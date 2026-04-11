import { describe, it } from 'node:test';
import assert from 'node:assert';
import claude, { encodePath } from '../src/index.js';

describe('claude agent', () => {
  it('generates remote command with session name', () => {
    const cmd = claude.remoteCommand('MySession');
    assert.strictEqual(
      cmd,
      'claude remote-control --spawn=session --permission-mode bypassPermissions --name MySession'
    );
  });

  it('generates start command without sudo when not root', () => {
    assert.strictEqual(claude.startCommand(), 'claude --permission-mode bypassPermissions');
  });

  it('generates start command with IS_SANDBOX=1 when root', () => {
    const original = process.getuid;
    process.getuid = () => 0;
    try {
      assert.strictEqual(claude.startCommand(), 'IS_SANDBOX=1 claude --permission-mode bypassPermissions');
    } finally {
      process.getuid = original;
    }
  });

  it('encodes paths correctly', () => {
    assert.strictEqual(encodePath('/home/bero/Projects'), '-home-bero-Projects');
    assert.strictEqual(encodePath('/'), '-');
    assert.strictEqual(encodePath('/tmp'), '-tmp');
  });

  it('exposes binary name', () => {
    assert.strictEqual(claude.binary, 'claude');
  });

  it('exposes agent name', () => {
    assert.strictEqual(claude.name, 'claude');
  });
});
