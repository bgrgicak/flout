#!/usr/bin/env node

const path = require('path');
const sessions = require('../lib/sessions');
const { setup, trust } = require('../lib/setup');
const claude = require('../lib/agents/claude');

const agent = claude;
const args = process.argv.slice(2);
const command = args[0];

function getFlag(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function getPassthroughArgs() {
  const idx = args.indexOf('--');
  if (idx === -1) return [];
  return args.slice(idx + 1);
}

function usage() {
  console.log(`gabbo — manage persistent AI agent sessions

Usage:
  gabbo setup                          Check dependencies, login, create token
  gabbo start <name> [--path <dir>]    Start a local session in tmux
  gabbo remote <name> [--path <dir>]   Start a remote-control session (always-on)
  gabbo stop <name>                    Stop a session
  gabbo join <name>                    Attach to a running session
  gabbo list                           List active sessions
  gabbo status                         Show login and session status
  gabbo restart <name> [--path <dir>]  Restart a remote session
  gabbo trust <dir>                    Trust a project directory
  gabbo docker <cmd> [--name <n>]     Manage Docker containers (start|stop|shell|status)`);
}

switch (command) {
  case 'setup':
    setup(agent);
    break;

  case 'start': {
    const name = args[1];
    if (!name) { console.error('Usage: gabbo start <name> [--path <dir>]'); process.exit(1); }
    const dir = getFlag('--path') || process.cwd();
    sessions.start(name, dir, agent);
    break;
  }

  case 'remote': {
    const name = args[1];
    if (!name) { console.error('Usage: gabbo remote <name> [--path <dir>]'); process.exit(1); }
    const dir = getFlag('--path') || process.cwd();
    sessions.remote(name, dir, agent);
    break;
  }

  case 'stop': {
    const name = args[1];
    if (!name) { console.error('Usage: gabbo stop <name>'); process.exit(1); }
    sessions.stop(name);
    break;
  }

  case 'join': {
    const name = args[1];
    if (!name) { console.error('Usage: gabbo join <name>'); process.exit(1); }
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
    if (!name) { console.error('Usage: gabbo restart <name> [--path <dir>]'); process.exit(1); }
    const dir = getFlag('--path') || process.cwd();
    sessions.restart(name, dir, agent);
    break;
  }

  case 'trust': {
    const dir = args[1] || process.cwd();
    trust(dir, agent);
    break;
  }

  case 'docker': {
    const docker = require('../lib/docker');
    const sub = args[1];
    switch (sub) {
      case 'start': {
        const name = getFlag('--name') || path.basename(process.cwd());
        docker.start({ name, cwd: process.cwd(), extraArgs: getPassthroughArgs() });
        break;
      }
      case 'stop': {
        const name = getFlag('--name') || path.basename(process.cwd());
        docker.stop({ name });
        break;
      }
      case 'shell': {
        const name = getFlag('--name') || path.basename(process.cwd());
        docker.shell({ name });
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
