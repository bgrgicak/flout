import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(__dirname, '..', 'src', 'cli.ts');

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', cli, ...args], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: path.join(__dirname, '..'),
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

  it('exits 1 when stop is missing name', () => {
    const { exitCode } = run('stop');
    assert.strictEqual(exitCode, 1);
    // stop still requires a name/id argument
  });

  it('exits 1 when join is missing name', () => {
    const { exitCode } = run('join');
    assert.strictEqual(exitCode, 1);
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

  it('shows name|id in usage for stop, join, restart', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('name|id'));
  });

  it('shows name as optional for start and remote', () => {
    const { stdout } = run('--help');
    assert.ok(stdout.includes('start [name]'));
    assert.ok(stdout.includes('remote [name]'));
  });
});
