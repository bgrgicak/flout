# Contributing to gabbo

## Project structure

```
bin/gabbo.js          CLI entry point — parses args, dispatches to lib/
lib/sessions.js       tmux session lifecycle (start, remote, stop, join, list, restart)
lib/setup.js          setup and trust commands
lib/agents/claude.js  Claude-specific commands and trust checking
test/                 Tests using node:test
```

## Architecture

gabbo is agent-agnostic at the session layer. `lib/sessions.js` and `lib/setup.js` accept an agent object and never reference Claude directly. Agent-specific logic lives in `lib/agents/`.

An agent object must implement:

```js
{
  name: 'agent-name',
  binary: 'agent-binary',           // checked during setup
  remoteCommand(sessionName),       // command string for remote-control mode
  startCommand(),                   // command string for local interactive mode
  loginCommand(),                   // command string for interactive login
  setupTokenCommand(),              // command string for long-lived token creation
  isTrusted(dir),                   // returns boolean
  trustCommand(),                   // command string to run interactively for trust
}
```

## Adding a new agent

1. Create `lib/agents/<name>.js` exporting an agent object
2. Add it as an option in `bin/gabbo.js` (future: `--agent` flag)

## Testing

```bash
npm test
```

Tests use `node:test` and `node:assert` (no dependencies). Integration tests use a real bash-based agent and real tmux sessions — no mocks.

## Constraints

- Zero npm dependencies — only Node.js built-ins
- No frameworks for arg parsing — manual `process.argv`
- Node.js 18+ required (for `node:test`)
