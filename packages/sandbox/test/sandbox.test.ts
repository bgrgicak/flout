import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as sandbox from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// When compiled, __dirname is packages/sandbox/dist/test/
// We need to find the repo root regardless of whether we're running from src or dist
function findRepoRoot(): string {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'cli', 'src', 'cli.ts'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Could not find repo root');
}

const repoRoot = findRepoRoot();

function runCli(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const cli = path.join(repoRoot, 'packages', 'cli', 'src', 'cli.ts');
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: path.resolve(__dirname, '..'),
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

function hasAnyEngine(): boolean {
  return (
    sandbox.isEngineAvailable('docker') ||
    sandbox.isEngineAvailable('podman') ||
    sandbox.isEngineAvailable('nerdctl')
  );
}

describe('sandbox', () => {
  it('exports start, stop, shell, claude, codex, opencode, listRows, usage, and resolveContainer functions', () => {
    assert.strictEqual(typeof sandbox.start, 'function');
    assert.strictEqual(typeof sandbox.stop, 'function');
    assert.strictEqual(typeof sandbox.shell, 'function');
    assert.strictEqual(typeof sandbox.claude, 'function');
    assert.strictEqual(typeof sandbox.codex, 'function');
    assert.strictEqual(typeof sandbox.opencode, 'function');
    assert.strictEqual(typeof sandbox.listRows, 'function');
    assert.strictEqual(typeof sandbox.usage, 'function');
    assert.strictEqual(typeof sandbox.resolveContainer, 'function');
  });

  it('exports engine detection functions', () => {
    assert.strictEqual(typeof sandbox.detectEngine, 'function');
    assert.strictEqual(typeof sandbox.isEngineAvailable, 'function');
    assert.strictEqual(typeof sandbox.resetEngineCache, 'function');
  });

  it('exports colima lifecycle functions', () => {
    assert.strictEqual(typeof sandbox.isColimaInstalled, 'function');
    assert.strictEqual(typeof sandbox.isColimaRunning, 'function');
    assert.strictEqual(typeof sandbox.getColimaRuntime, 'function');
    assert.strictEqual(typeof sandbox.ensureColimaRunning, 'function');
  });

  it('exports SandboxStartOptions type-compatible objects', () => {
    const startOpts: sandbox.SandboxStartOptions = {
      name: 'test',
      cwd: '/tmp',
      extraArgs: [],
      agent: { encodePath: (d: string) => d },
    };
    assert.ok(startOpts);

    const startOptsWithEngine: sandbox.SandboxStartOptions = {
      name: 'test',
      cwd: '/tmp',
      extraArgs: [],
      agent: { encodePath: (d: string) => d },
      engine: 'docker',
    };
    assert.ok(startOptsWithEngine);
  });

  it('exports SandboxStopOptions, SandboxShellOptions, SandboxClaudeOptions, and SandboxCodexOptions types', () => {
    const stopOpts: sandbox.SandboxStopOptions = { name: 'test' };
    assert.ok(stopOpts);

    const stopOptsWithEngine: sandbox.SandboxStopOptions = { name: 'test', engine: 'podman' };
    assert.ok(stopOptsWithEngine);

    const shellOpts: sandbox.SandboxShellOptions = { name: 'test' };
    assert.ok(shellOpts);

    const claudeOpts: sandbox.SandboxClaudeOptions = { name: 'test', engine: 'nerdctl' };
    assert.ok(claudeOpts);

    const codexOpts: sandbox.SandboxCodexOptions = { name: 'test', engine: 'docker' };
    assert.ok(codexOpts);
  });

  it('stop exits 1 for nonexistent container', () => {
    if (!hasAnyEngine()) return;

    const result = runCli('sandbox', 'stop', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('shell exits 1 for nonexistent container', () => {
    if (!hasAnyEngine()) return;

    const result = runCli('sandbox', 'shell', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('claude exits 1 for nonexistent container', () => {
    if (!hasAnyEngine()) return;

    const result = runCli('sandbox', 'claude', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('codex exits 1 for nonexistent container', () => {
    if (!hasAnyEngine()) return;

    const result = runCli('sandbox', 'codex', 'nonexistent-test-xyz');
    assert.strictEqual(result.exitCode, 1);
  });

  it('docker command shows deprecation warning', () => {
    // The deprecation warning goes to stderr via console.warn.
    // Note: this test depends on @flout/cli being available, so it may
    // fail if run in isolation. The CLI E2E tests cover this more thoroughly.
    const result = runCli('docker');
    const output = (result.stdout || '') + (result.stderr || '');
    assert.ok(
      output.includes('deprecated'),
      `Expected deprecation warning for docker command, got stdout: ${result.stdout}, stderr: ${result.stderr}`
    );
  });
});
