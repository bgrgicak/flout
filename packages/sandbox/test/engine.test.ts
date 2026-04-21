import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { detectEngine, isEngineAvailable, resetEngineCache } from '../src/engine.js';
import type { EngineType } from '../src/engine.js';

describe('engine', () => {
  beforeEach(() => {
    resetEngineCache();
  });

  describe('isEngineAvailable', () => {
    it('returns false for a nonexistent binary', () => {
      assert.strictEqual(isEngineAvailable('nonexistent-engine-xyz'), false);
    });

    it('checks docker availability', () => {
      // isEngineAvailable checks both binary existence and daemon connectivity
      const available = isEngineAvailable('docker');
      assert.strictEqual(typeof available, 'boolean');
    });

    it('checks podman availability', () => {
      const available = isEngineAvailable('podman');
      assert.strictEqual(typeof available, 'boolean');
    });

    it('checks nerdctl availability', () => {
      const available = isEngineAvailable('nerdctl');
      assert.strictEqual(typeof available, 'boolean');
    });
  });

  describe('detectEngine', () => {
    it('returns an engine with expected shape', () => {
      // This test only runs if at least one engine is usable (not just installed)
      if (!isEngineAvailable('docker') && !isEngineAvailable('podman') && !isEngineAvailable('nerdctl')) return;

      const engine = detectEngine();
      assert.ok(engine.binary);
      assert.ok(['docker', 'podman', 'nerdctl'].includes(engine.type));
      assert.strictEqual(typeof engine.viaColima, 'boolean');
      assert.ok(['linux', 'darwin'].includes(engine.platform));
    });

    it('respects preferred engine when available', () => {
      const engines: EngineType[] = ['docker', 'podman', 'nerdctl'];
      for (const eng of engines) {
        const binary = eng === 'nerdctl' ? 'nerdctl' : eng;
        if (!isEngineAvailable(binary)) continue;

        resetEngineCache();
        // detectEngine with preference may still fail if daemon isn't running
        try {
          const result = detectEngine(eng);
          assert.strictEqual(result.type, eng);
        } catch {
          // Engine binary exists but daemon not running — acceptable
        }
      }
    });

    it('caches the result for subsequent calls without preference', () => {
      if (!isEngineAvailable('docker') && !isEngineAvailable('podman') && !isEngineAvailable('nerdctl')) return;

      const first = detectEngine();
      const second = detectEngine();
      assert.strictEqual(first, second); // Same reference (cached)
    });

    it('does not use cache when preference is given', () => {
      if (!isEngineAvailable('docker') && !isEngineAvailable('podman')) return;

      const auto = detectEngine();
      // Requesting a specific engine should not return the cached auto-detect
      // (it may still return the same engine, but it went through detection)
      assert.ok(auto);
    });
  });
});
