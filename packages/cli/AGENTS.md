# Contributing to flout

## Monorepo structure

```
packages/
  cli/                Main CLI — session management, setup, types
    src/cli.ts        CLI entry point — parses args, dispatches commands
    src/sessions.ts   tmux session lifecycle (start, remote, stop, join, list, restart, status)
    src/setup.ts      setup and trust commands
    src/types.ts      Agent interface — exported for providers
    bin/flout.js      Thin ESM shim for the compiled CLI
    test/             CLI and session integration tests

  claude/             @flout/claude — Claude Code provider
    src/index.ts      Claude-specific commands, auth, and trust checking

  sandbox/            @flout/sandbox — Multi-engine container sandbox
    src/engine.ts     Engine detection (Docker, Podman, nerdctl) and abstraction
    src/colima.ts     Colima VM lifecycle management
    src/index.ts      Container lifecycle (start, stop, shell, status)

  docker/             @flout/docker — Docker runtime (deprecated, use sandbox)
    src/index.ts      Container lifecycle (start, stop, shell, status)
```

## Architecture

flout is a TypeScript monorepo using npm workspaces. The core `@flout/cli` package is agent-agnostic — `sessions.ts` and `setup.ts` accept an `Agent` interface and never reference Claude directly.

The `Agent` interface is defined in `packages/cli/src/types.ts`:

```ts
interface Agent {
  name: string;
  binary: string;
  installHint?: string;
  remoteCommand(sessionName: string): string;
  startCommand(): string;
  loginCommand(): string;
  setupTokenCommand(): string;
  isAuthenticated(): boolean;
  isTrusted(dir: string): boolean;
  trustCommand(): string;
  encodePath(dir: string): string;
}
```

## Adding a new agent

1. Create a new package `packages/<name>/` with `src/index.ts` exporting an object satisfying `Agent`
2. Add it as a workspace dependency in `packages/cli/package.json`
3. Wire it up in `packages/cli/src/cli.ts`

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

## Constraints

- Minimal dependencies — only TypeScript and @types/node as dev deps
- No frameworks for arg parsing — manual `process.argv`
- Node.js 18+ required (for `node:test`)
- ESM throughout (`"type": "module"`)
