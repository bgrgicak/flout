# gabbo

Manage persistent AI agent sessions with tmux. Start, stop, and connect to agent sessions that stay running in the background — locally or on a remote machine.

Currently supports Claude Code. More agents planned.

## Install

```bash
npm install -g gabbo
```

Requires: Node.js 18+, tmux.

## Quick start

```bash
# Check dependencies and authenticate
gabbo setup

# Trust a project directory (one-time, interactive)
gabbo trust ~/my-project

# Start a remote-control session (always-on, accessible from anywhere)
gabbo remote myagent --path ~/my-project

# Connect from any device via Claude Code's /remote command
```

## Commands

| Command | Description |
|---------|-------------|
| `gabbo setup` | Check dependencies, login, create long-lived token |
| `gabbo start <name> [--path <dir>]` | Start a local interactive session in tmux |
| `gabbo remote <name> [--path <dir>]` | Start a remote-control session with auto-reconnect |
| `gabbo stop <name>` | Stop a session |
| `gabbo join <name>` | Attach to a running tmux session |
| `gabbo list` | List active sessions |
| `gabbo status` | Show login and session status |
| `gabbo restart <name> [--path <dir>]` | Restart a remote session |
| `gabbo trust <dir>` | Trust a project directory (interactive) |
| `gabbo docker start [--name <n>]` | Build image if needed, start a Docker container |
| `gabbo docker stop [--name <n>]` | Stop a Docker container |
| `gabbo docker shell [--name <n>]` | Exec into a running container |
| `gabbo docker status` | List gabbo Docker containers |

`--path` defaults to the current directory if not specified. `--name` defaults to the basename of the current directory. Extra Docker flags can be passed after `--` (e.g. `gabbo docker start -- --gpus all`).

## How it works

gabbo wraps tmux and your agent's CLI. `gabbo remote` starts a tmux session running the agent in remote-control mode with a respawn loop — if the connection drops, it restarts automatically. `gabbo join` attaches your terminal to see what the agent is doing.

## License

MIT
