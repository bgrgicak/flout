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

# Install gabbo
COPY packages/gabbo /tmp/gabbo
USER root
RUN cd /tmp/gabbo && npm pack && npm install -g gabbo-*.tgz && rm -rf /tmp/gabbo
USER dev

WORKDIR /home/dev
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/dev/.bashrc \
    && echo 'echo ""; gabbo status; echo ""' >> /home/dev/.bashrc

ENV PATH="/home/dev/.local/bin:${PATH}"
CMD ["sleep", "infinity"]
