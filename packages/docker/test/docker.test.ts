import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as docker from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runCli(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const cli = path.resolve(__dirname, '..', '..', '..', 'flout', 'src', 'cli.ts');
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: path.resolve(__dirname, '..'),
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

describe('docker', () => {
  it('exports start, stop, shell, claude, codex, status, usage, and resolveContainer functions', () => {
    assert.strictEqual(typeof docker.start, 'function');
    assert.strictEqual(typeof docker.stop, 'function');
    assert.strictEqual(typeof docker.shell, 'function');
    assert.strictEqual(typeof docker.claude, 'function');
    assert.strictEqual(typeof docker.codex, 'function');
    assert.strictEqual(typeof docker.status, 'function');
    assert.strictEqual(typeof docker.usage, 'function');
    assert.strictEqual(typeof docker.resolveContainer, 'function');
  });

  it('exports DockerStartOptions, DockerStopOptions, DockerShellOptions, DockerClaudeOptions, and DockerCodexOptions types', () => {
    const startOpts: docker.DockerStartOptions = {
      name: 'test',
      cwd: '/tmp',
      extraArgs: [],
      agent: { encodePath: (d: string) => d },
    };
    assert.ok(startOpts);

    const claudeOpts: docker.DockerClaudeOptions = { name: 'test' };
    assert.ok(claudeOpts);

    const codexOpts: docker.DockerCodexOptions = { name: 'test' };
    assert.ok(codexOpts);
  });

  it('stop exits 1 for nonexistent container', () => {
    const hasDocker = spawnSync('which', ['docker']).status === 0;
    if (!hasDocker) return;

    const result = runCli('docker', 'stop', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('shell exits 1 for nonexistent container', () => {
    const hasDocker = spawnSync('which', ['docker']).status === 0;
    if (!hasDocker) return;

    const result = runCli('docker', 'shell', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('claude exits 1 for nonexistent container', () => {
    const hasDocker = spawnSync('which', ['docker']).status === 0;
    if (!hasDocker) return;

    const result = runCli('docker', 'claude', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('codex exits 1 for nonexistent container', () => {
    const hasDocker = spawnSync('which', ['docker']).status === 0;
    if (!hasDocker) return;

    const result = runCli('docker', 'codex', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });
});
