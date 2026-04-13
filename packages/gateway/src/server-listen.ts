import type { Server } from "node:http";

const LISTEN_PORT_ATTEMPTS = 10;

function isAddrInUse(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

function listenOnce(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onErr = (e: Error) => {
      server.off("error", onErr);
      reject(e);
    };
    server.once("error", onErr);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onErr);
      resolve();
    });
  });
}

export async function listenWithPortFallback(
  server: Server,
  basePort: number,
): Promise<void> {
  for (let i = 0; i < LISTEN_PORT_ATTEMPTS; i++) {
    const port = basePort + i;
    try {
      await listenOnce(server, port);
      const a = server.address();
      if (typeof a === "object" && a !== null && "port" in a) {
        console.log(`Gateway listening on port ${String(a.port)}`);
      }
      return;
    } catch (e) {
      const canRetry = i < LISTEN_PORT_ATTEMPTS - 1;
      if (!isAddrInUse(e) || !canRetry) throw e;
    }
  }
}
