const ENV_PATTERN = /\$\{env:([^}]+)\}/g;

export function interpolateEnvVars(value: string): string {
  return value.replace(ENV_PATTERN, (_match, varName: string) => {
    const resolved = process.env[varName];
    if (resolved === undefined) {
      console.warn(`[mcp] Environment variable not set: ${varName}`);
      return "";
    }
    return resolved;
  });
}

export function interpolateRecord(
  record: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = interpolateEnvVars(value);
  }
  return result;
}
