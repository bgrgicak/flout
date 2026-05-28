# flout

Manage persistent AI agent sessions with tmux. Start, stop, join, and restart long-running coding-agent sessions (Claude Code, Codex, or opencode) from the command line — locally or in container sandboxes (Docker, Podman, or containerd via Colima).

## Install

```bash
npm install -g @flout/cli
```

Requires Node.js 18+, tmux, and a container engine ([Colima](https://colima.run/) recommended, or Podman/Docker).

## Usage

```
flout claude [name] [--path <dir>]          Start a local Claude session and attach
flout claude remote [name] [--path <dir>]   Start an always-on Claude session (detached)
flout codex [name] [--path <dir>]           Start a local Codex session and attach
flout codex remote [name] [--path <dir>]    Start an always-on Codex remote-control session
flout opencode [name] [--path <dir>]        Start a local opencode session and attach
flout join <name|id>                        Re-attach to a running session
flout list                                  List tmux sessions and sandbox containers
flout stop <name|id>                        Stop a session
flout restart <name|id> [--path <dir>]      Restart a remote session
flout status                                Show login + session status for each agent
flout setup [agent]                         Install/check deps and authenticate (default: claude)
flout trust <dir> [agent]                   Trust a project directory (default: claude)
flout sandbox <cmd> [<name|id>]             Manage container sandboxes (start|stop|shell|claude|codex|opencode)
```

### Local sessions

```bash
flout setup              # one-time: check deps and authenticate
flout claude myproject   # create a Claude session and attach immediately
flout codex myproject    # create a Codex session and attach immediately
                         # detach with Ctrl+B D — session keeps running
flout join myproject     # re-attach later
flout stop myproject     # tear it down
```

`flout claude`, `flout codex`, and `flout opencode` auto-attach when run from a terminal. In non-interactive contexts (scripts, piped output) they fall back to detached mode and print a `flout join <id>` hint.

### Picking an agent

flout has three agents today:

- **`flout claude`** — Claude Code. Supports a remote-control "always-on" mode via `flout claude remote`.
- **`flout codex`** — Codex. Supports a remote-control "always-on" mode via `flout codex remote`.
- **`flout opencode`** — [opencode](https://opencode.ai). Ships with built-in models that work without an API key, so `flout status` reports it as logged-in as soon as the `opencode` binary is on your `PATH`. opencode has no remote-control mode, so there is no `flout opencode remote`.

```bash
flout setup opencode         # one-time: check deps for opencode
flout setup codex            # one-time: check deps for Codex
flout opencode myproject     # create an opencode session and attach
flout codex myproject        # create a Codex session and attach
```

### Remote (always-on) sessions

Remote sessions stay detached and auto-restart if the agent exits, so they keep running unattended.

```bash
flout claude remote myproject --path ~/code/myproject
flout codex remote myproject --path ~/code/myproject
flout restart myproject     # kill and recreate the remote session
```

### Multiple sessions

Each session gets a unique timestamped ID (e.g. `flout-0410-152301-claude-myproject`), so you can run multiple sessions in the same directory. The third hyphen-separated segment is the agent name.

```bash
flout claude myproject              # creates flout-0410-152301-claude-myproject
flout claude myproject              # creates flout-0410-153045-claude-myproject
flout codex myproject               # creates flout-0410-153015-codex-myproject
flout opencode myproject            # creates flout-0410-153120-opencode-myproject
flout list                          # show every session and sandbox in one table
flout stop flout-0410-152301-claude-myproject  # stop by full ID
```

`flout list` shows local sessions, remote (always-on) sessions, and sandbox containers together — one row per item, with the meaningful label, type, host directory, and age:

```
LABEL       TYPE            DIRECTORY                  AGE
myproject   local           /home/me/code/myproject    12m
api         remote          /home/me/code/api          3h
myproject   sandbox/podman  /home/me/code/myproject    1m
```

When only one session matches a label, commands like `join` and `stop` resolve it automatically. When multiple match, flout lists the options so you can use the full ID.

### Sandboxes

Run agents inside isolated containers. The image bundles Claude, Codex, and opencode and is built once on first use, then reused. Supports Docker, Podman, and containerd (via Colima or nerdctl) — the engine is auto-detected.

```bash
flout sandbox start                    # build (first time) and start a container
flout sandbox start --engine podman    # force a specific engine
flout sandbox shell                    # open a shell in the container
flout sandbox claude                   # exec claude inside the container
flout sandbox codex                    # exec codex inside the container
flout sandbox opencode                 # exec opencode inside the container
flout sandbox stop                     # stop the container
flout list                             # see sandboxes alongside tmux sessions
```

The container's `dev` user is pinned to UID 1000 and your `~/.claude`, `~/.codex`, and `~/.local/share/opencode` directories are bind-mounted in, so credentials propagate automatically. On macOS, Colima is started automatically if needed. On Linux, native Docker or Podman is preferred.

## Agent skills

[`skills/`](./skills/) contains drop-in Agent Skills that teach Claude Code (or any agent with a shell tool) how to drive flout — start, stop, restart, list, and join sessions on request. See [`skills/README.md`](./skills/README.md) for install instructions for Claude Code, Cursor, ChatGPT custom GPTs, and other agents, plus the limitations that apply to hosted/web chats with no shell access.

## License

GPL-2.0-only
