# @flout/claude-mock-api

Mock Claude Code API server for testing CLI tools that integrate with Claude. Provides a fake credentials file and a minimal HTTP server that responds to Claude's API endpoints.

## Install

```bash
npm install --save-dev @flout/claude-mock-api
```

## Usage

```ts
import {
  startMockServer,
  installMockCredentials,
  restoreCredentials,
  MOCK_CREDENTIALS,
} from '@flout/claude-mock-api';

// Start a mock API server on a random port
const { server, port } = await startMockServer();

// Point Claude CLI at the mock server
process.env.CLAUDE_CODE_API_BASE_URL = `http://127.0.0.1:${port}`;

// Install fake credentials so `claude auth status` reports logged in
const credentialsPath = '~/.claude/.credentials.json';
const backup = installMockCredentials(credentialsPath);

// ... run your tests ...

// Restore original credentials
restoreCredentials(credentialsPath, backup);
server.close();
```

## API

| Export | Description |
|--------|-------------|
| `startMockServer()` | Start an HTTP server on a random port. Returns `{ server, port }`. |
| `createMockServer()` | Create an `http.Server` without starting it. |
| `installMockCredentials(path)` | Write mock credentials to the given path. Returns the original file contents (or null) for restoration. |
| `restoreCredentials(path, backup)` | Restore the original credentials file. |
| `MOCK_CREDENTIALS` | The mock credentials object written by `installMockCredentials`. |

## Supported endpoints

| Endpoint | Behavior |
|----------|----------|
| `POST /v1/messages` | Returns a mock response (streaming or non-streaming based on the `stream` field) |
| `GET /v1/mcp_servers` | Returns `{ data: [] }` |
| Everything else | 404 |

## License

GPL-2.0
