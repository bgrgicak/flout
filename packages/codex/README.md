# @flout/codex

Codex provider for [@flout/cli](../cli/). Implements the `Agent` interface with Codex-specific commands for authentication, project trust, local sessions, and remote-control sessions.

## Usage

```ts
import codex from '@flout/codex';

codex.isAuthenticated();        // check login status
codex.remoteCommand('my-agent'); // get the remote-control command string
codex.encodePath('/home/dev');   // encode a path for compatibility with flout
```

## API

| Method | Description |
| --- | --- |
| `remoteCommand()` | Returns `codex remote-control start` |
| `startCommand()` | Returns `codex --dangerously-bypass-approvals-and-sandbox` |
| `loginCommand()` | Returns `codex login` |
| `isAuthenticated()` | Checks `codex login status` |
| `isTrusted(dir)` | Checks if directory is trusted in `~/.codex/config.toml` |
| `trustCommand()` | Returns `codex` |
| `encodePath(dir)` | Encodes paths in the same format as other flout agents |
