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
gabbo start <name> [--path <dir>]    Start a local session in tmux
gabbo remote <name> [--path <dir>]   Start a remote-control session (always-on)
gabbo stop <name>                    Stop a session
gabbo join <name>                    Attach to a running session
gabbo list                           List active sessions
gabbo status                         Show login and session status
gabbo restart <name> [--path <dir>]  Restart a remote session
gabbo trust <dir>                    Trust a project directory
gabbo docker <cmd> [--name <n>]      Manage Docker containers
```

### Local sessions

```bash
gabbo setup              # one-time: check deps and authenticate
gabbo start myproject    # start a session in the current directory
gabbo join myproject     # reattach after disconnecting
gabbo stop myproject     # tear it down
```

### Remote sessions

Remote sessions auto-restart if the agent exits, so they stay running unattended.

```bash
gabbo remote myproject --path ~/code/myproject
gabbo restart myproject
```

### Docker

Run sessions in isolated Docker containers.

```bash
gabbo docker start          # start a container for the current directory
gabbo docker shell          # open a shell in the container
gabbo docker stop           # stop the container
gabbo docker status         # list running containers
```

## License

GPL-2.0-only
