import { describe, it } from 'node:test';
import assert from 'node:assert';
import codex, { encodePath, isTrustedProject } from '../src/index.js';

describe('codex agent', () => {
  it('generates remote command', () => {
    assert.strictEqual(codex.remoteCommand(), 'codex remote-control start');
  });

  it('generates start command with bypassed approvals and sandbox', () => {
    assert.strictEqual(codex.startCommand(), 'codex --dangerously-bypass-approvals-and-sandbox');
  });

  it('login command is codex login', () => {
    assert.strictEqual(codex.loginCommand(), 'codex login');
  });

  it('does not expose a setupTokenCommand', () => {
    assert.strictEqual((codex as { setupTokenCommand?: unknown }).setupTokenCommand, undefined);
  });

  it('detects trusted Codex projects in config.toml', () => {
    const config = [
      'model = "gpt-5"',
      '[projects."/tmp/flout-codex"]',
      'trust_level = "trusted"',
      '',
      '[projects."/tmp/untrusted"]',
      'trust_level = "untrusted"',
    ].join('\n');

    assert.strictEqual(isTrustedProject(config, '/tmp/flout-codex'), true);
    assert.strictEqual(isTrustedProject(config, '/tmp/untrusted'), false);
    assert.strictEqual(isTrustedProject(config, '/tmp/missing'), false);
  });

  it('matches escaped project paths', () => {
    const config = [
      '[projects."/tmp/flout-\\"quoted\\""]',
      'trust_level = "trusted"',
    ].join('\n');

    assert.strictEqual(isTrustedProject(config, '/tmp/flout-"quoted"'), true);
  });

  it('isAuthenticated returns a boolean', () => {
    assert.strictEqual(typeof codex.isAuthenticated(), 'boolean');
  });

  it('encodes paths correctly', () => {
    assert.strictEqual(encodePath('/home/bero/Projects'), '-home-bero-Projects');
    assert.strictEqual(encodePath('/'), '-');
    assert.strictEqual(encodePath('/tmp'), '-tmp');
  });

  it('exposes binary name', () => {
    assert.strictEqual(codex.binary, 'codex');
  });

  it('exposes agent name', () => {
    assert.strictEqual(codex.name, 'codex');
  });
});
