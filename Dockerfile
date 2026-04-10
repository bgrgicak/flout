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

# Install gabbo from source
COPY --chown=dev:dev package.json package-lock.json tsconfig.json tsconfig.base.json /tmp/gabbo/
COPY --chown=dev:dev packages /tmp/gabbo/packages
USER root
RUN cd /tmp/gabbo && npm ci && npm run build \
    && cd packages/claude && npm pack && mv gabbo-claude-*.tgz /tmp/ && cd .. \
    && cd docker && npm pack && mv gabbo-docker-*.tgz /tmp/ && cd .. \
    && cd gabbo && npm pack && mv gabbo-*.tgz /tmp/ && cd .. \
    && npm install -g /tmp/gabbo-claude-*.tgz /tmp/gabbo-docker-*.tgz /tmp/gabbo-*.tgz \
    && rm -rf /tmp/gabbo /tmp/gabbo-*.tgz
USER dev

WORKDIR /home/dev
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc \
    && echo 'echo ""; gabbo status; echo ""' >> /home/dev/.bashrc

ENV PATH="/home/dev/.local/bin:${PATH}"
CMD ["sleep", "infinity"]
