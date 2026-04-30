import { describe, it } from 'node:test';
import assert from 'node:assert';
import opencode, { encodePath } from '../src/index.js';

describe('opencode agent', () => {
  it('does not expose a remoteCommand (opencode has no remote-control mode)', () => {
    assert.strictEqual((opencode as { remoteCommand?: unknown }).remoteCommand, undefined);
  });

  it('does not expose a setupTokenCommand (opencode auth login is sufficient)', () => {
    assert.strictEqual((opencode as { setupTokenCommand?: unknown }).setupTokenCommand, undefined);
  });

  it('generates start command', () => {
    assert.strictEqual(opencode.startCommand(), 'opencode');
  });

  it('login command is opencode auth login', () => {
    assert.strictEqual(opencode.loginCommand(), 'opencode auth login');
  });

  it('isTrusted always returns true (opencode has no per-directory trust)', () => {
    assert.strictEqual(opencode.isTrusted(), true);
  });

  it('isAuthenticated reflects binary presence (opencode works out of the box)', () => {
    // We don't assert true/false (depends on whether opencode is installed in this env),
    // but it must be a boolean — never throw.
    assert.strictEqual(typeof opencode.isAuthenticated(), 'boolean');
  });

  it('encodes paths correctly', () => {
    assert.strictEqual(encodePath('/home/bero/Projects'), '-home-bero-Projects');
    assert.strictEqual(encodePath('/'), '-');
    assert.strictEqual(encodePath('/tmp'), '-tmp');
  });

  it('exposes binary name', () => {
    assert.strictEqual(opencode.binary, 'opencode');
  });

  it('exposes agent name', () => {
    assert.strictEqual(opencode.name, 'opencode');
  });
});
