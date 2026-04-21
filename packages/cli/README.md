# flout

Manage persistent AI agent sessions with tmux. Start, stop, and connect to agent sessions that stay running in the background — locally, on a remote machine, or in container sandboxes.

Currently supports Claude Code. Extensible to other agents.

## Install

```bash
npm install -g @flout/cli
```

Requires: Node.js 18+, tmux, and a container engine ([Colima](https://colima.run/) recommended, or Podman/Docker).

## Quick start

```bash
# Check dependencies and authenticate
flout setup

# Trust a project directory (one-time, interactive)
flout trust ~/my-project

# Start a remote-control session (always-on, accessible from anywhere)
flout remote myagent --path ~/my-project

# Connect from any device via Claude Code's /remote command
```

## Commands

### Sessions

| Command | Description |
|---------|-------------|
| `flout setup` | Check dependencies, login, create long-lived token |
| `flout start [name] [--path <dir>]` | Start a local interactive session in tmux (use `sudo` for sandbox mode) |
| `flout remote [name] [--path <dir>]` | Start a remote-control session with auto-reconnect |
| `flout stop <name\|id>` | Stop a session |
| `flout join <name\|id>` | Attach to a running tmux session |
| `flout list` | List active sessions |
| `flout status` | Show login and session status |
| `flout restart <name\|id> [--path <dir>]` | Restart a remote session |
| `flout trust <dir>` | Trust a project directory (interactive) |

`name` defaults to the basename of the current directory. `--path` defaults to the current directory.

### Sandboxes

| Command | Description |
|---------|-------------|
| `flout sandbox start [--name <n>] [--engine docker\|podman\|containerd]` | Build image if needed, start a container |
| `flout sandbox stop [<name\|id>]` | Stop a container |
| `flout sandbox shell [<name\|id>]` | Exec into a running container |
| `flout sandbox claude [<name\|id>]` | Exec into a container running Claude |
| `flout sandbox status` | List flout containers |

`--name` defaults to the basename of the current directory. `--engine` selects the container engine (auto-detected if omitted). Extra engine flags can be passed after `--` (e.g. `flout sandbox start -- --gpus all`).

Supported engines: Docker, Podman, containerd (via nerdctl/Colima). On macOS, Colima is started automatically if needed. On Linux, native engines are preferred.

> **Note:** `flout docker` still works but is deprecated. Use `flout sandbox` instead.

### Multiple sessions

You can run multiple sessions in the same directory. Each session gets a unique timestamped ID like `flout-0410-152301-myproject`.

```bash
flout start myproject              # → flout-0410-152301-myproject
flout start myproject              # → flout-0410-153045-myproject (second session)
flout list                         # shows both with directories
flout join myproject               # joins if only one; lists matches if ambiguous
flout stop flout-0410-152301-myproject  # stop a specific session by full ID
```

The same applies to Docker containers.

## How it works

flout wraps tmux and your agent's CLI. `flout remote` starts a tmux session running the agent in remote-control mode with a respawn loop — if the connection drops, it restarts automatically. `flout join` attaches your terminal to see what the agent is doing.

`flout sandbox` manages container lifecycle — it builds an image with the agent and flout pre-installed, mounts your project directory, and pre-trusts it so sessions can start immediately. It auto-detects the fastest available container engine (Docker, Podman, or containerd).

## Packages

| Package | Description |
|---------|-------------|
| [`@flout/cli`](.) | Main CLI — session management, setup, types |
| [`@flout/claude`](../claude/) | Claude Code agent provider |
| [`@flout/sandbox`](../sandbox/) | Multi-engine container sandbox (Docker, Podman, nerdctl, Colima) |
| [`@flout/docker`](../docker/) | Docker container runtime (deprecated — use `@flout/sandbox`) |

## Development

```bash
git clone <repo> && cd flout
npm install
npm run build
npm test
```

See [AGENTS.md](AGENTS.md) for architecture and contribution guidelines.

## License

GPL-2.0
