FROM node:20-slim

RUN apt-get update && apt-get install -y \
    bash curl git sudo tmux jq ripgrep \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev \
    && adduser dev sudo \
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Install Claude Code
USER dev
RUN curl -fsSL https://claude.ai/install.sh | bash

# Install flout from source
COPY --chown=dev:dev package.json package-lock.json tsconfig.json tsconfig.base.json /tmp/flout/
COPY --chown=dev:dev packages /tmp/flout/packages
USER root
RUN cd /tmp/flout && npm ci && npm run build \
    && cd packages/claude && npm pack && mv flout-claude-*.tgz /tmp/ && cd .. \
    && cd docker && npm pack && mv flout-docker-*.tgz /tmp/ && cd .. \
    && cd flout && npm pack && mv flout-*.tgz /tmp/ && cd .. \
    && npm install -g /tmp/flout-claude-*.tgz /tmp/flout-docker-*.tgz /tmp/flout-*.tgz \
    && rm -rf /tmp/flout /tmp/flout-*.tgz
USER dev

WORKDIR /home/dev
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc \
    && echo 'echo ""; flout status; echo ""' >> /home/dev/.bashrc

ENV PATH="/home/dev/.local/bin:${PATH}"
CMD ["sleep", "infinity"]
