# @flout/docker

> **Deprecated:** Use [`@flout/sandbox`](../sandbox/) instead. It supports Docker, Podman, and containerd with automatic engine detection.

Docker runtime for [@flout/cli](../cli/). Manages container lifecycle — build images, start/stop containers, and exec into them.

## Usage

This package is a dependency of the main `flout` CLI. You don't need to install it directly.

```ts
import * as docker from '@flout/docker';

docker.start({ name: 'myproject', cwd: '/path/to/project', extraArgs: [], agent });
docker.stop({ name: 'myproject' });
docker.shell({ name: 'myproject' });
docker.claude({ name: 'myproject' });
docker.status();
```

## Commands

| Function | Description |
|----------|-------------|
| `start({ name, cwd, extraArgs, agent })` | Build image if needed, start container with project mounted |
| `stop({ name })` | Stop a running container (resolves by label or full ID) |
| `shell({ name })` | Exec into a container, landing in the project directory |
| `claude({ name })` | Exec into a container and launch Claude directly |
| `status()` | List all flout containers and their state |
| `resolveContainer(query)` | Find a container by label or full name, with disambiguation |

## Multiple containers

Each `docker start` creates a new container with a timestamped name (e.g. `flout-0410-152301-myproject`). You can run multiple containers for the same project directory.

When a label matches multiple containers, `stop`, `shell`, and `claude` list the matches so you can use the full container name.

## Container conventions

- **Image**: `flout` (built from an embedded Dockerfile on first run)
- **Container name**: `flout-<MMdd-HHmmss>-<label>` (label defaults to project directory basename)
- **Mount**: host project dir to `/home/dev/<basename>`
- **Auth**: mounts `~/.claude` for credential persistence
- **Git**: passes through `user.name` and `user.email` as env vars
- **Trust**: auto-creates the Claude trust directory for the mounted path

Extra Docker flags can be passed via `extraArgs` (exposed as `--` in the CLI).

## License

GPL-2.0
