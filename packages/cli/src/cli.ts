import path from 'path';
import claude from '@flout/claude';
import opencode from '@flout/opencode';
import * as docker from '@flout/docker';
import * as sandbox from '@flout/sandbox';
import { normalizeEngine } from '@flout/sandbox';
import * as sessions from './sessions.js';
import { setup, trust } from './setup.js';
import type { Agent } from './types.js';

const AGENTS: Record<string, Agent> = { claude, opencode };
sessions.setKnownAgents(Object.keys(AGENTS));

const args = process.argv.slice(2);
const command = args[0];

function getFlag(flag: string, source: string[] = args): string | null {
  const idx = source.indexOf(flag);
  if (idx === -1 || idx + 1 >= source.length) return null;
  return source[idx + 1];
}

function getPassthroughArgs(): string[] {
  const idx = args.indexOf('--');
  if (idx === -1) return [];
  return args.slice(idx + 1);
}

function firstPositional(source: string[]): string | null {
  for (let i = 0; i < source.length; i++) {
    const a = source[i];
    if (!a.startsWith('-')) return a;
    if (a === '--path' || a === '--engine' || a === '--name') i++; // skip the flag's value
  }
  return null;
}

function lookupAgent(name: string): Agent {
  const a = AGENTS[name];
  if (!a) {
    console.error(`Unknown agent '${name}'. Available: ${Object.keys(AGENTS).join(', ')}`);
    process.exit(1);
  }
  return a;
}

function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

function startInteractive(label: string, dir: string, agent: Agent): void {
  const id = sessions.start(label, dir, agent);
  if (isInteractive()) {
    sessions.join(id);
  } else {
    console.log(`Run 'flout join ${id}' to attach.`);
  }
}

function handleAgent(agent: Agent, subargs: string[]): void {
  // flout <agent> remote [name] [--path <dir>]
  if (subargs[0] === 'remote') {
    const rest = subargs.slice(1);
    const name = firstPositional(rest) || path.basename(process.cwd());
    const dir = getFlag('--path', rest) || process.cwd();
    sessions.remote(name, dir, agent);
    return;
  }
  // flout <agent> [name] [--path <dir>]
  const name = firstPositional(subargs) || path.basename(process.cwd());
  const dir = getFlag('--path', subargs) || process.cwd();
  startInteractive(name, dir, agent);
}

interface ListRow {
  label: string;
  type: string;
  directory: string;
  age: string;
}

function gatherRows(): ListRow[] {
  const rows: ListRow[] = sessions.listRows();
  try {
    rows.push(...sandbox.listRows());
  } catch {
    // No container engine available — that's fine, just skip sandboxes.
  }
  return rows;
}

