import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(__dirname, '..', 'src', 'cli.ts');

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: path.join(__dirname, '..'),
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  };
}

describe('CLI', () => {
  it('prints usage with --help', () => {
    const { stdout, exitCode } = run('--help');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('flout'));
    assert.ok(stdout.includes('setup'));
    assert.ok(stdout.includes('claude'));
    assert.ok(stdout.includes('opencode'));
    assert.ok(stdout.includes('claude remote'));
    assert.ok(stdout.includes('stop'));
    assert.ok(stdout.includes('join'));
    assert.ok(stdout.includes('list'));
    assert.ok(stdout.includes('restart'));
    assert.ok(stdout.includes('trust'));
  });

  it('prints usage with no args and exits 0', () => {
    const { stdout, exitCode } = run();
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('flout'));
  });

  it('exits 1 for unknown command', () => {
    const { exitCode } = run('nonexistent');
    assert.strictEqual(exitCode, 1);
  });

  it('exits 1 when stop is missing name', () => {
    const { exitCode } = run('stop');
    assert.strictEqual(exitCode, 1);
  });

  it('exits 1 when join is missing name', () => {
    const { exitCode } = run('join');
    assert.strictEqual(exitCode, 1);
  });

  it('includes sandbox in help output', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('sandbox'));
  });

  it('prints sandbox usage with no sandbox subcommand', () => {
    const { stdout, exitCode } = run('sandbox');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('flout sandbox'));
  });

  it('exits 1 for unknown sandbox subcommand', () => {
    const { exitCode } = run('sandbox', 'nonexistent');
    assert.strictEqual(exitCode, 1);
  });

  it('docker command shows deprecation warning', () => {
    const { stdout, stderr } = run('docker');
    const output = stdout + stderr;
    assert.ok(output.includes('deprecated'));
  });

  it('shows name|id in usage for stop, join, restart', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('name|id'));
  });

  it('shows name as optional for agent commands', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('claude [name]'));
    assert.ok(stdout.includes('opencode [name]'));
  });

  it('rejects the legacy `flout start` command with a hint', () => {
    const { stderr, exitCode } = run('start');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('flout claude'));
  });

  it('rejects the legacy `flout remote` command with a hint', () => {
    const { stderr, exitCode } = run('remote');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('flout claude remote'));
  });

  it('rejects unknown agent for setup', () => {
    const { stderr, exitCode } = run('setup', 'nonexistent');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('Unknown agent'));
  });

  it('shows multi-agent status with no flags', () => {
    const { stdout, exitCode } = run('status');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('Agents:'));
    assert.ok(stdout.includes('claude:'));
    assert.ok(stdout.includes('opencode:'));
  });
});
