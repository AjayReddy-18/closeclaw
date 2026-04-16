# Data Model: Workflow Engine

## WorkflowDefinition

The top-level entity representing a saved or ephemeral workflow.

| Field         | Type           | Description                                       |
| ------------- | -------------- | ------------------------------------------------- |
| id            | string         | Unique identifier (UUID prefix, e.g., `a1b2c3d4`) |
| name          | string         | Human-readable name (e.g., `morning-jira-check`)  |
| description   | string         | Optional one-line summary                         |
| ownerPlatform | BotPlatform    | Platform of the workflow creator                  |
| ownerSenderId | string         | Sender ID of the workflow creator                 |
| trigger       | Trigger        | What starts this workflow                         |
| steps         | StepNode[]     | Ordered list of step nodes (the execution graph)  |
| status        | WorkflowStatus | `active`, `disabled`, `draft`                     |
| createdAt     | string         | ISO 8601 timestamp                                |
| updatedAt     | string         | ISO 8601 timestamp                                |
| lastRunAt     | string?        | ISO 8601 timestamp of most recent execution       |
| runCount      | number         | Total number of executions                        |

**WorkflowStatus**: `"active" | "disabled" | "draft"`

## Trigger

The event that starts a workflow execution.

| Field         | Type        | Description                                               |
| ------------- | ----------- | --------------------------------------------------------- |
| type          | TriggerType | `cron`, `webhook`, or `chat_keyword`                      |
| value         | string      | Cron expression, webhook path segment, or keyword pattern |
| timezone      | string?     | IANA timezone for cron triggers                           |
| webhookSecret | string?     | Per-workflow secret for webhook authentication            |

**TriggerType**: `"cron" | "webhook" | "chat_keyword"`

## StepNode

A single node in the workflow execution graph. Supports four node types: `action`, `condition`, `parallel`, and `loop`.

### Action Step

Executes a single action (AI prompt that may use tools).

| Field                  | Type       | Description                                                          |
| ---------------------- | ---------- | -------------------------------------------------------------------- | ----------------------------- |
| id                     | string     | Unique step ID within the workflow                                   |
| type                   | `"action"` | Node type discriminator                                              |
| label                  | string     | Human-readable step name                                             |
| prompt                 | string     | The prompt sent to processMessage. May reference `{{stepId.output}}` |
| onError                | `"stop"    | "continue"`                                                          | Behavior when this step fails |
| requiresApproval       | boolean    | If true, pause for user approval before executing                    |
| approvalPrompt         | string?    | Custom message shown in the approval request                         |
| approvalTimeoutSeconds | number?    | Override default timeout                                             |

### Condition Step

Evaluates a condition and branches.

| Field     | Type          | Description                                                                  |
| --------- | ------------- | ---------------------------------------------------------------------------- |
| id        | string        | Unique step ID                                                               |
| type      | `"condition"` | Node type discriminator                                                      |
| label     | string        | Human-readable name                                                          |
| condition | string        | Natural language condition evaluated by the AI against previous step outputs |
| thenSteps | StepNode[]    | Steps to execute if condition is true                                        |
| elseSteps | StepNode[]    | Steps to execute if condition is false                                       |

### Parallel Step

Executes multiple branches concurrently.

| Field    | Type         | Description                                 |
| -------- | ------------ | ------------------------------------------- |
| id       | string       | Unique step ID                              |
| type     | `"parallel"` | Node type discriminator                     |
| label    | string       | Human-readable name                         |
| branches | StepNode[][] | Array of step sequences to run concurrently |

### Loop Step

Repeats steps until a condition is met or max iterations reached.

| Field          | Type       | Description                     |
| -------------- | ---------- | ------------------------------- |
| id             | string     | Unique step ID                  |
| type           | `"loop"`   | Node type discriminator         |
| label          | string     | Human-readable name             |
| steps          | StepNode[] | Steps to execute each iteration |
| untilCondition | string     | Natural language exit condition |
| maxIterations  | number     | Hard cap on iterations          |
| delaySeconds   | number     | Wait between iterations         |

