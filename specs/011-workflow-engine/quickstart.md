# Quickstart: Workflow Engine

## Prerequisites

- CloseClaw onboarded with at least one bot (feature 001)
- AI agent configured (feature 002)
- Gateway has been started at least once
- At least one MCP server configured (recommended, for tool-based steps)

## Step 1: Create a Workflow via Chat

Start the gateway:

```bash
pnpm closeclaw gateway start
```

Send a message to the bot describing a multi-step workflow:

> "Every weekday at 9am, check my open Jira tickets. If any are critical, send me an alert. Otherwise just say all clear."

**Expected**: The bot responds with a workflow definition summary showing:
- Name (auto-generated or user-provided)
- Trigger (cron: `0 9 * * 1-5`)
- Steps (fetch issues → condition → alert or all-clear)
- A confirmation prompt: "Save this workflow?"

Reply "yes" to save it.

**Expected**: The bot confirms the workflow is saved and active.

## Step 2: Verify Workflow Execution

Wait for the next scheduled trigger time (or ask the bot to "run morning-jira-check now").

**Expected**: The bot shows live progress:
- "[Step 1/3: Fetch open Jira issues] Running..."
- "[Step 2/3: Check for critical bugs] Evaluating..."
- "[Step 3/3: Report all clear] Done"
- Final result message with the output

## Step 3: Run a One-Shot Workflow

Send a multi-step ad-hoc request:

> "Check the CI build for project-x, and if it failed, create a Jira ticket with the error details"

**Expected**: The bot executes the steps immediately without saving a workflow definition. Each step runs in sequence with live progress. The result is delivered as a chat message.

Verify it was NOT saved:

> "List my workflows"

**Expected**: The one-shot workflow does not appear in the list.

## Step 4: Create a Workflow via YAML

Send a YAML workflow definition to the bot:

```yaml
name: deploy-check
trigger:
  type: cron
  value: "0 18 * * 1-5"
steps:
  - id: check-deploy
    type: action
    label: Check deployment
    prompt: "Check the latest deployment status"
    onError: stop
  - id: notify
    type: condition
    label: Check if failed
    condition: "Did the deployment fail?"
    thenSteps:
      - id: alert
        type: action
        label: Alert
        prompt: "Create a summary of the deployment failure"
        onError: continue
    elseSteps: []
```

**Expected**: The bot validates the YAML, shows a summary, and asks for confirmation.

## Step 5: Test Approval Workflow

Create a workflow with an approval step:

> "Check CI status, then if it passed, deploy to staging but ask me first"

**Expected**: When the workflow runs and CI passes, the bot pauses and sends an approval prompt with approve/deny buttons. Approve it and verify the deploy step runs.

## Step 6: Manage Workflows

Test management commands:

- "List my workflows" — shows all saved workflows
- "Disable deploy-check" — disables the workflow
- "Enable deploy-check" — re-enables it
- "Show history for morning-jira-check" — shows recent execution history
- "Delete deploy-check" — asks for confirmation then removes it

## Step 7: Run Full Verification Suite

```bash
pnpm test && pnpm test:coverage && pnpm lint && pnpm format:check && pnpm build
```

**Expected**: All tests pass, coverage >=90%, no lint/format issues, build succeeds.
