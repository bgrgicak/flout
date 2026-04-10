# gabbo

Manage persistent AI agent sessions with tmux. Start, stop, join, and restart long-running Claude Code sessions from the command line — locally or inside Docker containers.

## Install

```bash
npm install -g gabbo
```

Requires Node.js 18+ and tmux.

## Usage

```
gabbo setup                          Check dependencies, login, create token
gabbo start [name] [--path <dir>]    Start a local session in tmux (sudo for sandbox)
gabbo remote [name] [--path <dir>]   Start a remote-control session (always-on)
gabbo stop <name|id>                 Stop a session
gabbo join <name|id>                 Attach to a running session
gabbo list                           List active sessions
gabbo status                         Show login and session status
gabbo restart <name|id> [--path <dir>]  Restart a remote session
gabbo trust <dir>                    Trust a project directory
gabbo docker <cmd> [<name|id>]       Manage Docker containers
```

### Local sessions

```bash
gabbo setup              # one-time: check deps and authenticate
gabbo start myproject    # start a session in the current directory
sudo gabbo start myproject  # start with sandbox mode (IS_SANDBOX=1)
gabbo join myproject     # reattach after disconnecting
gabbo stop myproject     # tear it down
```

### Remote sessions

Remote sessions auto-restart if the agent exits, so they stay running unattended.

```bash
gabbo remote myproject --path ~/code/myproject
gabbo restart myproject
```

### Multiple sessions

Each session gets a unique timestamped ID (e.g. `gabbo-0410-152301-myproject`), so you can run multiple sessions in the same directory.

```bash
gabbo start myproject              # creates gabbo-0410-152301-myproject
gabbo start myproject              # creates gabbo-0410-153045-myproject
gabbo list                         # shows both with their directories
gabbo stop gabbo-0410-152301-myproject  # stop by full ID
```

When only one session matches a name, commands like `join` and `stop` resolve it automatically. When multiple match, gabbo lists the options so you can use the full ID.

### Docker

Run sessions in isolated Docker containers.

```bash
gabbo docker start          # start a container for the current directory
gabbo docker shell          # open a shell in the container
gabbo docker claude         # open claude directly in the container
gabbo docker stop           # stop the container
gabbo docker status         # list running containers
```

## License

GPL-2.0-only
