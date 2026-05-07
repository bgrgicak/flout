# flout skills

This directory contains reusable Agent Skills that teach an AI coding agent how to drive `flout`. Add them to your agent so it can start, stop, and manage flout sessions for you on request.

## Available skills

| Skill | What it does |
|-------|--------------|
| [`claude-sessions`](./claude-sessions/SKILL.md) | Manage Claude Code and opencode sessions via flout — start/stop/restart/list/join sessions, including always-on remote sessions and container sandboxes. |

## Installing a skill

The format is just a markdown file (`SKILL.md`) with YAML frontmatter. How you load it depends on your agent.

### Claude Code (CLI)

Symlink (or copy) the skill folder into `~/.claude/skills/`:

```bash
ln -s "$(pwd)/skills/claude-sessions" ~/.claude/skills/claude-sessions
```

Restart Claude Code (or run `/new`) and the skill will appear in the available-skills list. Symlinking is preferred — pulling new commits keeps the skill up to date automatically.

### Cursor, Windsurf, Continue, and other IDE agents

These agents don't have a native skill registry yet. Paste the body of `SKILL.md` (everything after the frontmatter) into your project rules — typically `.cursorrules` (Cursor), `.windsurfrules` (Windsurf), or the equivalent system-prompt-style configuration for your tool.

### ChatGPT custom GPTs / Claude Projects

Paste the body of `SKILL.md` into the custom-instructions or project-knowledge field. Note that web-hosted chats can only use this skill if you also wire up a tool that gives the agent shell access to your machine — see **Limitations** below.

### Generic agents with shell access

Any agent that can call a Bash-style tool can use this skill. Add the body of `SKILL.md` to its system prompt and ensure the `flout` binary is on the agent's `PATH`.

## Limitations

These skills assume the agent can run shell commands on the same machine where `flout` is installed. They will not work in:

- **Hosted web chats with no shell tool** (Claude.ai, ChatGPT.com without a sandbox or MCP shell server). The agent has no way to invoke `flout`.
- **Remote agents on a different host than `flout`.** Either install `flout` on the host the agent runs on, or expose a remote shell to the agent.
- **Non-interactive contexts that try to `flout join`.** Joining attaches a TTY to a tmux window — useful for humans, useless for headless agents. Agents should inspect state with `flout list` instead.

The skills also assume `flout`'s prerequisites are already installed: Node.js 18+, tmux, and a container engine (Colima recommended, or Podman/Docker). Run `flout setup` once on a new machine.

## Keeping skills in sync with the CLI

The CLI evolves; skills can drift. If the skill describes a `flout` command that no longer exists, the CLI will print a `… has been replaced. Use 'flout X' instead.` hint — please open an issue or PR updating the skill so other users don't hit the same edge.

## License

GPL-2.0-only, same as the rest of the repo.
