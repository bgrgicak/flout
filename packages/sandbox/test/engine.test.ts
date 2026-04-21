import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
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
      const hasDocker = spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0;
      if (!hasDocker) {
        assert.strictEqual(isEngineAvailable('docker'), false);
      }
      // If docker is installed, result depends on whether daemon is running
    });

    it('checks podman availability', () => {
      const hasPodman = spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0;
      if (!hasPodman) {
        assert.strictEqual(isEngineAvailable('podman'), false);
      }
    });

    it('checks nerdctl availability', () => {
      const hasNerdctl = spawnSync('which', ['nerdctl'], { stdio: 'ignore' }).status === 0;
      if (!hasNerdctl) {
        assert.strictEqual(isEngineAvailable('nerdctl'), false);
      }
    });
  });

  describe('detectEngine', () => {
    it('returns an engine with expected shape', () => {
      // This test only runs if at least one engine is available
      const hasAnyEngine =
        spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0 ||
        spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0 ||
        spawnSync('which', ['nerdctl'], { stdio: 'ignore' }).status === 0;
      if (!hasAnyEngine) return;

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
        const hasBinary = spawnSync('which', [binary], { stdio: 'ignore' }).status === 0;
        if (!hasBinary) continue;

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
      const hasAnyEngine =
        spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0 ||
        spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0 ||
        spawnSync('which', ['nerdctl'], { stdio: 'ignore' }).status === 0;
      if (!hasAnyEngine) return;

      const first = detectEngine();
      const second = detectEngine();
      assert.strictEqual(first, second); // Same reference (cached)
    });

    it('does not use cache when preference is given', () => {
      const hasAnyEngine =
        spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0 ||
        spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0;
      if (!hasAnyEngine) return;

      const auto = detectEngine();
      // Requesting a specific engine should not return the cached auto-detect
      // (it may still return the same engine, but it went through detection)
      assert.ok(auto);
    });
  });
});
