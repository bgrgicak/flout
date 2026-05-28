---
name: claude-sessions
description: Manage long-running Claude Code, Codex, and opencode sessions via the flout CLI — start, stop, restart, list, and join sessions, including always-on remote sessions and container sandboxes. Use when the user asks to start a new agent session, restart or kill an existing one, list running sessions, or otherwise references the flout CLI.
---

# flout session management

Use the `flout` CLI to manage persistent agent sessions running in tmux. flout supports three agents — **Claude Code** (`flout claude`), **Codex** (`flout codex`), and **opencode** (`flout opencode`) — and can run locally or inside a container sandbox.

Run `flout` commands via the Bash tool (or whichever shell-execution tool the host agent provides).

## Commands

### `flout list` — List sessions
Lists every flout session and sandbox container in one table — local sessions, remote (always-on) sessions, and sandboxes — with label, type, host directory, and age. **Always run this first** before starting, stopping, or restarting sessions so you know the current state.

```bash
flout list
```

### `flout claude [name] [--path <dir>]` — Start a local Claude session
Starts a Claude Code session in a tmux window and auto-attaches when run interactively. In non-interactive contexts it falls back to detached mode and prints a `flout join <id>` hint. The session does not auto-reconnect — use `flout claude remote` for always-on sessions.

- `name` (optional): session label. Defaults to the basename of the working directory.
- `--path <dir>` (optional): working directory. Defaults to the current directory.

```bash
flout claude myproject --path ~/code/myproject
```

### `flout claude remote [name] [--path <dir>]` — Start an always-on Claude session
Same as `flout claude`, but stays detached and auto-restarts if the agent exits, so it keeps running unattended.

```bash
flout claude remote myproject --path ~/code/myproject
```

### `flout codex [name] [--path <dir>]` — Start a local Codex session
Starts a Codex session in a tmux window and auto-attaches when run interactively. In non-interactive contexts it falls back to detached mode and prints a `flout join <id>` hint. The session does not auto-reconnect — use `flout codex remote` for always-on sessions.

- `name` (optional): session label. Defaults to the basename of the working directory.
- `--path <dir>` (optional): working directory. Defaults to the current directory.

```bash
flout codex myproject --path ~/code/myproject
```

### `flout codex remote [name] [--path <dir>]` — Start an always-on Codex session
Same as `flout codex`, but stays detached and auto-restarts if the remote-control process exits, so it keeps running unattended.

```bash
flout codex remote myproject --path ~/code/myproject
```

### `flout opencode [name] [--path <dir>]` — Start a local opencode session
Starts an [opencode](https://opencode.ai) session in a tmux window. opencode ships with built-in models that work without an API key. There is **no** `flout opencode remote` — opencode has no remote-control mode.

```bash
flout opencode myproject --path ~/code/myproject
```

### `flout stop <name|id>` — Stop a session
Terminates a running session by label or full ID. If multiple sessions share a label, use the full ID from `flout list`.

```bash
flout stop myproject
flout stop flout-0410-152301-claude-myproject
```

### `flout restart <name|id> [--path <dir>]` — Restart a remote session
Stops and restarts a remote session.

```bash
flout restart myproject
```

### `flout join <name|id>` — Attach to a session
Reattaches to a running session's tmux window. Requires an interactive terminal — see **Limitations** below.

```bash
flout join myproject
```

### `flout status` — Show login and session status
Reports current authentication state and running session count for each agent.

### `flout setup [agent]` — One-time setup
Checks dependencies, logs in, and creates a token when the agent needs one. Run once on a new machine. Defaults to `claude`; pass `codex` or `opencode` to set up another agent instead.

```bash
flout setup            # set up claude
flout setup codex      # set up Codex
flout setup opencode   # set up opencode
```

### `flout trust <dir> [agent]` — Trust a project directory
Marks a directory as trusted so sessions can run there without per-session prompts. Defaults to `claude`.

### `flout sandbox <cmd> [<name|id>]` — Container sandboxes
Manages container-based sandboxes. The image bundles Claude, Codex, and opencode and is built once on first use. Supports Docker, Podman, and containerd (via Colima or nerdctl) — auto-detected.

Subcommands: `start`, `stop`, `shell`, `claude`, `codex`, `opencode`.

```bash
flout sandbox start                    # build (first time) and start a container
flout sandbox start --engine podman    # force a specific engine
flout sandbox shell                    # open a shell in the container
flout sandbox claude                   # exec claude inside the container
flout sandbox codex                    # exec codex inside the container
flout sandbox opencode                 # exec opencode inside the container
flout sandbox stop                     # stop the container
```

The container's `dev` user is pinned to UID 1000 and `~/.claude`, `~/.codex`, and `~/.local/share/opencode` are bind-mounted in, so credentials propagate automatically.

## When to use these commands

- **User asks "what sessions are running"** → `flout list`
- **User asks to "start a new session"** in a path → `flout claude <name> --path <dir>` or `flout codex <name> --path <dir>` depending on the requested agent (use the remote variant if they want it always-on)
- **User asks to "start a remote session"** or wants auto-reconnect → `flout claude remote <name> --path <dir>` or `flout codex remote <name> --path <dir>`
- **User asks for a Codex session** → `flout codex <name> --path <dir>` (or `flout codex remote` if they want it always-on)
- **User asks for an opencode session** → `flout opencode <name> --path <dir>`
- **User asks to "kill" or "stop" a session** → `flout stop <name|id>`
- **User asks to "restart"** a session → `flout restart <name|id>`
- **User asks for a sandboxed/containerized session** → `flout sandbox start` then `flout sandbox claude`, `flout sandbox codex`, or `flout sandbox opencode`
- **Before any session operation** → run `flout list` first to see current state

## Important notes

- Sessions are tmux windows running the agent with approval prompts bypassed where the agent supports it (Claude and Codex).
- Each session gets a unique timestamped ID with the agent name as the third hyphen-segment, e.g. `flout-0410-152301-claude-myproject`, `flout-0410-153015-codex-myproject`, or `flout-0410-153120-opencode-myproject`. Multiple sessions can run in the same directory.
- When only one session matches a label, `join`/`stop`/`restart` resolve it automatically. When multiple match, list the options for the user and use the full ID.
- `flout claude remote` and `flout codex remote` keep the session alive across disconnects and auto-restart if the agent exits; local sessions do not.
- flout requires Node.js 18+, tmux, and a container engine (Colima recommended, or Podman/Docker). Install with `npm install -g @flout/cli`.

## Limitations

- **The host agent must have shell access on the same machine where `flout` is installed.** This skill cannot drive flout on a different host, and it cannot be used by a hosted agent without shell tools (e.g. a Claude.ai or ChatGPT.com web chat with no Bash tool).
- **`flout join` requires an interactive terminal.** It attaches your terminal to a tmux window and is not useful from a non-interactive agent — agents should use `flout list` to inspect state instead.
- **Restarting the session you're in terminates your own conversation.** If you're running inside a flout-managed session and you call `flout stop` or `flout restart` on yourself, your conversation ends. Confirm with the user before stopping the current session.
- **The CLI evolves.** If a `flout <command>` invocation prints `'flout X' has been replaced. Use 'flout Y' instead.`, follow the suggested replacement and re-run — don't retry the old command.
