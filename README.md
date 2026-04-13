# flout

Manage persistent AI agent sessions with tmux. Start, stop, join, and restart long-running Claude Code sessions from the command line — locally or inside Docker containers.

## Install

```bash
npm install -g flout
```

Requires Node.js 18+ and tmux.

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
flout docker <cmd> [<name|id>]       Manage Docker containers
```

### Local sessions

```bash
flout setup              # one-time: check deps and authenticate
flout start myproject    # start a session in the current directory
sudo flout start myproject  # start with sandbox mode (IS_SANDBOX=1)
flout join myproject     # reattach after disconnecting
flout stop myproject     # tear it down
```

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

### Docker

Run sessions in isolated Docker containers.

```bash
flout docker start          # start a container for the current directory
flout docker shell          # open a shell in the container
flout docker claude         # open claude directly in the container
flout docker stop           # stop the container
flout docker status         # list running containers
```

## License

GPL-2.0-only
