const FILE_OP_PATTERNS = [
  {
    pattern: /(?:creat(?:ed?|ing)|writ(?:ing|ten)|wrote)\s+(.+\.\w+)/i,
    op: "created",
  },
  {
    pattern:
      /(?:modif(?:ied|ying)|edit(?:ed|ing)|updat(?:ed|ing))\s+(.+\.\w+)/i,
    op: "modified",
  },
  {
    pattern: /(?:delet(?:ed|ing)|remov(?:ed|ing))\s+(.+\.\w+)/i,
    op: "deleted",
  },
];

const COMMAND_PATTERN =
  /(?:running|ran|executing|executed)\s+[`"]?(.+?)[`"]?\s*$/i;

interface SummaryData {
  fileOps: { file: string; operation: string }[];
  commands: string[];
  errors: string[];
}

function extractFileOps(
  line: string,
): { file: string; operation: string } | null {
  for (const { pattern, op } of FILE_OP_PATTERNS) {
    const match = pattern.exec(line);
    if (match) return { file: match[1].trim(), operation: op };
  }
  return null;
}

function extractCommand(line: string): string | null {
  const match = COMMAND_PATTERN.exec(line);
  return match ? match[1].trim() : null;
}

function isErrorLine(line: string): boolean {
  return (
    /\berror\b/i.test(line) && !/\berrors?\s*(fixed|resolved)\b/i.test(line)
  );
}

function collectSummaryData(outputLog: string[]): SummaryData {
  const data: SummaryData = { fileOps: [], commands: [], errors: [] };
  const seenFiles = new Set<string>();
  for (const line of outputLog) {
    const fileOp = extractFileOps(line);
    if (fileOp && !seenFiles.has(fileOp.file)) {
      seenFiles.add(fileOp.file);
      data.fileOps.push(fileOp);
    }
    const cmd = extractCommand(line);
    if (cmd && !data.commands.includes(cmd)) data.commands.push(cmd);
    if (isErrorLine(line)) data.errors.push(line.trim());
  }
  return data;
}

function formatFileOps(ops: { file: string; operation: string }[]): string {
  if (ops.length === 0) return "";
  const lines = ops.slice(0, 15).map((o) => `  ${o.operation}: ${o.file}`);
  const suffix =
    ops.length > 15 ? `\n  ...and ${String(ops.length - 15)} more` : "";
  return `Files:\n${lines.join("\n")}${suffix}`;
}

function formatCommands(commands: string[]): string {
  if (commands.length === 0) return "";
  return `Commands: ${commands.slice(0, 5).join(", ")}`;
}

export function buildStructuredSummary(
  outputLog: string[],
  status: string,
  permStats: { requested: number; accepted: number; denied: number },
): string {
  const data = collectSummaryData(outputLog);
  const parts: string[] = [];
  parts.push(`Status: ${status}`);
  const fileSection = formatFileOps(data.fileOps);
  if (fileSection) parts.push(fileSection);
  const cmdSection = formatCommands(data.commands);
  if (cmdSection) parts.push(cmdSection);
  if (permStats.requested > 0) {
    parts.push(
      `Permissions: ${String(permStats.accepted)} accepted, ${String(permStats.denied)} denied of ${String(permStats.requested)}`,
    );
  }
  if (data.errors.length > 0) {
    parts.push(`Errors: ${String(data.errors.length)}`);
  }
  if (parts.length === 1) {
    const meaningful = outputLog.filter((l) => l.trim().length > 0);
    const lastLine = meaningful[meaningful.length - 1] ?? "No output";
    return `${status}: ${lastLine.length > 300 ? lastLine.slice(0, 300) + "..." : lastLine}`;
  }
  return parts.join("\n");
}
