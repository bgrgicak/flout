import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { normalizeEngine, detectEngine, resetEngineCache, isEngineAvailable } from '../src/engine.js';
import { isColimaInstalled, isColimaRunning, getColimaRuntime } from '../src/colima.js';
import type { EngineType } from '../src/engine.js';

describe('normalizeEngine', () => {
  it('maps containerd to nerdctl', () => {
    assert.strictEqual(normalizeEngine('containerd'), 'nerdctl');
  });

  it('passes through docker', () => {
    assert.strictEqual(normalizeEngine('docker'), 'docker');
  });

  it('passes through podman', () => {
    assert.strictEqual(normalizeEngine('podman'), 'podman');
  });

  it('passes through nerdctl', () => {
    assert.strictEqual(normalizeEngine('nerdctl'), 'nerdctl');
  });
});

describe('engine type: docker', () => {
  const hasDocker = spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0;

  beforeEach(() => resetEngineCache());

  it('detects docker when available', { skip: !hasDocker ? 'docker not installed' : undefined }, () => {
    // docker may be installed but daemon not running
    if (!isEngineAvailable('docker')) return;
    const engine = detectEngine('docker');
    assert.strictEqual(engine.type, 'docker');
    assert.strictEqual(engine.binary, 'docker');
  });

  it('docker binary supports expected commands', { skip: !hasDocker ? 'docker not installed' : undefined }, () => {
    if (!isEngineAvailable('docker')) return;
    // Verify the commands sandbox uses all exist
    for (const subcmd of ['ps', 'run', 'exec', 'rm', 'build', 'inspect']) {
      const result = spawnSync('docker', [subcmd, '--help'], { stdio: 'ignore' });
      assert.strictEqual(result.status, 0, `docker ${subcmd} --help should succeed`);
    }
  });

  it('docker image inspect works', { skip: !hasDocker ? 'docker not installed' : undefined }, () => {
    if (!isEngineAvailable('docker')) return;
    const result = spawnSync('docker', ['image', 'inspect', 'nonexistent-test-image'], { stdio: 'ignore' });
    assert.strictEqual(result.status, 1, 'inspect of nonexistent image should fail');
  });
});

describe('engine type: podman', () => {
  const hasPodman = spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0;

  beforeEach(() => resetEngineCache());

  it('detects podman when available', { skip: !hasPodman ? 'podman not installed' : undefined }, () => {
    if (!isEngineAvailable('podman')) return;
    const engine = detectEngine('podman');
    assert.strictEqual(engine.type, 'podman');
    assert.strictEqual(engine.binary, 'podman');
  });

  it('podman binary supports expected commands', { skip: !hasPodman ? 'podman not installed' : undefined }, () => {
    if (!isEngineAvailable('podman')) return;
    for (const subcmd of ['ps', 'run', 'exec', 'rm', 'build', 'inspect']) {
      const result = spawnSync('podman', [subcmd, '--help'], { stdio: 'ignore' });
      assert.strictEqual(result.status, 0, `podman ${subcmd} --help should succeed`);
    }
  });

  it('podman image inspect works', { skip: !hasPodman ? 'podman not installed' : undefined }, () => {
    if (!isEngineAvailable('podman')) return;
    const result = spawnSync('podman', ['image', 'inspect', 'nonexistent-test-image'], { stdio: 'ignore' });
    assert.strictEqual(result.status, 125, 'inspect of nonexistent image should fail');
  });
});

describe('engine type: nerdctl (containerd)', () => {
  const hasNerdctl = spawnSync('which', ['nerdctl'], { stdio: 'ignore' }).status === 0;

  beforeEach(() => resetEngineCache());

  it('detects nerdctl when available', { skip: !hasNerdctl ? 'nerdctl not installed' : undefined }, () => {
    const engine = detectEngine('nerdctl');
    assert.strictEqual(engine.type, 'nerdctl');
    assert.strictEqual(engine.binary, 'nerdctl');
  });

  it('nerdctl binary supports expected commands', { skip: !hasNerdctl ? 'nerdctl not installed' : undefined }, () => {
    for (const subcmd of ['ps', 'run', 'exec', 'rm', 'build', 'inspect']) {
      const result = spawnSync('nerdctl', [subcmd, '--help'], { stdio: 'ignore' });
      assert.strictEqual(result.status, 0, `nerdctl ${subcmd} --help should succeed`);
    }
  });
});

