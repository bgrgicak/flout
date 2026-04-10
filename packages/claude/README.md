# @gabbo/claude

Claude Code provider for [gabbo](../gabbo/). Implements the `Agent` interface with Claude-specific commands for authentication, trust, and remote-control sessions.

## Usage

This package is a dependency of the main `gabbo` CLI. You don't need to install it directly.

```ts
import claude from '@gabbo/claude';

claude.isAuthenticated();        // check login status
claude.remoteCommand('my-agent'); // get the remote-control command string
claude.encodePath('/home/dev');   // encode a path for trust directory lookup
```

## Agent interface

| Method | Description |
|--------|-------------|
| `remoteCommand(name)` | Returns `claude remote-control` command string |
| `startCommand()` | Returns `claude` interactive mode command (adds `IS_SANDBOX=1` when run as root) |
| `loginCommand()` | Returns login command |
| `setupTokenCommand()` | Returns long-lived token setup command |
| `isAuthenticated()` | Checks `claude auth status` |
| `isTrusted(dir)` | Checks if directory is trusted in `~/.claude/projects/` |
| `trustCommand()` | Returns command to run for interactive trust |
| `encodePath(dir)` | Converts `/path/to/dir` to `-path-to-dir` for trust lookup |

## License

GPL-2.0
