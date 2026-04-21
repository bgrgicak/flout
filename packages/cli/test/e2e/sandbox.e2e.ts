/**
 * Misc sandbox E2E tests that don't need per-engine coverage.
 * Per-engine lifecycle tests are in sandbox-engines.e2e.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const pkgRoot = path.resolve(__dirname, '..', '..');

function isEngineUsable(binary: string): boolean {
  const which = spawnSync('which', [binary], { stdio: 'ignore' });
  if (which.status !== 0) return false;
  if (binary === 'docker' || binary === 'podman') {
    return spawnSync(binary, ['info'], { stdio: 'ignore', timeout: 5000 }).status === 0;
  }
  return true;
}

function hasAnyEngine(): boolean {
  return isEngineUsable('docker') || isEngineUsable('podman') || isEngineUsable('nerdctl');
}

function flout(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 300000,
    cwd: pkgRoot,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

describe('e2e: docker deprecation', { skip: !hasAnyEngine() ? 'No container engine available' : undefined }, () => {
  it('docker command shows deprecation warning', () => {
    const result = flout('docker', 'status');
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('deprecated'), 'should show deprecation warning');
  });
});
