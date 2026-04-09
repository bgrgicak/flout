#!/usr/bin/env node

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

function usage() {
  console.log(`gabbo — manage persistent AI agent sessions

Usage:
  gabbo setup                          Check dependencies, login, create token
  gabbo start <name> [--path <dir>]    Start a local session in tmux
  gabbo remote <name> [--path <dir>]   Start a remote-control session (always-on)
  gabbo stop <name>                    Stop a session
  gabbo join <name>                    Attach to a running session
  gabbo list                           List active sessions
  gabbo restart <name> [--path <dir>]  Restart a remote session
  gabbo trust <dir>                    Trust a project directory`);
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

  case '--help':
  case '-h':
  case 'help':
    usage();
    break;

  default:
    usage();
    process.exit(command ? 1 : 0);
}
