# @flout/opencode

[opencode](https://opencode.ai) provider for [@flout/cli](../cli/). Implements the `Agent` interface for local opencode sessions.

opencode does not have a remote-control mode, so `remoteCommand` is intentionally not implemented — `flout remote` and `flout restart` will refuse to run with this agent.

## Usage

This package is a dependency of the main `flout` CLI. Use the `flout opencode` subcommand:

```bash
flout setup opencode
flout opencode myproject
```

## Agent interface

| Method | Description |
|--------|-------------|
| `startCommand()` | Returns `opencode` |
| `loginCommand()` | Returns `opencode auth login` (only needed to add extra providers) |
| `isAuthenticated()` | Returns `true` whenever the `opencode` binary is on `PATH` — opencode ships with built-in models that work out of the box, so binary-presence is the meaningful authentication signal |
| `isTrusted(dir)` | Always `true` — opencode has no per-directory trust system |
| `trustCommand()` | Returns `opencode` (no-op trust flow) |
| `encodePath(dir)` | Converts `/path/to/dir` to `-path-to-dir` |

`remoteCommand` and `setupTokenCommand` are intentionally omitted: opencode has no remote-control mode, and `opencode auth login` already produces a long-lived credential.

## Tests

Unit tests live in `test/opencode.test.ts`. End-to-end tests for the opencode flout integration live in `packages/cli/test/e2e/opencode.e2e.ts` — they skip themselves when `opencode` isn't installed locally, and CI installs it via `npm i -g opencode-ai`.

## License

GPL-2.0
