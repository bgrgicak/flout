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
flout claude remote myagent --path ~/my-project

# Connect from any device via Claude Code's /remote command
```

## Commands

### Sessions

| Command | Description |
|---------|-------------|
| `flout setup [agent]` | Check dependencies, login, create long-lived token (default agent: `claude`) |
| `flout claude [name] [--path <dir>]` | Start a local Claude session in tmux and attach |
| `flout claude remote [name] [--path <dir>]` | Start an always-on Claude session with auto-reconnect |
| `flout opencode [name] [--path <dir>]` | Start a local opencode session in tmux and attach |
| `flout stop <name\|id>` | Stop a session |
| `flout join <name\|id>` | Attach to a running tmux session |
| `flout list` | List active sessions and sandbox containers |
| `flout status` | Show login and session status for each agent |
| `flout restart <name\|id> [--path <dir>]` | Restart a remote session |
| `flout trust <dir> [agent]` | Trust a project directory (interactive; default agent: `claude`) |

`name` defaults to the basename of the current directory. `--path` defaults to the current directory.

### Sandboxes

| Command | Description |
|---------|-------------|
| `flout sandbox start [--name <n>] [--engine docker\|podman\|containerd]` | Build image if needed, start a container |
| `flout sandbox stop [<name\|id>]` | Stop a container |
| `flout sandbox shell [<name\|id>]` | Exec into a running container |
| `flout sandbox claude [<name\|id>]` | Exec into a container running Claude |
| `flout sandbox opencode [<name\|id>]` | Exec into a container running opencode |

Use `flout list` to see running sandboxes alongside local and remote sessions.

`--name` defaults to the basename of the current directory. `--engine` selects the container engine (auto-detected if omitted). Extra engine flags can be passed after `--` (e.g. `flout sandbox start -- --gpus all`).

Supported engines: Docker, Podman, containerd (via nerdctl/Colima). On macOS, Colima is started automatically if needed. On Linux, native engines are preferred.

> **Note:** `flout docker` still works but is deprecated. Use `flout sandbox` instead.

### Multiple sessions

You can run multiple sessions in the same directory. Each session gets a unique timestamped ID with the agent name as the third hyphen-segment, e.g. `flout-0410-152301-claude-myproject` or `flout-0410-153120-opencode-myproject`.

```bash
flout claude myproject             # → flout-0410-152301-claude-myproject
flout claude myproject             # → flout-0410-153045-claude-myproject (second session)
flout opencode myproject           # → flout-0410-153120-opencode-myproject
flout list                         # shows all of them with directories
flout join myproject               # joins if only one; lists matches if ambiguous
flout stop flout-0410-152301-claude-myproject  # stop a specific session by full ID
```

The same applies to sandbox containers.

## How it works

flout wraps tmux and your agent's CLI. `flout claude remote` starts a tmux session running Claude in remote-control mode with a respawn loop — if the agent exits or the connection drops, it restarts automatically. `flout join` attaches your terminal to see what the agent is doing. opencode has no remote-control mode, so there is no `flout opencode remote`.

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
