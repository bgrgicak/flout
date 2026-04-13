import fs from 'fs';
import http from 'http';
import path from 'path';

export const MOCK_CREDENTIALS = {
  claudeAiOauth: {
    accessToken: 'sk-ant-oat01-mock-token-for-testing',
    refreshToken: 'sk-ant-ort01-mock-refresh-for-testing',
    expiresAt: 9999999999999,
    scopes: ['user:inference', 'user:profile', 'user:sessions:claude_code'],
    subscriptionType: 'max',
    rateLimitTier: 'default_claude_max_20x',
  },
  organizationUuid: '00000000-0000-0000-0000-000000000000',
};

function streamResponse(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const messageId = 'msg_mock_' + Date.now();

  const events = [
    { type: 'message_start', message: { id: messageId, type: 'message', role: 'assistant', content: [], model: 'claude-sonnet-4-20250514', stop_reason: null, usage: { input_tokens: 10, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Mock response from test server.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 8 } },
    { type: 'message_stop' },
  ];

  for (const event of events) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}

export function createMockServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/v1/messages') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        if (parsed.stream) {
          streamResponse(res);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'msg_mock_' + Date.now(),
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Mock response from test server.' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 8 },
          }));
        }
      });
      return;
    }

    if (req.url?.startsWith('/v1/mcp_servers')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [] }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
}

export function startMockServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = createMockServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

export function installMockCredentials(credentialsPath: string): string | null {
  let backup: string | null = null;
  if (fs.existsSync(credentialsPath)) {
    backup = fs.readFileSync(credentialsPath, 'utf8');
  }
  fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
  fs.writeFileSync(credentialsPath, JSON.stringify(MOCK_CREDENTIALS, null, 2));
  return backup;
}

export function restoreCredentials(credentialsPath: string, backup: string | null): void {
  if (backup !== null) {
    fs.writeFileSync(credentialsPath, backup);
  }
}
