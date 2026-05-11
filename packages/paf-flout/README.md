# @flout/paf-flout

> **Fork-only.** Not part of upstream `bgrgicak/flout`. This package ships a batteries-included Docker image specific to the PaF (phone-a-friend) integration.

A monorepo package that holds the Dockerfile for the `paf-flout:<hash>` image and a small build helper. The Dockerfile is embedded as a TypeScript string constant — same shape as `@flout/sandbox`'s `EMBEDDED_DOCKERFILE` — so the image tag is content-addressed (sha256 of the Dockerfile text). Any edit to the embedded Dockerfile produces a new tag automatically.

## What's inside the image

| Layer | Contents |
|---|---|
| Base | `node:22-slim` |
| System | bash, curl, git, sudo, tmux |
| User | `dev` at UID 1000 (replaces node:22-slim's `node` user) |
| Backend CLIs (stable layer) | `@openai/codex`, `@google/gemini-cli`, `opencode-ai` |
| Claude | `claude.ai/install.sh` + `/usr/local/bin/claude` symlink |
| PaF (volatile layer, last) | `@freibergergarcia/phone-a-friend@2.3.1` |
| PaF plugin shim | `phone-a-friend plugin install --opencode` |
| Auth dirs | pre-created at `~/.claude`, `~/.codex`, `~/.gemini`, `~/.local/share/opencode`, `~/.config/{opencode,phone-a-friend}` |
| Shell entry | `phone-a-friend doctor` runs on shell entry via `.bashrc` |

Layer ordering: PaF sits last so PaF version bumps don't invalidate the heavier backend install layers (codex/gemini/opencode/claude all stay cached).

## Build

```bash
npm run build           # tsc compile of this package
npm run build-image     # docker build -t paf-flout:<sha256-prefix>

# also tag the build with convenience aliases:
npm run build-image -- paf-flout:r3 paf-flout:latest
```

Override the engine:

```bash
PAF_FLOUT_ENGINE_BINARY=podman npm run build-image
```

## Use with flout

```bash
# get the content-addressed tag programmatically
PAF_FLOUT_IMAGE=$(node -e "import('./packages/paf-flout/dist/src/index.js').then(m => console.log(m.IMAGE_NAME))")

flout sandbox start --image $PAF_FLOUT_IMAGE --clean --name devbox -- \
  -p 127.0.0.1:4096:4096 \
  -e OPENCODE_SERVER_PASSWORD=$(openssl rand -hex 16)

flout sandbox shell devbox
# inside: opencode serve --hostname 0.0.0.0 --port 4096
# host browser → http://localhost:4096
```

## Why this is a separate package (and fork-only)

- **Right layer.** `@flout/sandbox` is the generic container lifecycle (knows nothing about specific tools). This package owns the image-specific knowledge (which CLIs to bundle, which versions, layer order).
- **Doesn't go upstream.** Bero's flout is a generic agent-session tool. The PaF integration is one specific use case — it lives in the fork.
- **Content-addressed tagging.** Edit the Dockerfile string → automatic new tag on next build, mirroring how `@flout/sandbox` invalidates its `flout-sandbox:<hash>` image.

## Related

- Eventual home: dedicated `paf-flout` repo with CI multi-arch builds and GHCR publishing — see the portability plan.
- Predecessor: loose Dockerfile at `~/sandbox-experiments/paf-flout-track-a/Dockerfile` (now superseded by this package).
