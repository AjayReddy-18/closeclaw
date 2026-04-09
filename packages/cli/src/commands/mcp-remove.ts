export interface McpRemoveDeps {
  configPath: string;
  removeServer: (configPath: string, name: string) => boolean;
}

export function runMcpRemove(name: string, deps: McpRemoveDeps): void {
  const removed = deps.removeServer(deps.configPath, name);
  if (removed) {
    console.log(`Server "${name}" removed.`);
  } else {
    console.error(`Server "${name}" not found.`);
  }
}
