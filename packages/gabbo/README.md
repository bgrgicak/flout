# gabbo

Manage persistent AI agent sessions with tmux. Start, stop, and connect to agent sessions that stay running in the background — locally, on a remote machine, or in Docker.

Currently supports Claude Code. Extensible to other agents.

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

### Sessions

| Command | Description |
|---------|-------------|
| `gabbo setup` | Check dependencies, login, create long-lived token |
| `gabbo start [name] [--path <dir>]` | Start a local interactive session in tmux (use `sudo` for sandbox mode) |
| `gabbo remote [name] [--path <dir>]` | Start a remote-control session with auto-reconnect |
| `gabbo stop <name\|id>` | Stop a session |
| `gabbo join <name\|id>` | Attach to a running tmux session |
| `gabbo list` | List active sessions |
| `gabbo status` | Show login and session status |
| `gabbo restart <name\|id> [--path <dir>]` | Restart a remote session |
| `gabbo trust <dir>` | Trust a project directory (interactive) |

`name` defaults to the basename of the current directory. `--path` defaults to the current directory.

### Docker

| Command | Description |
|---------|-------------|
| `gabbo docker start [--name <n>]` | Build image if needed, start a container |
| `gabbo docker stop [<name\|id>]` | Stop a container |
| `gabbo docker shell [<name\|id>]` | Exec into a running container |
| `gabbo docker claude [<name\|id>]` | Exec into a container running Claude |
| `gabbo docker status` | List gabbo containers |

`--name` defaults to the basename of the current directory. Extra Docker flags can be passed after `--` (e.g. `gabbo docker start -- --gpus all`).

### Multiple sessions

You can run multiple sessions in the same directory. Each session gets a unique timestamped ID like `gabbo-0410-152301-myproject`.

```bash
gabbo start myproject              # → gabbo-0410-152301-myproject
gabbo start myproject              # → gabbo-0410-153045-myproject (second session)
gabbo list                         # shows both with directories
gabbo join myproject               # joins if only one; lists matches if ambiguous
gabbo stop gabbo-0410-152301-myproject  # stop a specific session by full ID
```

The same applies to Docker containers.

## How it works

gabbo wraps tmux and your agent's CLI. `gabbo remote` starts a tmux session running the agent in remote-control mode with a respawn loop — if the connection drops, it restarts automatically. `gabbo join` attaches your terminal to see what the agent is doing.

`gabbo docker` manages container lifecycle — it builds an image with the agent and gabbo pre-installed, mounts your project directory, and pre-trusts it so sessions can start immediately.

## Packages

| Package | Description |
|---------|-------------|
| [`gabbo`](.) | Main CLI — session management, setup, types |
| [`@gabbo/claude`](../claude/) | Claude Code agent provider |
| [`@gabbo/docker`](../docker/) | Docker container runtime |

## Development

```bash
git clone <repo> && cd gabbo
npm install
npm run build
npm test
```

See [AGENTS.md](AGENTS.md) for architecture and contribution guidelines.

## License

GPL-2.0
