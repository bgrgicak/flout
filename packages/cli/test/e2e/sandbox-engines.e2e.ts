/**
 * Per-engine E2E tests.
 * Runs the full sandbox lifecycle through each available container engine
 * with the mock Claude API. Every feature is tested per-engine to ensure
 * no engine-specific regressions.
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

    // --- Basic lifecycle ---

    it('starts a container', () => {
      const result = flout('sandbox', 'start', '--name', `e2e-${engine.flag}`, '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0,
        `start failed: stdout=${result.stdout} stderr=${result.stderr}`);
      const name = extractContainerName(result.stdout);
      assert.ok(name, `should output container name, got: ${result.stdout}`);
      containers.push(name!);
    });

    it('shows the container in flout list', () => {
      const result = flout('list');
      assert.strictEqual(result.exitCode, 0);
      // Containers appear by their label suffix; the timestamp prefix is hidden.
      const label = containers[0].replace(/^flout-\d{4}-\d{6}-/, '');
      assert.ok(result.stdout.includes(label),
        `list should include label '${label}'; got:\n${result.stdout}`);
      assert.ok(result.stdout.includes(`sandbox/${engine.flag}`),
        `list should mark the row as 'sandbox/${engine.flag}'; got:\n${result.stdout}`);
    });

    it('can exec into the container via raw engine binary', () => {
      const name = containers[0];
      const result = spawnSync(engine.cleanupBinary,
        [...engine.cleanupPrefix, 'exec', name, 'echo', 'hello-from-sandbox'],
        { encoding: 'utf8' });
      assert.strictEqual(result.status, 0,
        `exec failed: ${result.stderr}`);
      assert.ok(result.stdout.includes('hello-from-sandbox'));
    });

    it('can exec into the container via flout sandbox shell', () => {
      const name = containers[0];
      const result = spawnSync('npx', ['tsx', cli, 'sandbox', 'shell', name], {
        encoding: 'utf8',
        timeout: 30000,
        cwd: pkgRoot,
        input: 'echo hello-from-shell && exit\n',
        env: {
          ...process.env,
          CLAUDE_CODE_API_BASE_URL: `http://127.0.0.1:${mockPort}`,
        },
      });
      assert.strictEqual(result.status, 0,
        `shell failed: stdout=${result.stdout} stderr=${result.stderr}`);
      assert.ok(result.stdout.includes('hello-from-shell'),
        `shell output should contain 'hello-from-shell', got: ${result.stdout}`);
    });

    // --- Multiple containers & disambiguation ---

    it('starts a second container with the same label', () => {
      spawnSync('sleep', ['1']); // ensure different timestamp
      const result = flout('sandbox', 'start', '--name', `e2e-${engine.flag}`, '--engine', engine.flag);
      assert.strictEqual(result.exitCode, 0,
        `start failed: stdout=${result.stdout} stderr=${result.stderr}`);
      const name = extractContainerName(result.stdout);
      assert.ok(name);
      containers.push(name!);
      assert.notStrictEqual(name, containers[0], 'should create a different container');
    });

    it('shows both containers in flout list', () => {
      const result = flout('list');
      assert.strictEqual(result.exitCode, 0);
      // Both containers share the same label (intentional for this test); the
      // list shows two rows with the same LABEL and the engine name.
      const label = containers[0].replace(/^flout-\d{4}-\d{6}-/, '');
      const labelRows = result.stdout.split('\n').filter(line => line.includes(label));
      assert.ok(labelRows.length >= 2,
        `expected at least 2 list rows for label '${label}'; got:\n${result.stdout}`);
    });

    it('disambiguates when multiple containers match short name', () => {
      const result = flout('sandbox', 'stop', `e2e-${engine.flag}`);
      assert.strictEqual(result.exitCode, 1);
      const output = result.stdout + result.stderr;
      assert.ok(output.includes('Multiple containers'), 'should show disambiguation');
    });

    // --- Stop & shell on removed containers ---

    it('stops the first container by full name without --engine', () => {
      const name = containers[0];
      const result = flout('sandbox', 'stop', name);
      assert.strictEqual(result.exitCode, 0,
        `stop failed: stdout=${result.stdout} stderr=${result.stderr}`);
      assert.ok(result.stdout.includes('removed'));
    });

    it('shell exits 1 for removed container', () => {
      const name = containers[0];
      const result = flout('sandbox', 'shell', name);
      assert.strictEqual(result.exitCode, 1);
      const output = result.stdout + result.stderr;
      assert.ok(output.includes('No containers matching') || output.includes('not running'),
        `should report container missing or not running, got: ${output}`);
    });

    // --- Shell on running container ---

    it('shell works on running container', () => {
      const list = flout('list');
      const label = containers[1].replace(/^flout-\d{4}-\d{6}-/, '');
      assert.ok(list.stdout.includes(label),
        `container label '${label}' should be listed by flout list`);
    });

    // --- Cleanup ---

    it('stops the remaining container without --engine', () => {
      const name = containers[1];
      const result = flout('sandbox', 'stop', name);
      assert.strictEqual(result.exitCode, 0,
        `stop failed: stdout=${result.stdout} stderr=${result.stderr}`);
      assert.ok(result.stdout.includes('removed'));
    });

    it('list shows no containers after cleanup', () => {
      const result = flout('list');
      assert.strictEqual(result.exitCode, 0);
      // Once removed, containers should not appear in the listing under any form
      // — neither full id nor label — assuming nothing else uses the same label.
      const label = `e2e-${engine.flag}`;
      assert.ok(!result.stdout.includes(label),
        `should not list removed containers with label '${label}'; got:\n${result.stdout}`);
    });
  });
}
