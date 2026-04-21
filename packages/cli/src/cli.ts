import path from 'path';
import claude from '@flout/claude';
import * as docker from '@flout/docker';
import * as sandbox from '@flout/sandbox';
import { normalizeEngine } from '@flout/sandbox';
import * as sessions from './sessions.js';
import { setup, trust } from './setup.js';
import type { Agent } from './types.js';

const agent: Agent = claude;
const args = process.argv.slice(2);
const command = args[0];

function getFlag(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function getPassthroughArgs(): string[] {
  const idx = args.indexOf('--');
  if (idx === -1) return [];
  return args.slice(idx + 1);
}

function getNameArg(): string | null {
  const arg = args[1];
  if (!arg || arg.startsWith('-')) return null;
  return arg;
}

function usage(): void {
  console.log(`flout — manage persistent AI agent sessions

Usage:
  flout setup                          Check dependencies, login, create token
  flout start [name] [--path <dir>]    Start a local session in tmux (sudo for sandbox)
  flout remote [name] [--path <dir>]   Start a remote-control session (always-on)
  flout stop <name|id>                 Stop a session
  flout join <name|id>                 Attach to a running session
  flout list                           List active sessions
  flout status                         Show login and session status
  flout restart <name|id> [--path <dir>]  Restart a remote session
  flout trust <dir>                    Trust a project directory
  flout sandbox <cmd> [<name|id>]      Manage container sandboxes (start|stop|shell|claude|status)

Session names are optional for start/remote (defaults to directory basename).
When multiple sessions share a name, use the full ID shown by flout list.`);
}

switch (command) {
  case 'setup':
    setup(agent);
    break;

  case 'start': {
    const name = getNameArg() || path.basename(process.cwd());
    const dir = getFlag('--path') || process.cwd();
    sessions.start(name, dir, agent);
    break;
  }

  case 'remote': {
    const name = getNameArg() || path.basename(process.cwd());
    const dir = getFlag('--path') || process.cwd();
    sessions.remote(name, dir, agent);
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
    sessions.list();
    break;

  case 'status':
    sessions.status(agent);
    break;

  case 'restart': {
    const name = args[1];
    if (!name) { console.error('Usage: flout restart <name|id> [--path <dir>]'); process.exit(1); }
    const dir = getFlag('--path') || process.cwd();
    sessions.restart(name, dir, agent);
    break;
  }

  case 'trust': {
    const dir = args[1] || process.cwd();
    trust(dir, agent);
    break;
  }

  case 'sandbox': {
    const sub = args[1];
    const rawEngine = getFlag('--engine');
    const engineFlag = rawEngine ? normalizeEngine(rawEngine) : undefined;
    switch (sub) {
      case 'start': {
        const name = getFlag('--name') || path.basename(process.cwd());
        sandbox.start({
          name,
          cwd: process.cwd(),
          extraArgs: getPassthroughArgs(),
          agent,
          engine: engineFlag,
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
      case 'status':
        sandbox.status(engineFlag);
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
        docker.start({ name, cwd: process.cwd(), extraArgs: getPassthroughArgs(), agent });
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
