# Quickstart: Scheduled Automation

## Prerequisites

- CloseClaw configured with a bot and AI agent (`closeclaw onboard` + `closeclaw agent configure`)
- Gateway running (`closeclaw gateway start`)

## 1. Enable Heartbeat

Configure periodic AI check-ins:

```bash
closeclaw heartbeat configure
```

The wizard prompts for:

- Interval (default: 30m)
- Active hours (optional, e.g., 09:00-22:00)
- Delivery target ("last" = last sender, "none" = silent)

Create a heartbeat checklist at `~/.closeclaw/HEARTBEAT.md`:

```markdown
# Heartbeat checklist

- Check for urgent unread messages in Jira
- If a task is overdue, alert the user
- If nothing needs attention, reply HEARTBEAT_OK
```

The bot will read this file every heartbeat interval and alert you only when something needs attention.

## 2. Create a One-Shot Task

Schedule a reminder from the CLI:

```bash
closeclaw cron add \
  --name "Email reminder" \
  --at "30m" \
  --message "Check your inbox for the client reply"
```

Or ask the bot via chat:

> "Remind me to check the deployment status in 1 hour"

The bot creates the task and delivers the result to your chat when it fires.

## 3. Create a Recurring Task

Daily morning briefing:

```bash
closeclaw cron add \
  --name "Morning brief" \
  --cron "0 9 * * *" \
  --tz "America/New_York" \
  --message "Summarize my open Jira issues and any PRs that need review"
```

Fixed interval check:

```bash
closeclaw cron add \
  --name "CI monitor" \
  --every "2h" \
  --message "Check if any CI builds have failed in the last 2 hours"
```

## 4. Manage Tasks

```bash
# List all tasks
closeclaw cron list

# View run history for a task
closeclaw cron runs <task-id>

# Force-run a task immediately
closeclaw cron run <task-id>

# Remove a task
closeclaw cron remove <task-id>
```

## 5. View Heartbeat Status

```bash
closeclaw heartbeat status
```

Shows: enabled/disabled, interval, active hours, next scheduled run, and last run result.
