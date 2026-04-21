/**
 * Per-engine E2E tests.
 * Runs the full sandbox lifecycle (start → exec → status → stop)
 * through each available container engine with the mock Claude API.
 */
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
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

function extractContainerName(output: string): string | null {
  const match = output.match(/Container '(flout-\d{4}-\d{6}-[a-z0-9-]+)'/);
  return match ? match[1] : null;
}

interface EngineTestConfig {
  name: string;
  flag: string; // value for --engine
  skip: string | undefined;
  cleanupBinary: string; // binary to use for cleanup (rm -f)
  cleanupPrefix: string[]; // prefix args for cleanup
}

function isAvailable(binary: string): boolean {
  if (binary === 'colima-nerdctl') {
    return spawnSync('colima', ['status'], { stdio: 'ignore' }).status === 0;
  }
  const which = spawnSync('which', [binary], { stdio: 'ignore' });
  if (which.status !== 0) return false;
  if (binary === 'docker' || binary === 'podman') {
    return spawnSync(binary, ['info'], { stdio: 'ignore', timeout: 5000 }).status === 0;
  }
  return true;
}

const engines: EngineTestConfig[] = [
  {
    name: 'docker',
    flag: 'docker',
    skip: !isAvailable('docker') ? 'docker not available' : undefined,
    cleanupBinary: 'docker',
    cleanupPrefix: [],
  },
  {
    name: 'podman',
    flag: 'podman',
    skip: !isAvailable('podman') ? 'podman not available' : undefined,
    cleanupBinary: 'podman',
    cleanupPrefix: [],
  },
  {
    name: 'containerd via colima',
    flag: 'containerd',
    skip: !isAvailable('colima-nerdctl') ? 'colima not running' : undefined,
    cleanupBinary: 'colima',
    cleanupPrefix: ['nerdctl', '--'],
  },
];

for (const engine of engines) {
  describe(`e2e: sandbox with ${engine.name}`, { skip: engine.skip }, () => {
    const containers: string[] = [];

    before(async () => {
      mockServer = await startMockServer();
      mockPort = mockServer.port;
      credentialsBackup = installMockCredentials(credentialsPath);
    });

    after(() => {
      mockServer.server.close();
      restoreCredentials(credentialsPath, credentialsBackup);
      for (const c of containers) {
        spawnSync(engine.cleanupBinary, [...engine.cleanupPrefix, 'rm', '-f', c], { stdio: 'ignore' });
      }
    });

    it('starts a container', () => {
      const result = flout('sandbox', 'start', '--name', `e2e-${engine.flag}`, '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0,
        `start failed: stdout=${result.stdout} stderr=${result.stderr}`);
      const name = extractContainerName(result.stdout);
      assert.ok(name, `should output container name, got: ${result.stdout}`);
      containers.push(name!);
    });

    it('shows the container in status', () => {
      const result = flout('sandbox', 'status', '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes(containers[0]),
        `status should list ${containers[0]}`);
    });

    it('can exec into the container', () => {
      const name = containers[0];
      const result = spawnSync(engine.cleanupBinary,
        [...engine.cleanupPrefix, 'exec', name, 'echo', 'hello-from-sandbox'],
        { encoding: 'utf8' });
      assert.strictEqual(result.status, 0,
        `exec failed: ${result.stderr}`);
      assert.ok(result.stdout.includes('hello-from-sandbox'));
    });

    it('stops the container', () => {
      const name = containers[0];
      const result = flout('sandbox', 'stop', name, '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0,
        `stop failed: stdout=${result.stdout} stderr=${result.stderr}`);
      assert.ok(result.stdout.includes('removed'));
    });

    it('status shows no containers after cleanup', () => {
      const result = flout('sandbox', 'status', '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0);
      // Container was removed, should not appear
      if (containers[0]) {
        assert.ok(!result.stdout.includes(containers[0]),
          `should not list removed container ${containers[0]}`);
      }
    });
  });
}
