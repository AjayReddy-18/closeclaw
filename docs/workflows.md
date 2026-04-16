# Workflow Engine

CloseClaw's Workflow Engine lets you create multi-step automations via natural language chat or hand-written YAML. Workflows support conditional branching, parallel execution, loops with polling, human-in-the-loop approval pauses, and multiple trigger types.

## Creating Workflows

### Via Chat (Natural Language)

Send a message describing what you want automated:

> "Every weekday at 9am, check my open Jira tickets. If any are critical, send me an alert. Otherwise just say all clear."

The bot creates a workflow definition and asks for confirmation. Reply "yes" to save it.

### Via YAML

Send a YAML block to the bot:

```yaml
name: morning-jira-check
trigger:
  type: cron
  value: "0 9 * * 1-5"
  timezone: Asia/Kolkata
steps:
  - id: fetch-issues
    type: action
    label: Fetch open Jira issues
    prompt: "Search for open Jira issues assigned to me"
    onError: stop
  - id: check-critical
    type: condition
    label: Check for critical bugs
    condition: "Are there any critical priority issues?"
    thenSteps:
      - id: alert
        type: action
        label: Alert about critical bugs
        prompt: "Summarize the critical issues from {{fetch-issues.output}}"
        onError: continue
    elseSteps:
      - id: all-clear
        type: action
        label: Report all clear
        prompt: "Say 'All clear — no critical issues.'"
        onError: continue
```

### One-Shot Workflows

For multi-step tasks that should run once without saving:

> "Check the CI build for project-x, and if it failed, create a Jira ticket with the error details"

The bot executes the steps immediately. Execution history is saved but the workflow definition is not persisted.

## Trigger Types

| Type           | Description                                    | Example                      |
| -------------- | ---------------------------------------------- | ---------------------------- |
| `cron`         | Runs on a schedule (cron expression)           | `0 9 * * 1-5` (weekdays 9am) |
| `webhook`      | Triggered by HTTP POST                         | `POST /webhooks/:workflowId` |
| `chat_keyword` | Triggered by a chat message matching a keyword | `deploy-status`              |

## Step Types

### Action Step

Executes a prompt through the AI agent pipeline.

```yaml
- id: fetch-data
  type: action
  label: Fetch data
  prompt: "Get the latest data from the API"
  onError: stop # or "continue"
  requiresApproval: false
```

### Condition Step

Evaluates a natural language condition using AI.

```yaml
- id: check-result
  type: condition
  label: Check result
  condition: "Are there any critical issues?"
  thenSteps: [...]
  elseSteps: [...]
```

### Parallel Step

Runs multiple branches concurrently (max 5).

```yaml
- id: parallel-checks
  type: parallel
  label: Run all checks
  branches:
    - - id: check-a
        type: action
        label: Check A
        prompt: "Check service A"
        onError: continue
    - - id: check-b
        type: action
        label: Check B
        prompt: "Check service B"
        onError: continue
```

### Loop Step

Repeats steps until a condition is met or max iterations reached.

```yaml
- id: poll-deploy
  type: loop
  label: Wait for deployment
  maxIterations: 12
  delaySeconds: 300
  untilCondition: "Is the deployment completed?"
  steps:
    - id: check-status
      type: action
      label: Check status
      prompt: "Check deployment status"
      onError: continue
```

## Output Interpolation

Reference previous step outputs using `{{stepId.output}}`:

```yaml
- id: summarize
  type: action
  label: Summary
  prompt: "Summarize: Jira={{check-jira.output}}, CI={{check-ci.output}}"
  onError: continue
```

## Managing Workflows

Use chat commands:

- **"List my workflows"** — shows all saved workflows
- **"Disable morning-jira-check"** — disables a workflow
- **"Enable morning-jira-check"** — re-enables it
- **"Show history for morning-jira-check"** — recent execution history
- **"Delete morning-jira-check"** — removes the workflow
- **"Run morning-jira-check now"** — manually triggers execution

## Approval Steps

Add `requiresApproval: true` to any action step:

```yaml
- id: deploy
  type: action
  label: Deploy to staging
  prompt: "Deploy the latest build"
  requiresApproval: true
  approvalPrompt: "CI passed. Deploy to staging?"
  onError: stop
```

The bot pauses and sends an approval prompt. Approve or deny to continue or abort.

## Resource Limits

| Limit                    | Value     |
| ------------------------ | --------- |
| Max steps per workflow   | 20        |
| Max parallel branches    | 5         |
| Max loop iterations      | 50        |
| Max concurrent workflows | 3         |
| Default approval timeout | 5 minutes |

## Persistence

Workflow definitions are saved to `~/.closeclaw/workflows/`:

```
~/.closeclaw/workflows/
├── definitions/
│   ├── abc123.json      # Internal format
│   └── abc123.yaml      # Human-readable copy
└── history/
    ├── abc123/           # Execution history per workflow
    │   ├── run-001.json
    │   └── run-002.json
    └── _oneshot/         # One-shot execution history
        └── run-xyz.json
```

## Webhooks

For webhook-triggered workflows, use the generated URL:

```
POST http://localhost:<port>/webhooks/<workflowId>
Authorization: Bearer <webhookSecret>
Content-Type: application/json

{ "key": "value" }
```

The payload is available to workflow steps as trigger context.
