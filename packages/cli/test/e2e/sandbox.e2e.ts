import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { startMockServer, installMockCredentials, restoreCredentials } from '@flout/claude-mock-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(__dirname, '..', '..', 'src', 'cli.ts');
const pkgRoot = path.resolve(__dirname, '..', '..');

let mockPort: number;
let mockServer: { server: import('http').Server; port: number };
let credentialsBackup: string | null = null;
const credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
const createdContainers: string[] = [];

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

function getEngineBinary(): string {
  if (isEngineUsable('docker')) return 'docker';
  if (isEngineUsable('podman')) return 'podman';
  if (isEngineUsable('nerdctl')) return 'nerdctl';
  return 'docker';
}

function flout(...args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync('npx', ['tsx', cli, ...args], {
    encoding: 'utf8',
    timeout: 300000,
    cwd: pkgRoot,
    env: {
      ...process.env,
      CLAUDE_CODE_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
    },
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

function extractContainerName(output: string): string | null {
  const match = output.match(/Container '(flout-\d{4}-\d{6}-[a-z0-9-]+)'/);
  return match ? match[1] : null;
}

function cleanupContainers(): void {
  const binary = getEngineBinary();
  for (const c of createdContainers) {
    spawnSync(binary, ['rm', '-f', c], { stdio: 'ignore' });
  }
}

describe('e2e: sandbox', { skip: !hasAnyEngine() ? 'No container engine available' : undefined }, () => {
  before(async () => {
    mockServer = await startMockServer();
    mockPort = mockServer.port;
    credentialsBackup = installMockCredentials(credentialsPath);
  });

  after(() => {
    mockServer.server.close();
    restoreCredentials(credentialsPath, credentialsBackup);
    cleanupContainers();
  });

  it('starts a container', () => {
    const result = flout('sandbox', 'start', '--name', 'e2e-sandbox-test');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const name = extractContainerName(result.stdout);
    assert.ok(name, `should output container name, got: ${result.stdout}`);
    createdContainers.push(name!);
    assert.match(name!, /^flout-\d{4}-\d{6}-e2e-sandbox-test$/);

    const status = flout('sandbox', 'status');
    assert.ok(status.stdout.includes(name!), 'container should appear in status');
  });

  it('starts a second container with the same label', () => {
    spawnSync('sleep', ['1']);

    const result = flout('sandbox', 'start', '--name', 'e2e-sandbox-test');
    assert.strictEqual(result.exitCode, 0, `stderr: ${result.stderr}`);
    const name = extractContainerName(result.stdout);
    assert.ok(name);
    createdContainers.push(name!);

    assert.notStrictEqual(name, createdContainers[0], 'should create a different container');
  });

  it('shows both containers in status', () => {
    const result = flout('sandbox', 'status');
    assert.strictEqual(result.exitCode, 0);
    for (const c of createdContainers) {
      assert.ok(result.stdout.includes(c), `status should list ${c}`);
    }
  });

  it('disambiguates when multiple containers match', () => {
    const result = flout('sandbox', 'stop', 'e2e-sandbox-test');
    assert.strictEqual(result.exitCode, 1);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('Multiple containers'), 'should show disambiguation');
  });

  it('stops a container by full name', () => {
    const name = createdContainers[0];
    const result = flout('sandbox', 'stop', name);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('removed'));
  });

  it('shell exits 1 for removed container', () => {
    const name = createdContainers[0];
    const result = flout('sandbox', 'shell', name);
    assert.strictEqual(result.exitCode, 1);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('No containers matching') || output.includes('not running'));
  });

  it('shell works on running container', () => {
    const binary = getEngineBinary();
    const name = createdContainers[1];
    const result = spawnSync(binary, ['exec', name, 'echo', 'hello'], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('hello'));
  });

  it('stops the remaining container', () => {
    const name = createdContainers[1];
    const result = flout('sandbox', 'stop', name);
    assert.strictEqual(result.exitCode, 0);
  });
});

describe('e2e: docker deprecation', { skip: !hasAnyEngine() ? 'No container engine available' : undefined }, () => {
  it('docker command shows deprecation warning', () => {
    const result = flout('docker', 'status');
    const output = result.stdout + result.stderr;
    assert.ok(output.includes('deprecated'), 'should show deprecation warning');
  });
});
