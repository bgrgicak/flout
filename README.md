# flout

Manage persistent AI agent sessions with tmux. Start, stop, join, and restart long-running coding-agent sessions (Claude Code or opencode) from the command line — locally or in container sandboxes (Docker, Podman, or containerd via Colima).

## Install

```bash
npm install -g @flout/cli
```

Requires Node.js 18+, tmux, and a container engine ([Colima](https://colima.run/) recommended, or Podman/Docker).

## Usage

```
flout setup                          Check dependencies, login, create token
flout start [name] [--path <dir>]    Start a local session in tmux (sudo for sandbox)
flout remote [name] [--path <dir>]   Start a remote-control session (always-on)
flout stop <name|id>                 Stop a session
flout join <name|id>                 Attach to a running session
flout list                           List active sessions
flout status                         Show login and session status
flout restart <name|id> [--path <dir>]  Restart a remote session
flout trust <dir>                    Trust a project directory
flout sandbox <cmd> [<name|id>]      Manage container sandboxes
```

### Local sessions

```bash
flout setup              # one-time: check deps and authenticate
flout start myproject    # start a session in the current directory
sudo flout start myproject  # start with sandbox mode (IS_SANDBOX=1)
flout join myproject     # reattach after disconnecting
flout stop myproject     # tear it down
```

### Choosing an agent

flout defaults to Claude Code. Pass `--agent opencode` (or set `FLOUT_AGENT=opencode`) to use [opencode](https://opencode.ai) instead. opencode does not have a remote-control mode, so `flout remote` and `flout restart` only work with Claude.

```bash
flout setup --agent opencode             # one-time setup for opencode
flout start myproject --agent opencode   # start an opencode session
```

opencode ships with built-in models that work without an API key, so `flout status --agent opencode` is happy as soon as the `opencode` binary is on your `PATH`. Run `opencode auth login` only if you want to register additional providers.

### Remote sessions

Remote sessions auto-restart if the agent exits, so they stay running unattended.

```bash
flout remote myproject --path ~/code/myproject
flout restart myproject
```

### Multiple sessions

Each session gets a unique timestamped ID (e.g. `flout-0410-152301-myproject`), so you can run multiple sessions in the same directory.

```bash
flout start myproject              # creates flout-0410-152301-myproject
flout start myproject              # creates flout-0410-153045-myproject
flout list                         # shows both with their directories
flout stop flout-0410-152301-myproject  # stop by full ID
```

When only one session matches a name, commands like `join` and `stop` resolve it automatically. When multiple match, flout lists the options so you can use the full ID.

### Sandboxes

Run sessions in isolated containers. Supports Docker, Podman, and containerd (via Colima or nerdctl). The engine is auto-detected — fastest available is used.

```bash
flout sandbox start                    # start a container (auto-detects engine)
flout sandbox start --engine podman    # force a specific engine
flout sandbox shell                    # open a shell in the container
flout sandbox claude                   # open claude directly in the container
flout sandbox stop                     # stop the container
flout sandbox status                   # list running containers
```

On macOS, Colima is started automatically if needed. On Linux, native Docker or Podman is preferred.

## License

GPL-2.0-only