describe('engine type: colima integration', () => {
  const hasColima = isColimaInstalled();

  beforeEach(() => resetEngineCache());

  it('colima is installed', { skip: !hasColima ? 'colima not installed' : undefined }, () => {
    assert.strictEqual(isColimaInstalled(), true);
  });

  it('detects colima runtime when running', {
    skip: !hasColima || !isColimaRunning() ? 'colima not running' : undefined,
  }, () => {
    const runtime = getColimaRuntime();
    assert.ok(runtime === 'docker' || runtime === 'nerdctl',
      `Expected 'docker' or 'nerdctl', got '${runtime}'`);
  });

  it('auto-detection prefers colima when running', {
    skip: !hasColima || !isColimaRunning() ? 'colima not running' : undefined,
  }, () => {
    const engine = detectEngine();
    assert.strictEqual(engine.viaColima, true,
      'should prefer Colima when it is running');
    const runtime = getColimaRuntime();
    assert.strictEqual(engine.type, runtime,
      `engine type should match Colima runtime '${runtime}'`);
  });

  it('auto-starts colima when engine requested but not available natively', {
    skip: !hasColima ? 'colima not installed' : undefined,
  }, () => {
    // This test validates that detectEngine doesn't exit(1) when colima
    // can provide the engine. We don't actually want to start colima in
    // unit tests if it's not already running, so just verify the detection
    // logic doesn't crash.
    if (isColimaRunning()) {
      const runtime = getColimaRuntime();
      if (runtime) {
        const engine = detectEngine(runtime);
        assert.ok(engine, 'should detect engine via running colima');
      }
    }
  });
});

describe('engine priority order', () => {
  beforeEach(() => resetEngineCache());

  it('prefers Colima when running', {
    skip: !isColimaRunning() ? 'colima not running' : undefined,
  }, () => {
    const engine = detectEngine();
    assert.strictEqual(engine.viaColima, true,
      `should prefer Colima, got ${engine.binary} (viaColima=${engine.viaColima})`);
  });

  it('prefers Podman over Docker when Colima is not running', {
    // This test can only run when Colima is NOT running and both podman+docker exist
    skip: isColimaRunning() ? 'colima is running (would be preferred)' : undefined,
  }, () => {
    const hasPodman = isEngineAvailable('podman');
    const hasDocker = isEngineAvailable('docker');
    if (!hasPodman || !hasDocker) return; // need both to test ordering

    const engine = detectEngine();
    assert.strictEqual(engine.type, 'podman',
      `should prefer podman over docker, got ${engine.type}`);
  });

  it('falls back to Docker when Podman unavailable and Colima not running', {
    skip: isColimaRunning() ? 'colima is running (would be preferred)' : undefined,
  }, () => {
    const hasPodman = isEngineAvailable('podman');
    const hasDocker = isEngineAvailable('docker');
    if (hasPodman || !hasDocker) return; // only test when podman absent, docker present

    const engine = detectEngine();
    assert.strictEqual(engine.type, 'docker');
  });

  it('explicit --engine overrides priority', () => {
    const hasDocker = isEngineAvailable('docker');
    if (!hasDocker) return;

    const engine = detectEngine('docker');
    assert.strictEqual(engine.type, 'docker',
      'explicit docker preference should be honored');
  });
});

describe('cross-engine compatibility', () => {
  beforeEach(() => resetEngineCache());

  it('auto-detected engine has valid type', () => {
    const hasAnyEngine =
      spawnSync('which', ['docker'], { stdio: 'ignore' }).status === 0 ||
      spawnSync('which', ['podman'], { stdio: 'ignore' }).status === 0 ||
      spawnSync('which', ['nerdctl'], { stdio: 'ignore' }).status === 0;
    if (!hasAnyEngine) return;

    const engine = detectEngine();
    assert.ok(['docker', 'podman', 'nerdctl'].includes(engine.type),
      `engine type should be docker, podman, or nerdctl, got '${engine.type}'`);
    assert.ok(['docker', 'podman', 'nerdctl', 'colima'].includes(engine.binary),
      `engine binary should be docker, podman, nerdctl, or colima, got '${engine.binary}'`);
  });

  it('all available engines support container inspect format', () => {
    const engines: Array<{ name: EngineType; binary: string }> = [
      { name: 'docker', binary: 'docker' },
      { name: 'podman', binary: 'podman' },
      { name: 'nerdctl', binary: 'nerdctl' },
    ];

    for (const { name, binary } of engines) {
      if (!isEngineAvailable(binary)) continue;
      resetEngineCache();

      // Verify container inspect --format works (used by containerRunning)
      const result = spawnSync(binary, [
        'container', 'inspect', '--format', '{{.State.Running}}', 'nonexistent-test',
      ], { encoding: 'utf8' });
      // Should fail (container doesn't exist) but not crash
      assert.notStrictEqual(result.status, null,
        `${name}: container inspect should return a status code`);
    }
  });

  it('all available engines support ps with filter and format', () => {
    const engines: Array<{ name: EngineType; binary: string }> = [
      { name: 'docker', binary: 'docker' },
      { name: 'podman', binary: 'podman' },
      { name: 'nerdctl', binary: 'nerdctl' },
    ];

    for (const { name, binary } of engines) {
      if (!isEngineAvailable(binary)) continue;

      const result = spawnSync(binary, [
        'ps', '-a', '--filter', 'name=flout-nonexistent-test', '--format', '{{.Names}}',
      ], { encoding: 'utf8' });
      assert.strictEqual(result.status, 0,
        `${name}: ps with filter should succeed (got status ${result.status})`);
    }
  });
});
