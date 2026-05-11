# paf-flout proxy (intent stub)

> Status: **template + manual runbook only.** Automation scripts (`proxy:up`, `proxy:down`, `proxy:doctor`, `serve:opencode`) are deferred to a follow-up PR. See the **Why deferred** section at the bottom.

This subdirectory holds the per-project Caddy reverse-proxy convention for paf-flout sandboxes. The goal is a bookmarkable `https://flout.test:<port>` URL for OpenCode's web UI instead of `http://localhost:4096`.

## Architecture

```
browser
   │
   ▼ https://flout.test:4143               ← any chosen HTTPS port (4143 example)
/etc/hosts: 127.0.0.1 flout.test           ← one-time, sudo
   │
   ▼
Caddy on host (foreground process)         ← uses this template, signed by mkcert
   │
   ▼ reverse_proxy 127.0.0.1:4096
flout sandbox container
   ├─ opencode serve --hostname 0.0.0.0 --port 4096
   └─ started with: flout sandbox start ... -- -p 127.0.0.1:4096:4096
```

### Why this shape

| Decision | Reason |
|---|---|
| Caddy on host (not in container) | Mirrors the existing aria.test pattern on this machine. Host owns TLS termination; container stays plain. |
| Caddy port `:4143`, opencode port `:4096` (distinct) | Keeps opencode at its natural port so direct connections / tooling still work. Caddy is a purely additive TLS shim. |
| `.test` TLD | macOS routes `*.local` through mDNS with a 5s timeout per lookup; `.test` is RFC 6761-reserved for local testing and bypasses mDNS. |
| Per-project Caddy (not host-wide) | Matches what aria-v2 does and what's actually running on this Mac (one `caddy run` per project; port 443 is owned by Docker Desktop anyway). |
| Bind `-p 127.0.0.1:4096:4096` (loopback, not 0.0.0.0) | Don't publish the agent's UI to the LAN even on hotel/coffee-shop wifi. Caddy is the only gate to TLS. |

## Manual flow (until automation lands)

One-time host setup:

```bash
# /etc/hosts — once per machine
echo '127.0.0.1 flout.test' | sudo tee -a /etc/hosts

# mkcert CA already trusted (you have it from aria); generate the cert:
mkdir -p ~/.local/share/paf-flout/certs
cd ~/.local/share/paf-flout/certs
mkcert flout.test
# produces flout.test.pem + flout.test-key.pem
```

Per session (start the proxy + the sandbox):

```bash
# 1. Generate a Caddyfile from the template
PAF_FLOUT_DOMAIN=flout.test \
PAF_FLOUT_HTTPS_PORT=4143 \
PAF_FLOUT_BACKEND_PORT=4096 \
PAF_FLOUT_CERT_DIR=~/.local/share/paf-flout/certs \
envsubst < packages/paf-flout/proxy/Caddyfile.template \
  > ~/.config/paf-flout/caddy/sites/flout.test.Caddyfile

# 2. Start Caddy (foreground, leave open in a terminal)
caddy run --config ~/.config/paf-flout/caddy/sites/flout.test.Caddyfile --adapter caddyfile

# 3. In another terminal: start the sandbox + serve opencode
cd ~/development/repos
flout sandbox start --image paf-flout:<hash> --clean --name devbox -- \
  -p 127.0.0.1:4096:4096 \
  -e OPENCODE_SERVER_PASSWORD=$(openssl rand -hex 16)

flout sandbox shell devbox
# inside:
opencode serve --hostname 0.0.0.0 --port 4096

# 4. Browser → https://flout.test:4143 (TLS, paste OPENCODE_SERVER_PASSWORD)
```

## Why deferred (automation not in this PR)

Shipping `proxy:up` / `proxy:down` scripts in this PR was rejected after 3 rounds of consultation with Codex (corroborated by Gemini). Reasons:

1. **Host trust mutation.** `/etc/hosts` edits need sudo; mkcert installs a CA into the system trust store; both are surprising side effects from a "personal sandbox tool." Automation must be explicit, inspectable, and idempotent — and that takes more design surface than fits this PR.
2. **Caddy process ownership.** Per-project Caddy lifecycle on the host has multiple reasonable shapes (foreground tmux session, launchd, brew services). Picking one for everyone before the user feels which fits is premature.
3. **Cannot fully test without interactive setup.** mkcert prompts, `/etc/hosts` sudo, port 443 conflicts — all hard to dry-run from CI or non-interactive scripts.
4. **Scope discipline.** This PR's strength is that `--image`, `--clean`, `--path`, and `packages/paf-flout/` are a coherent, fully-tested, zero-regression unit. Adding host network plumbing dilutes that.

The follow-up PR should ship:

- `proxy:doctor` — checks `/etc/hosts`, mkcert CA, Caddy binary on PATH, port availability — read-only, no mutations
- `proxy:up <domain> <https-port> <backend-port>` — explicit sudo-gated mutations + Caddy launch
- `proxy:down <domain>` — Caddy teardown + cert/site cleanup
- `serve:opencode <sandbox-name> <port>` — `docker exec` helper to start opencode serve inside a container
- (Optional) a small `paf-flout` fish wrapper for ergonomics: `paf-flout up <name> <path>` orchestrates all the above

State to manage: `~/.config/paf-flout/state.json` mapping domain → (sandbox name, ports, generated Caddyfile path, cert path, created-at).

## Related

- aria-v2's working pattern: `~/development/aria-v2/apps/ops-dash/Caddyfile.dev` + `.certs/aria.test.pem` (this template is modeled on it)
- Codex/Gemini consultation transcripts: archived in the PR description for the parent commit
