const { describe, it } = require('node:test');
const assert = require('node:assert');
const claude = require('../lib/agents/claude');

describe('claude agent', () => {
  it('generates remote command with session name', () => {
    const cmd = claude.remoteCommand('MySession');
    assert.strictEqual(
      cmd,
      'claude remote-control --spawn=session --permission-mode bypassPermissions --name MySession'
    );
  });

  it('generates start command', () => {
    assert.strictEqual(claude.startCommand(), 'claude --permission-mode bypassPermissions');
  });

  it('encodes paths correctly', () => {
    assert.strictEqual(claude.encodePath('/home/bero/Projects'), '-home-bero-Projects');
    assert.strictEqual(claude.encodePath('/'), '-');
    assert.strictEqual(claude.encodePath('/tmp'), '-tmp');
  });

  it('exposes binary name', () => {
    assert.strictEqual(claude.binary, 'claude');
  });

  it('exposes agent name', () => {
    assert.strictEqual(claude.name, 'claude');
  });
});
