export type ShellExec = (...args: string[]) => Promise<string>;

export interface TmuxController {
  createSession(name: string, cwd: string): Promise<void>;
  sendKeys(name: string, keys: string): Promise<void>;
  capturePane(name: string, lines: number): Promise<string>;
  killSession(name: string): Promise<void>;
  sessionExists(name: string): Promise<boolean>;
}

export function createTmuxController(exec: ShellExec): TmuxController {
  return {
    async createSession(name, cwd) {
      await exec("tmux", "new-session", "-d", "-s", name, "-c", cwd);
    },

    async sendKeys(name, keys) {
      await exec("tmux", "send-keys", "-t", name, keys, "");
    },

    async capturePane(name, lines) {
      return exec(
        "tmux",
        "capture-pane",
        "-t",
        name,
        "-p",
        "-S",
        String(-lines),
      );
    },

    async killSession(name) {
      await exec("tmux", "kill-session", "-t", name);
    },

    async sessionExists(name) {
      try {
        await exec("tmux", "has-session", "-t", name);
        return true;
      } catch {
        return false;
      }
    },
  };
}