function printList(rows: ListRow[]): void {
  if (rows.length === 0) {
    console.log('No active sessions.');
    return;
  }
  const headers = ['LABEL', 'TYPE', 'DIRECTORY', 'AGE'];
  const data = rows.map(r => [r.label, r.type, r.directory, r.age]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map(d => d[i].length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => i === cells.length - 1 ? c : c.padEnd(widths[i])).join('  ');
  console.log(fmt(headers));
  for (const row of data) console.log(fmt(row));
}

function showStatus(): void {
  console.log('Agents:');
  for (const [name, a] of Object.entries(AGENTS)) {
    console.log(`  ${name}: ${a.isAuthenticated() ? 'logged in' : 'not logged in'}`);
  }
  console.log('\nSessions:');
  printList(gatherRows());
}

function usage(): void {
  console.log(`flout — manage persistent AI agent sessions

Usage:
  flout claude [name] [--path <dir>]          Start a local Claude session and attach
  flout claude remote [name] [--path <dir>]   Start an always-on Claude session (detached)
  flout opencode [name] [--path <dir>]        Start a local opencode session and attach
  flout join <name|id>                        Re-attach to a running session
  flout list                                  List active sessions and sandboxes
  flout stop <name|id>                        Stop a session
  flout restart <name|id> [--path <dir>]      Restart a remote session
  flout status                                Show login status for each agent and session list
  flout setup [agent]                         Install/check deps and authenticate (default: claude)
  flout trust <dir> [agent]                   Trust a project directory (default: claude)
  flout sandbox <cmd> [<name|id>]             Manage container sandboxes (start|stop|shell|claude|opencode)

Local agent sessions auto-attach when run from a terminal. Detach with Ctrl+B D —
the session keeps running and can be re-attached with 'flout join <name>'.

Session names are optional (defaults to directory basename). When multiple sessions
share a label, use the full ID shown by 'flout list'.`);
}

switch (command) {
  case 'claude':
    handleAgent(claude, args.slice(1));
    break;

  case 'opencode':
    handleAgent(opencode, args.slice(1));
    break;

  case 'setup': {
    const name = (args[1] && !args[1].startsWith('-')) ? args[1] : 'claude';
    setup(lookupAgent(name));
    break;
  }

  case 'trust': {
    const dir = (args[1] && !args[1].startsWith('-')) ? args[1] : process.cwd();
    const name = (args[2] && !args[2].startsWith('-')) ? args[2] : 'claude';
    trust(dir, lookupAgent(name));
    break;
  }

  case 'stop': {
    const name = args[1];
    if (!name) { console.error('Usage: flout stop <name|id>'); process.exit(1); }
    sessions.stop(name);
    break;
  }

  case 'join': {
    const name = args[1];
    if (!name) { console.error('Usage: flout join <name|id>'); process.exit(1); }
    sessions.join(name);
    break;
  }

  case 'list':
    printList(gatherRows());
    break;

  case 'status':
    showStatus();
    break;

  case 'restart': {
    const name = args[1];
    if (!name) { console.error('Usage: flout restart <name|id> [--path <dir>]'); process.exit(1); }
    const dir = getFlag('--path') || process.cwd();
    // Look up the agent encoded in the session id; fall back to claude (the
    // only agent with a remote-control mode today).
    const session = sessions.resolveSession(name);
    const agentName = sessions.getAgentFromSession(session) || 'claude';
    sessions.restart(session, dir, lookupAgent(agentName));
    break;
  }

  case 'start':
  case 'remote':
    console.error(`'flout ${command}' has been replaced.`);
    console.error(`Use 'flout claude${command === 'remote' ? ' remote' : ''} [name]' or 'flout opencode [name]'.`);
    process.exit(1);
    break;

  case 'sandbox': {
    const sub = args[1];
    const rawEngine = getFlag('--engine');
    const engineFlag = rawEngine ? normalizeEngine(rawEngine) : undefined;
    switch (sub) {
      case 'start': {
        const name = getFlag('--name') || path.basename(process.cwd());
        const image = getFlag('--image') || undefined;
        sandbox.start({
          name,
          cwd: process.cwd(),
          extraArgs: getPassthroughArgs(),
          agent: claude,
          engine: engineFlag,
          image,
        });
        break;
      }
      case 'stop': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        sandbox.stop({ name, engine: engineFlag });
        break;
      }
      case 'shell': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        sandbox.shell({ name, engine: engineFlag });
        break;
      }
      case 'claude': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        sandbox.claude({ name, engine: engineFlag });
        break;
      }
      case 'opencode': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        sandbox.opencode({ name, engine: engineFlag });
        break;
      }
      case 'status':
        console.error("'flout sandbox status' has been removed. Use 'flout list' instead.");
        process.exit(1);
        break;
      default:
        sandbox.usage();
        process.exit(sub ? 1 : 0);
    }
    break;
  }

  case 'docker': {
    console.warn("Warning: 'flout docker' is deprecated. Use 'flout sandbox' instead.");
    const sub = args[1];
    switch (sub) {
      case 'start': {
        const name = getFlag('--name') || path.basename(process.cwd());
        docker.start({ name, cwd: process.cwd(), extraArgs: getPassthroughArgs(), agent: claude });
        break;
      }
      case 'stop': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        docker.stop({ name });
        break;
      }
      case 'shell': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        docker.shell({ name });
        break;
      }
      case 'claude': {
        const name = args[2] || getFlag('--name') || path.basename(process.cwd());
        docker.claude({ name });
        break;
      }
      case 'status':
        docker.status();
        break;
      default:
        docker.usage();
        process.exit(sub ? 1 : 0);
    }
    break;
  }

  case '--help':
  case '-h':
  case 'help':
    usage();
    break;

  default:
    usage();
    process.exit(command ? 1 : 0);
}
