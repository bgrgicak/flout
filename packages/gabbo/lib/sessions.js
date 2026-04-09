const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sessionName(name) {
  return name.toLowerCase();
}

function sessionExists(session) {
  const result = spawnSync('tmux', ['has-session', '-t', `=${session}`]);
  return result.status === 0;
}

function start(name, dir, agent) {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: directory '${resolved}' does not exist`);
    process.exit(1);
  }
  if (!agent.isTrusted(resolved)) {
    console.error(`Directory '${resolved}' is not trusted.`);
    console.error(`Run: gabbo trust ${resolved}`);
    process.exit(1);
  }
  const session = sessionName(name);
  if (sessionExists(session)) {
    console.error(`Session '${name}' already exists.`);
    process.exit(1);
  }
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved,
    agent.startCommand(),
  ]);
  console.log(`Session '${name}' started in ${resolved}`);
}

function remote(name, dir, agent) {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: directory '${resolved}' does not exist`);
    process.exit(1);
  }
  if (!agent.isTrusted(resolved)) {
    console.error(`Directory '${resolved}' is not trusted.`);
    console.error(`Run: gabbo trust ${resolved}`);
    process.exit(1);
  }
  const session = sessionName(name);
  if (sessionExists(session)) {
    console.error(`Session '${name}' already exists.`);
    process.exit(1);
  }
  const cmd = `while true; do ${agent.remoteCommand(name)}; echo "Connection dropped. Restarting in 5s..."; sleep 5; done`;
  execFileSync('tmux', [
    'new-session', '-d', '-s', session, '-c', resolved, cmd,
  ]);
  console.log(`Remote session '${name}' started in ${resolved} (auto-reconnect enabled)`);
}

function stop(name) {
  const session = sessionName(name);
  const result = spawnSync('tmux', ['kill-session', '-t', session]);
  if (result.status === 0) {
    console.log(`Session '${name}' stopped.`);
  } else {
    console.error(`No session named '${session}' found.`);
    process.exit(1);
  }
}

function join(name) {
  const session = sessionName(name);
  const result = spawnSync('tmux', ['attach', '-t', session], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`No session named '${session}' found.`);
    process.exit(1);
  }
}

function list() {
  const result = spawnSync('tmux', ['list-sessions'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.log('No active sessions.');
  }
}

function restart(name, dir, agent) {
  const session = sessionName(name);
  spawnSync('tmux', ['kill-session', '-t', session]);
  remote(name, dir, agent);
}

module.exports = { start, remote, stop, join, list, restart };
