import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { isColimaInstalled, isColimaRunning, getColimaRuntime } from '../src/colima.js';

describe('colima', () => {
  const hasColima = spawnSync('which', ['colima'], { stdio: 'ignore' }).status === 0;

  describe('isColimaInstalled', () => {
    it('returns a boolean', () => {
      const result = isColimaInstalled();
      assert.strictEqual(typeof result, 'boolean');
    });

    it('matches whether colima binary exists', () => {
      assert.strictEqual(isColimaInstalled(), hasColima);
    });
  });

  describe('isColimaRunning', () => {
    it('returns a boolean', () => {
      const result = isColimaRunning();
      assert.strictEqual(typeof result, 'boolean');
    });

    it('returns false when colima is not installed', () => {
      if (hasColima) return; // skip — colima is installed
      assert.strictEqual(isColimaRunning(), false);
    });
  });

  describe('getColimaRuntime', () => {
    it('returns null when colima is not running', () => {
      if (hasColima && isColimaRunning()) return; // skip — colima is running
      assert.strictEqual(getColimaRuntime(), null);
    });

    it('returns docker or nerdctl when colima is running', () => {
      if (!hasColima || !isColimaRunning()) return; // skip — colima not available
      const runtime = getColimaRuntime();
      assert.ok(runtime === 'docker' || runtime === 'nerdctl',
        `Expected 'docker' or 'nerdctl', got '${runtime}'`);
    });
  });
});
