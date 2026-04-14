# Webhook API Contract

## Trigger a Workflow

```
POST /webhooks/:workflowId
Authorization: Bearer <webhookSecret>
Content-Type: application/json

{
  "event": "deployment.completed",
  "data": { ... }
}
```

### Success Response

```
200 OK
Content-Type: application/json

{
  "executionId": "abc123",
  "status": "running"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid webhook secret |
| 404 | Workflow not found or disabled |
| 429 | Concurrent execution limit reached |
| 500 | Internal error starting execution |
