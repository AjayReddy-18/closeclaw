# Research: Interactive PTY Mode

## R1: PTY Library for Node.js

**Decision**: Use `node-pty` v1.1.0+ (Microsoft/Tyriar)

**Rationale**:

- Production-proven: powers VS Code's integrated terminal, Hyper, and Theia
- Cross-platform (macOS, Linux, Windows) with native ConPTY on Windows
- Simple API: `spawn()` returns a handle with `onData`, `write`, `kill`, `resize`
- Active maintenance: latest release v1.2.0-beta.12 (March 2026)
- Types included: `@types/node-pty` not needed, types ship with package

**Alternatives considered**:

- `child_process.spawn` with `shell: true` — no real PTY, no interactive prompt support
- `tmux` screen scraping — tried previously, produced garbled terminal fragments
- `expect`/`node-expect` — overly complex for simple read/write pattern

**API shape**:

```typescript
import * as pty from "node-pty";
const proc = pty.spawn(binary, args, { cwd, env, cols: 120, rows: 40 });
proc.onData((data: string) => {
  /* terminal output */
});
proc.write("Y\r"); // send keystroke + enter
proc.kill(); // SIGTERM
proc.onExit(({ exitCode }) => {
  /* done */
});
```

## R2: Cursor CLI Interactive Behavior (without --print)

**Decision**: Spawn `cursor-agent` without `--print` and without `--force` for interactive mode

**Findings from CLI help**:

- `--print` enables headless mode with structured output — but disables interactive prompts
- Without `--print`, Cursor runs in interactive terminal mode with real Accept/Deny prompts
- `--trust` skips the initial workspace trust prompt (available in headless mode only)
- Without `--force`, Cursor's default `permissionMode` is "default" — it asks before risky actions
- `--workspace <path>` sets the working directory

**Prompt patterns observed**:

- Workspace trust: "Do you trust the contents of this directory?" with "Run 'agent' interactively"
- Per-action prompts: Accept/Deny format (need to verify exact patterns via PTY test)
- The interactive mode renders with ANSI colors and cursor positioning

**Key insight**: In interactive mode (no `--print`), `--trust` is noted as "only works with --print/headless mode". So for PTY, we may need to handle the workspace trust prompt too. Alternative: always run from the project directory so workspace trust is implicit, or auto-accept the first trust prompt.

## R3: ANSI Escape Code Stripping

**Decision**: Use a lightweight regex-based ANSI stripper

**Rationale**:

- Terminal output contains color codes (e.g., `\x1b[32m`), cursor movement, line clears
- A simple regex `\x1b\[[0-9;]*[a-zA-Z]` handles 95% of cases
- No need for a full terminal emulator — we just need readable text
- Can add `strip-ansi` npm package if regex proves insufficient

**Pattern**:

```typescript
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "");
}
```

## R4: Permission Prompt Detection Strategy

**Decision**: Multi-pattern regex matching on stripped output lines

**Findings**:

- Cursor CLI permission prompts follow predictable patterns
- Patterns include: "Accept Deny", "(Y/n)", "Allow", "Do you want to proceed?"
- The existing `permission-detector.ts` patterns are a good starting point
- Need to add workspace trust detection: "Do you trust the contents of this directory?"

**Additional patterns to add**:

- "Workspace Trust Required"
- Cursor-specific: tool approval prompts that show before file edits or shell commands
- The prompt typically appears on the last non-empty line of recent output

## R5: node-pty as Native Dependency

**Decision**: Accept native dependency, document in prerequisites

**Rationale**:

- node-pty requires native compilation (uses node-gyp or prebuild)
- On macOS: requires Xcode Command Line Tools (most dev machines have this)
- Prebuilt binaries are available for common platforms via prebuild-install
- The trade-off (native dep complexity) is justified by the massive UX improvement

**Installation considerations**:

- Add to `packages/cursor-agent/package.json` as an optional dependency
- If node-pty fails to install, fall back to trust mode (existing --force --print pipeline)
- Log a clear message: "[cursor] node-pty not available — interactive mode disabled"
