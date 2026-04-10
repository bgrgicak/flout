export interface Agent {
  name: string;
  binary: string;
  installHint?: string;
  remoteCommand(sessionName: string): string;
  startCommand(): string;
  loginCommand(): string;
  setupTokenCommand(): string;
  isAuthenticated(): boolean;
  isTrusted(dir: string): boolean;
  trustCommand(): string;
  encodePath(dir: string): string;
}
