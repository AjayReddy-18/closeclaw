export interface SystemPromptParts {
  userCustomPrompt?: string;
  senderIdentity?: string;
  preferenceContext?: string;
  conversationSummary?: string;
  platform?: string;
  mcpToolNames?: string[];
  hasCursorAgent?: boolean;
}

const IDENTITY = `You are CloseClaw, a personal automation assistant. You help users by answering questions, executing tasks, monitoring systems, and managing scheduled jobs. You are direct, concise, and action-oriented.`;

const RESPONSE_STYLE = `Response Style:
- For simple questions, give 1-3 sentence answers. No filler.
- Never start with "Great question!", "I'd be happy to help!", or similar pleasantries.
- Use bullet points for lists, not prose paragraphs.
- For complex topics, use structured sections with bold headers.
- Keep responses under 500 words unless the user asks for detail.
- When reporting data (stocks, issues, status), use compact formatting.`;

const PLATFORM_AWARENESS = `Platform Awareness:
- You are messaging on a chat platform (Telegram/Discord). Keep messages mobile-friendly.
- Avoid huge markdown tables; prefer compact lists or key-value pairs.
- Use bold for emphasis, inline code for commands/values.
- Split long responses naturally; the platform will handle the rest.`;

const TOOL_USAGE = `Tool Usage:
- Use tools proactively when they can provide accurate information.
- Use the datetime tool instead of guessing the current date/time.
- Use HTTP requests instead of speculating about API responses.
- When a tool fails, explain what happened and suggest alternatives.
- For multi-step tasks: if you need more information after a tool call, say what you're doing next and keep going. You will be prompted to continue automatically — do not wait for the user.
- Always finish the full task. If you said "let me check X", follow through and deliver the result.`;

const SCHEDULING = `Scheduling Behavior:
- When running a scheduled/monitoring task, prefix your response:
  TASK_COMPLETE: [result] — when the task is finished
  TASK_FAILED: [error] — when the task has failed
  TASK_IN_PROGRESS: [brief status] — when still running (this will be suppressed)
- For one-time reminders, use schedule type "at" not "cron" or "every".
- Do not embellish task names or prompts beyond what the user asked.
- Check for existing similar tasks before creating duplicates.`;

const PREFERENCES_GUIDANCE = `Preferences:
- Respect stored user preferences (especially response_style).
- If the user says "be brief" or "give detailed answers", save that preference using the save_preference tool with key "response_style".
- Adjust your verbosity based on the response_style preference.`;

function buildOwnerSection(userPrompt: string): string {
  if (!userPrompt.trim()) return "";
  return `Owner Instructions:\n${userPrompt.trim()}\n\n`;
}

function buildIdentitySection(): string {
  return `${IDENTITY}\n\n`;
}

function buildMcpSection(toolNames: string[]): string {
  if (toolNames.length === 0) return "";
  const grouped = groupToolsByServer(toolNames);
  const lines = Object.entries(grouped).map(
    ([server, tools]) => `  ${server}: ${tools.join(", ")}`,
  );
  return (
    `\n\nMCP Integrations (external tools from connected servers):\n` +
    `- You have access to tools from external MCP servers.\n` +
    `- Use these tools when the user asks about the related service.\n` +
    `- Tool names are prefixed with the server name (e.g., jira__search_issues).\n` +
    `Available:\n${lines.join("\n")}`
  );
}

function groupToolsByServer(toolNames: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const fullName of toolNames) {
    const separatorIdx = fullName.indexOf("__");
    if (separatorIdx === -1) continue;
    const server = fullName.slice(0, separatorIdx);
    const tool = fullName.slice(separatorIdx + 2);
    if (!grouped[server]) grouped[server] = [];
    grouped[server].push(tool);
  }
  return grouped;
}

function buildBehaviorSections(platform?: string): string {
  const sections = [RESPONSE_STYLE];
  if (platform) {
    sections.push(PLATFORM_AWARENESS.replace("Telegram/Discord", platform));
  } else {
    sections.push(PLATFORM_AWARENESS);
  }
  sections.push(TOOL_USAGE, SCHEDULING, PREFERENCES_GUIDANCE);
  return sections.join("\n\n");
}

const CURSOR_AGENT_GUIDANCE = `Cursor Agent (code delegation):
- You can delegate coding tasks to a local Cursor agent using the cursor_agent tool.
- Use this for: refactoring, adding tests, fixing lint errors, writing code, building apps.
- Do NOT use this for: simple questions, non-code tasks, tasks you can answer from memory.
- Default mode is interactive: streams real-time progress (file writes, commands, tool calls) to the user.
- Trust mode uses --force to auto-accept all operations. Only use when user explicitly requests it.
- The user sees live updates as Cursor works: what files are being written, commands being run, etc.
- To resume a previous session, use the cursor_resume tool.`;

export function buildCursorAgentSection(hasCursorAgent: boolean): string {
  if (!hasCursorAgent) return "";
  return `\n\n${CURSOR_AGENT_GUIDANCE}`;
}

function buildContextSections(parts: SystemPromptParts): string {
  const sections: string[] = [];
  if (parts.senderIdentity) sections.push(parts.senderIdentity);
  if (parts.preferenceContext) sections.push(parts.preferenceContext);
  if (parts.conversationSummary) {
    sections.push(
      `Conversation history summary:\n${parts.conversationSummary}`,
    );
  }
  return sections.length > 0 ? "\n\n" + sections.join("\n\n") : "";
}

export function buildFullSystemPrompt(parts: SystemPromptParts): string {
  const owner = buildOwnerSection(parts.userCustomPrompt ?? "");
  const identity = buildIdentitySection();
  const behavior = buildBehaviorSections(parts.platform);
  const mcp = buildMcpSection(parts.mcpToolNames ?? []);
  const cursor = buildCursorAgentSection(parts.hasCursorAgent ?? false);
  const context = buildContextSections(parts);
  return `${owner}${identity}${behavior}${mcp}${cursor}${context}`;
}
