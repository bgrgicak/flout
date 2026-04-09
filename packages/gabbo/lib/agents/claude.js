const fs = require('fs');
const os = require('os');
const path = require('path');

function encodePath(dir) {
  return '-' + path.resolve(dir).split('/').filter(Boolean).join('-');
}

module.exports = {
  name: 'claude',
  binary: 'claude',
  installHint: 'curl -fsSL https://claude.ai/install.sh | bash',

  remoteCommand(sessionName) {
    return `claude remote-control --spawn=session --permission-mode bypassPermissions --name ${sessionName}`;
  },

  startCommand() {
    return 'claude --permission-mode bypassPermissions';
  },

  loginCommand() {
    return 'claude';
  },

  setupTokenCommand() {
    return 'claude setup-token';
  },

  isTrusted(dir) {
    const encoded = encodePath(dir);
    const trustDir = path.join(os.homedir(), '.claude', 'projects', encoded);
    return fs.existsSync(trustDir);
  },

  trustCommand() {
    return 'claude';
  },

  encodePath,
};
