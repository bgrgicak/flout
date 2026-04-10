import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(__dirname, '..', '..', 'bin', 'gabbo.js');

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [bin, ...args], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status: number };
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status };
  }
}

describe('CLI', () => {
  it('prints usage with --help', () => {
    const { stdout, exitCode } = run('--help');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('gabbo'));
    assert.ok(stdout.includes('setup'));
    assert.ok(stdout.includes('start'));
    assert.ok(stdout.includes('remote'));
    assert.ok(stdout.includes('stop'));
    assert.ok(stdout.includes('join'));
    assert.ok(stdout.includes('list'));
    assert.ok(stdout.includes('restart'));
    assert.ok(stdout.includes('trust'));
  });

  it('prints usage with no args and exits 0', () => {
    const { stdout, exitCode } = run();
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('gabbo'));
  });

  it('exits 1 for unknown command', () => {
    const { exitCode } = run('nonexistent');
    assert.strictEqual(exitCode, 1);
  });

  it('exits 1 when start is missing name', () => {
    const { exitCode, stderr } = run('start');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('Usage'));
  });

  it('exits 1 when remote is missing name', () => {
    const { exitCode, stderr } = run('remote');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('Usage'));
  });

  it('exits 1 when stop is missing name', () => {
    const { exitCode, stderr } = run('stop');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('Usage'));
  });

  it('exits 1 when join is missing name', () => {
    const { exitCode, stderr } = run('join');
    assert.strictEqual(exitCode, 1);
    assert.ok(stderr.includes('Usage'));
  });

  it('includes docker in help output', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('docker'));
  });

  it('prints docker usage with no docker subcommand', () => {
    const { stdout, exitCode } = run('docker');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('gabbo docker'));
  });

  it('exits 1 for unknown docker subcommand', () => {
    const { exitCode } = run('docker', 'nonexistent');
    assert.strictEqual(exitCode, 1);
  });
});
