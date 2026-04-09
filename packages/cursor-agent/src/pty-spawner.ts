import type { PtyHandle, PtySpawnOptions } from "./types.js";
import { PTY_DEFAULT_COLS, PTY_DEFAULT_ROWS } from "./types.js";

type NativePtySpawnFn = (
  binary: string,
  args: string[],
  options: { cwd: string; cols: number; rows: number; env: NodeJS.ProcessEnv },
) => NativePtyProcess;

interface NativePtyProcess {
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (info: { exitCode: number }) => void): { dispose(): void };
  write(data: string): void;
  kill(): void;
  resize(cols: number, rows: number): void;
}

export function createPtySpawner(
  nativeSpawn: NativePtySpawnFn,
): (options: PtySpawnOptions) => PtyHandle {
  return (options) => {
    const proc = nativeSpawn(options.binary, options.args, {
      cwd: options.cwd,
      cols: options.cols ?? PTY_DEFAULT_COLS,
      rows: options.rows ?? PTY_DEFAULT_ROWS,
      env: (options.env ?? process.env) as NodeJS.ProcessEnv,
    });
    return wrapNativeProcess(proc);
  };
}

function wrapNativeProcess(proc: NativePtyProcess): PtyHandle {
  return {
    onData(cb) {
      proc.onData(cb);
    },
    onExit(cb) {
      proc.onExit(cb);
    },
    write(data) {
      proc.write(data);
    },
    kill() {
      proc.kill();
    },
  };
}
