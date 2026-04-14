FROM node:20-slim

RUN apt-get update && apt-get install -y \
    bash curl git sudo tmux \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash dev \
    && adduser dev sudo \
    && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Install flout from source
COPY --chown=dev:dev package.json package-lock.json tsconfig.json tsconfig.base.json /tmp/flout/
COPY --chown=dev:dev packages /tmp/flout/packages
USER root
RUN cd /tmp/flout && npm ci && npm run build \
    && cd packages/claude && npm pack && mv flout-claude-*.tgz /tmp/ && cd .. \
    && cd docker && npm pack && mv flout-docker-*.tgz /tmp/ && cd .. \
    && cd cli && npm pack && mv flout-cli-*.tgz /tmp/ && cd .. \
    && npm install -g /tmp/flout-claude-*.tgz /tmp/flout-docker-*.tgz /tmp/flout-cli-*.tgz \
    && rm -rf /tmp/flout /tmp/flout-*.tgz
USER dev

WORKDIR /home/dev
RUN echo 'echo ""; flout status; echo ""' >> /home/dev/.bashrc

CMD ["sleep", "infinity"]
