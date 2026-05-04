# Contributing to flout

## Monorepo structure

```
packages/
  cli/                Main CLI — session management, setup, types
    src/cli.ts        CLI entry point — parses args, dispatches per-agent subcommands, owns the AGENTS registry
    src/sessions.ts   tmux session lifecycle (start, remote, stop, join, list, restart) + session-id parsing
    src/setup.ts      setup and trust commands
    src/types.ts      Agent interface — exported for providers
    bin/flout.js      Thin ESM shim for the compiled CLI
    test/             CLI and session integration tests

  claude/             @flout/claude — Claude Code provider
    src/index.ts      Claude-specific commands, auth, and trust checking

  opencode/           @flout/opencode — opencode provider (no remote-control mode)
    src/index.ts      opencode-specific commands and auth checking

  sandbox/            @flout/sandbox — Multi-engine container sandbox
    src/engine.ts     Engine detection (Docker, Podman, nerdctl) and abstraction
    src/colima.ts     Colima VM lifecycle management
    src/index.ts      Container lifecycle (start, stop, shell, status)

  docker/             @flout/docker — Docker runtime (deprecated, use sandbox)
    src/index.ts      Container lifecycle (start, stop, shell, status)
```

## Architecture

flout is a TypeScript monorepo using npm workspaces. The core `@flout/cli` package is agent-agnostic — `sessions.ts` and `setup.ts` accept an `Agent` interface and never reference Claude directly. CLI dispatch is per-agent: each agent gets its own top-level subcommand (`flout claude …`, `flout opencode …`).

The `Agent` interface is defined in `packages/cli/src/types.ts`:

```ts
interface Agent {
  name: string;                                    // alphanumeric only — encoded into session ids
  binary: string;
  installHint?: string;
  remoteCommand?(sessionName: string): string;     // optional — omit if no remote-control mode
  startCommand(): string;
  loginCommand(): string;
  setupTokenCommand?(): string;                    // optional — omit if login is sufficient
  isAuthenticated(): boolean;
  isTrusted(dir: string): boolean;
  trustCommand(): string;
  encodePath(dir: string): string;
}
```

`remoteCommand` and `setupTokenCommand` are optional. When `remoteCommand` is missing, `flout <agent> remote` and `flout restart` of one of its sessions exit with an error.

The agent name appears in session ids: `flout-{MMDD}-{HHMMSS}-{agent}-{label}`. Keep agent names alphanumeric (no hyphens) so the parser in `sessions.ts` can recover the agent from a session id.

## Adding a new agent

1. Create a new package `packages/<name>/` with `src/index.ts` exporting an object satisfying `Agent`. Use a single alphanumeric token as `name`.
2. Add it as a workspace dependency in `packages/cli/package.json` and a tsconfig reference in `packages/cli/tsconfig.json` and the root `tsconfig.json`.
3. Register it in the `AGENTS` map in `packages/cli/src/cli.ts` and add a `case '<name>'` branch to the top-level `switch` so users can run `flout <name> [name]` and `flout <name> remote [name]`.

## Container sandbox

The `@flout/sandbox` package provides multi-engine container management. It supports Docker, Podman, and nerdctl/containerd, with optional Colima VM management for macOS. The engine is auto-detected (fastest available) or can be overridden with `--engine`.

On Linux, native engines (Docker, Podman) are preferred over Colima. On macOS, Colima is preferred and started automatically if needed.

## Adding a new runtime

1. Add the engine to `packages/sandbox/src/engine.ts` (detection logic)
2. Ensure the CLI interface is compatible (most OCI runtimes share `docker`-compatible commands)
3. Add tests for the new engine in `packages/sandbox/test/`

## Building

```bash
npm install     # install workspace dependencies
npm run build   # tsc --build (compiles all packages)
npm test        # runs tests across all workspaces
```

## Testing

Tests use `node:test` and `node:assert`. Integration tests use a real bash-based agent and real tmux sessions — no mocks.

### E2E tests

E2E suites live in `packages/cli/test/e2e/` and run real flout commands end-to-end:

- `sessions.e2e.ts` — exercises the Claude path. Uses `@flout/claude-mock-api` (HTTP mock) and a fake `claude` binary that just sleeps, so the suite needs no external services.
- `opencode.e2e.ts` — exercises the opencode path. Runs the **real** `opencode` binary (no mock), since opencode ships with built-in models that work without any external API key. The suite skips itself when `opencode` is not in `PATH`, so local devs don't have to install it.
- `sandbox.e2e.ts` / `sandbox-engines.e2e.ts` / `docker.e2e.ts` — container-engine integration.

Run a single suite with `npx tsx --test packages/cli/test/e2e/<file>.e2e.ts`. CI installs opencode via `npm i -g opencode-ai` and runs the opencode suite as part of the standard build-lint-test job.

## Constraints

- Minimal dependencies — only TypeScript and @types/node as dev deps
- No frameworks for arg parsing — manual `process.argv`
- Node.js 18+ required (for `node:test`)
- ESM throughout (`"type": "module"`)
