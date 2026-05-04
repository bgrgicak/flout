# @flout/sandbox

Multi-engine container sandbox for [@flout/cli](../cli/). Manages container lifecycle — build images, start/stop containers, and exec into them. Supports Docker, Podman, and containerd (via nerdctl/Colima).

## Usage

This package is a dependency of the main `flout` CLI. You don't need to install it directly.

```ts
import * as sandbox from '@flout/sandbox';

sandbox.start({ name: 'myproject', cwd: '/path/to/project', extraArgs: [], agent });
sandbox.stop({ name: 'myproject' });
sandbox.shell({ name: 'myproject' });
sandbox.claude({ name: 'myproject' });
sandbox.status();
```

## Engine selection

The engine is auto-detected, preferring the fastest available option:

**Linux:** native Docker > Podman > Colima > nerdctl

**macOS:** Colima > Docker Desktop > Podman

Override with the `engine` option:

```ts
sandbox.start({ name: 'myproject', cwd: '/path/to/project', extraArgs: [], agent, engine: 'podman' });
```

Valid engines: `docker`, `podman`, `nerdctl`.

From the CLI: `flout sandbox start --engine containerd` (containerd maps to nerdctl).

## Colima integration

On macOS (or Linux without a native engine), Colima is started automatically when needed. On Linux, `sg kvm` is used if the shell session lacks KVM group access.

## Functions

| Function | Description |
|----------|-------------|
| `start({ name, cwd, extraArgs, agent, engine? })` | Build image if needed, start container with project mounted |
| `stop({ name, engine? })` | Stop a running container (resolves by label or full ID) |
| `shell({ name, engine? })` | Exec into a container, landing in the project directory |
| `claude({ name, engine? })` | Exec into a container and launch Claude directly |
| `status(engine?)` | List all flout containers and their state |
| `resolveContainer(query, engine?)` | Find a container by label or full name, with disambiguation |
| `detectEngine(preferred?)` | Detect the best available container engine |
| `normalizeEngine(input)` | Map user-facing engine name to internal type (`containerd` -> `nerdctl`) |

## Container conventions

- **Image**: `flout-sandbox` (built from an embedded Dockerfile on first run; bundles both Claude and opencode)
- **Container name**: `flout-<MMdd-HHmmss>-<label>` (label defaults to project directory basename)
- **Mount**: host project dir to `/home/dev/<basename>`
- **Auth**: mounts `~/.claude` and `~/.local/share/opencode` for credential persistence
- **Git**: passes through `user.name` and `user.email` as env vars
- **Trust**: auto-creates the Claude trust directory for the mounted path

Extra engine flags can be passed via `extraArgs` (exposed as `--` in the CLI).

## License

GPL-2.0