## ExecutionRecord

A log of a single workflow run.

| Field          | Type                     | Description                                 |
| -------------- | ------------------------ | ------------------------------------------- |
| id             | string                   | Unique execution ID                         |
| workflowId     | string                   | Reference to the workflow definition        |
| workflowName   | string                   | Snapshot of workflow name at execution time |
| triggeredBy    | TriggerType              | What started this run                       |
| triggerPayload | Record<string, unknown>? | Webhook payload or chat message             |
| status         | ExecutionStatus          | Overall outcome                             |
| startedAt      | string                   | ISO 8601                                    |
| completedAt    | string?                  | ISO 8601                                    |
| durationMs     | number?                  | Total execution time                        |
| stepResults    | StepResult[]             | Per-step outcomes in execution order        |
| abortReason    | string?                  | If aborted: user denial, timeout, error     |

**ExecutionStatus**: `"running" | "completed" | "failed" | "aborted" | "interrupted"`

## StepResult

The outcome of a single step within an execution.

| Field            | Type        | Description                             |
| ---------------- | ----------- | --------------------------------------- | ------------ | ------------------------- | ------------ |
| stepId           | string      | Reference to the step in the definition |
| stepLabel        | string      | Human-readable label                    |
| status           | `"success"  | "failed"                                | "skipped"    | "aborted"`                | Step outcome |
| output           | string?     | Response text from processMessage       |
| error            | string?     | Error message if failed                 |
| startedAt        | string      | ISO 8601                                |
| completedAt      | string?     | ISO 8601                                |
| durationMs       | number?     | Step execution time                     |
| approvalDecision | `"approved" | "denied"                                | "timeout"` ? | If step required approval |
| conditionResult  | boolean?    | If this was a condition evaluation      |
| loopIteration    | number?     | Current iteration if inside a loop      |

## StepOutputContext

Runtime map of step outputs available during execution. Not persisted — exists only during a running workflow.

| Field            | Type   | Description                                |
| ---------------- | ------ | ------------------------------------------ |
| [stepId: string] | string | The output text from that step's execution |

Steps reference previous outputs via `{{stepId.output}}` template syntax in their prompts. The workflow runtime interpolates these before passing to `processMessage`.

## Persistence Layout

```
~/.closeclaw/workflows/
├── definitions/
│   ├── a1b2c3d4.json          # WorkflowDefinition (internal)
│   ├── a1b2c3d4.yaml          # WorkflowDefinition (human-readable copy)
│   └── e5f6g7h8.json
│   └── e5f6g7h8.yaml
└── history/
    ├── a1b2c3d4/              # Saved workflow history
    │   ├── run-001.json
    │   └── run-002.json
    ├── e5f6g7h8/
    │   └── run-001.json
    └── _oneshot/               # One-shot workflow history
        ├── run-f1g2h3.json
        └── run-i4j5k6.json
```

Both JSON and YAML files are written for saved workflow definitions. YAML provides a human-readable copy that users can inspect, edit, and version-control. One-shot workflows do not save definitions but DO save execution records under the `_oneshot/` directory.

## State Transitions

### Workflow Lifecycle

```
draft → active → disabled → active (toggle)
                → active    (re-enable)
active → [running execution] → active (execution completes)
```

### Execution Lifecycle

```
running → completed   (all steps succeeded)
running → failed      (a step failed with onError: "stop")
running → aborted     (user denied approval or timeout)
running → interrupted (gateway shutdown during execution)
```

## Relationships

- One **WorkflowDefinition** has one **Trigger**
- One **WorkflowDefinition** has many **StepNode**s (tree structure)
- One **WorkflowDefinition** has many **ExecutionRecord**s
- One **ExecutionRecord** has many **StepResult**s
- **StepOutputContext** is transient, scoped to a single **ExecutionRecord**
