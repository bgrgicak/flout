import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Dockerfile embedded as a string constant. Mirrors the pattern from
// @flout/sandbox so the image tag is content-addressed (sha256 of the
// Dockerfile text) — any edit here automatically invalidates the cached image
// on next build, no manual version bumping needed.
//
// Layer ordering note: backend CLIs (codex/gemini/opencode/claude) sit BEFORE
// phone-a-friend so PaF version bumps don't invalidate the (larger) backend
// install layers. `phone-a-friend plugin install --opencode` must come after
// both PaF and opencode are installed.
export const EMBEDDED_DOCKERFILE = `FROM node:22-slim

RUN apt-get update && apt-get install -y \\
    bash curl git sudo tmux \\
    && rm -rf /var/lib/apt/lists/*

# node:22-slim ships a 'node' user at UID 1000. Remove it so 'dev' can
# take UID 1000 — bind-mounted credential files (~/.claude, ~/.local/share/opencode,
# ~/.codex, ~/.gemini) are then readable/writable by dev without permission issues.
RUN userdel -r node 2>/dev/null || true \\
    && useradd -m -s /bin/bash -u 1000 dev \\
    && adduser dev sudo \\
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Backend CLIs (stable layer). Bumped less often than PaF, so they sit in their
# own RUN to keep their cache hit when PaF version changes.
RUN npm install -g \\
      @openai/codex \\
      @google/gemini-cli \\
      opencode-ai

USER dev
WORKDIR /home/dev
ENV PATH="/home/dev/.local/bin:\${PATH}"

# Claude — native installer writes ~/.local/bin/claude. Symlink into
# /usr/local/bin so bash -lc (login shells used in docker exec) finds it.
RUN curl -fsSL https://claude.ai/install.sh | bash \\
    && sudo ln -sf /home/dev/.local/bin/claude /usr/local/bin/claude

# PaF installed LAST (volatile layer). When PaF version bumps, only this layer
# and the plugin-install layer below rebuild — the backend CLIs above stay cached.
USER root
RUN npm install -g @freibergergarcia/phone-a-friend@2.3.1
USER dev

# PaF OpenCode shim install at build time (host shims are nvm-symlinks, can't mount).
RUN phone-a-friend plugin install --opencode

# Pre-create auth dirs as dev so bind mounts don't break writes to adjacent paths.
RUN mkdir -p \\
      /home/dev/.claude \\
      /home/dev/.codex \\
      /home/dev/.gemini \\
      /home/dev/.local/share/opencode \\
      /home/dev/.config/opencode \\
      /home/dev/.config/phone-a-friend

RUN echo 'echo ""; phone-a-friend doctor 2>&1 | head -30 || true; echo ""' >> /home/dev/.bashrc

CMD ["sleep", "infinity"]
`;

export const IMAGE_BASE = 'paf-flout';

// 12-char prefix of sha256(EMBEDDED_DOCKERFILE) — matches @flout/sandbox's tag
// shape so the look-and-feel is consistent across flout-built images.
export const DOCKERFILE_TAG = crypto
  .createHash('sha256')
  .update(EMBEDDED_DOCKERFILE)
  .digest('hex')
  .slice(0, 12);

export const IMAGE_NAME = `${IMAGE_BASE}:${DOCKERFILE_TAG}`;

export interface BuildOptions {
  engineBinary?: string;   // 'docker' (default), 'podman', or 'nerdctl'
  extraTags?: string[];    // additional tags to apply, e.g. ['paf-flout:latest', 'paf-flout:r3']
}

export function buildImage(options: BuildOptions = {}): void {
  const engineBinary = options.engineBinary ?? 'docker';
  const extraTags = options.extraTags ?? [];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-flout-build-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), EMBEDDED_DOCKERFILE);
    const tagArgs = [IMAGE_NAME, ...extraTags].flatMap(t => ['-t', t]);
    execFileSync(engineBinary, ['build', ...tagArgs, tmpDir], { stdio: 'inherit' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
