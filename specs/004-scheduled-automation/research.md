# Research: Scheduled Automation

## R1: Task Scheduling Library

**Decision**: Use no external scheduling library; implement a lightweight timer-based scheduler using Node.js `setInterval` and `setTimeout`.

**Rationale**: The scheduling needs are simple (fixed intervals, one-shot timers, cron expressions). A cron-expression parser is the only non-trivial piece, and the `cron-parser` npm package (MIT, 4M+ weekly downloads, zero dependencies) handles that. The rest is just timers and a persistent JSON file. Adding a full job queue (Bull, Agenda, node-cron) would violate KISS and YAGNI.

**Alternatives considered**:

- `node-cron`: Full scheduler but couples scheduling logic with execution; harder to test
- `bull` / `bullmq`: Redis-backed job queue; overkill for a single-process CLI tool
- Custom cron parser: Reinventing a well-solved problem

## R2: Cron Expression Parsing

**Decision**: Use `cron-parser` npm package for parsing and computing next-run times from cron expressions.

**Rationale**: Battle-tested, zero-dependency, supports 5-field and 6-field cron expressions, timezone-aware via options. Returns an iterator with `next()` that gives the next occurrence as a Date.

**Alternatives considered**:

- Manual regex parsing: Error-prone for edge cases (day-of-week, month ranges, step values)
- `croner`: Good but less widely adopted; `cron-parser` has stronger community validation

## R3: Task Persistence Pattern

**Decision**: Reuse the atomic-write pattern from `conversation-persistence.ts` (write to `.tmp`, then `renameSync`). Task store at `~/.closeclaw/cron/tasks.json`.

**Rationale**: Proven pattern already in the codebase. JSON file is human-readable, editable, and aligns with the existing config/persistence approach. No database needed for the expected scale (dozens of tasks, not millions).

**Alternatives considered**:

- SQLite: Overkill for small datasets; adds a native dependency
- In-memory only: Tasks lost on restart (violates FR-002)

## R4: Background Execution Model

**Decision**: Run scheduled tasks as async functions within the gateway process using `queueMicrotask` or direct `await` in a serialized task queue. Reuse the existing `enqueueForSender` pattern from `gateway-agent-handler.ts` for serialization.

**Rationale**: The gateway is already a long-running Node.js process. Tasks need access to the AI model and bot adapters, which are already instantiated in the gateway. Spawning child processes would require IPC for model access and adapter communication -- unnecessary complexity. Serialized execution prevents concurrent AI API calls that would hit rate limits.

**Alternatives considered**:

- Worker threads: Would need to share model/adapter state across threads; complex and fragile
- Child processes: Would need IPC for AI provider credentials and bot adapter access; overkill
- Parallel execution: Risks rate-limiting; serialization is simpler and sufficient

## R5: Heartbeat HEARTBEAT_OK Protocol

**Decision**: Follow OpenClaw's protocol: if the AI response starts or ends with `HEARTBEAT_OK`, suppress delivery. Otherwise, deliver the response as an alert.

**Rationale**: Proven convention from OpenClaw. Simple string check. Prevents noisy "all clear" messages from spamming the user every 30 minutes. The AI is instructed via system prompt to use this token.

**Alternatives considered**:

- Structured JSON response: Adds parsing complexity; the AI might not always produce valid JSON
- Separate "alert" vs "ok" tool calls: Over-engineered for a simple binary signal

## R6: Delivery Target Resolution

**Decision**: Deliver task results to the first connected adapter's first approved sender. For heartbeat, use the last sender who messaged the bot. Store the delivery target (platform + senderId) on the task at creation time for cron tasks.

**Rationale**: CloseClaw currently supports single-user scenarios (one person chatting with the bot). The delivery target is straightforward: send it back to the person who set up the task. For heartbeat, the "last contact" pattern matches OpenClaw's default.

**Alternatives considered**:

- Explicit `--to` flag on every task: Good for multi-user but unnecessary for v1
- Webhook delivery: Useful but out of scope; can add later

## R7: Smart Validation Approach

**Decision**: Implement validation through AI tool design -- the `schedule_task` tool includes a `reason` parameter where the AI must justify why scheduling is needed. The tool's description instructs the AI to only schedule tasks that genuinely benefit from delayed or periodic execution.

**Rationale**: The AI model already has judgment capabilities. By making the tool description explicit about when to schedule vs. when to respond immediately, we leverage the model's reasoning without building a separate validation engine. This is the KISS approach.

**Alternatives considered**:

- Rule-based validator (minimum interval checks, keyword blocklists): Brittle, can't handle nuanced requests
- Two-step confirmation: Adds latency to every scheduling request
