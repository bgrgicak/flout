import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { startMockServer, MOCK_CREDENTIALS, installMockCredentials, restoreCredentials } from '../src/index.js';

describe('mock-api', () => {
  let server: http.Server;
  let port: number;

  after(() => {
    server?.close();
  });

  it('starts a server on a random port', async () => {
    const result = await startMockServer();
    server = result.server;
    port = result.port;
    assert.ok(port > 0);
  });

  it('responds to POST /v1/messages with JSON', async () => {
    const body = JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 });
    const res = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { type: string; content: { text: string }[] };
    assert.strictEqual(data.type, 'message');
    assert.ok(data.content[0].text.includes('Mock response'));
  });

  it('responds to POST /v1/messages with streaming', async () => {
    const body = JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10, stream: true });
    const res = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
    const text = await res.text();
    assert.ok(text.includes('message_start'));
    assert.ok(text.includes('Mock response'));
    assert.ok(text.includes('message_stop'));
  });

  it('responds to GET /v1/mcp_servers', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/mcp_servers`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { data: unknown[] };
    assert.deepStrictEqual(data, { data: [] });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/unknown`);
    assert.strictEqual(res.status, 404);
  });

  it('exports MOCK_CREDENTIALS with expected shape', () => {
    assert.ok(MOCK_CREDENTIALS.claudeAiOauth.accessToken);
    assert.ok(MOCK_CREDENTIALS.claudeAiOauth.refreshToken);
    assert.ok(MOCK_CREDENTIALS.claudeAiOauth.expiresAt > Date.now());
    assert.ok(MOCK_CREDENTIALS.organizationUuid);
  });

  it('exports installMockCredentials and restoreCredentials', () => {
    assert.strictEqual(typeof installMockCredentials, 'function');
    assert.strictEqual(typeof restoreCredentials, 'function');
  });
});
