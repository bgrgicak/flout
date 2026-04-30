export interface Agent {
  name: string;
  binary: string;
  installHint?: string;
  /** Long-running remote-control mode. Omit if the agent has no equivalent. */
  remoteCommand?(sessionName: string): string;
  startCommand(): string;
  loginCommand(): string;
  /** Optional long-lived token setup step run after login. */
  setupTokenCommand?(): string;
  isAuthenticated(): boolean;
  isTrusted(dir: string): boolean;
  trustCommand(): string;
  encodePath(dir: string): string;
}
