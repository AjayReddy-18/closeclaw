import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createSessionStore } from "@closeclaw/cursor-agent";

const TEMP_FILE = join(tmpdir(), "closeclaw-cursor-sessions.json");

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width);
}

function formatRow(
  id: string,
  prompt: string,
  status: string,
  created: string,
): string {
  return `${pad(id, 12)}${pad(prompt, 30)}${pad(status, 14)}${created}`;
}

export function runCursorSessions(): void {
  const store = createSessionStore();
  if (existsSync(TEMP_FILE)) {
    const raw = readFileSync(TEMP_FILE, "utf-8");
    store.loadFromJSON(raw);
  }
  const sessions = store.list();
  if (sessions.length === 0) {
    console.log("No Cursor sessions found.");
    return;
  }
  console.log(formatRow("ID", "Prompt", "Status", "Created"));
  console.log("-".repeat(70));
  for (const s of sessions) {
    const shortPrompt = s.prompt.length > 28 ? s.prompt.slice(0, 28) : s.prompt;
    const date = new Date(s.createdAt).toLocaleString();
    console.log(formatRow(s.id.slice(0, 10), shortPrompt, s.status, date));
  }
  console.log(`\n${String(sessions.length)} session(s) total.`);
}
