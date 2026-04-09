import { describe, it, expect } from "vitest";
import {
  createSessionStore,
  type SessionRecord,
  type SessionStatus,
} from "@closeclaw/cursor-agent";

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "test-id",
    cursorChatId: "cursor-chat-1",
    projectDir: "/tmp/project",
    prompt: "fix lint",
    status: "completed" as SessionStatus,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("createSessionStore", () => {
  it("saves and retrieves a session record", () => {
    const store = createSessionStore();
    const record = makeRecord();
    store.save(record);
    const all = store.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("test-id");
  });

  it("finds the most recent record", () => {
    const store = createSessionStore();
    store.save(makeRecord({ id: "old", createdAt: "2026-01-01T00:00:00Z" }));
    store.save(makeRecord({ id: "new", createdAt: "2026-04-09T00:00:00Z" }));
    const recent = store.getMostRecent();
    expect(recent?.id).toBe("new");
  });

  it("returns undefined when no records exist", () => {
    const store = createSessionStore();
    expect(store.getMostRecent()).toBeUndefined();
  });

  it("finds a record by cursor chat id", () => {
    const store = createSessionStore();
    store.save(makeRecord({ id: "a", cursorChatId: "chat-abc" }));
    store.save(makeRecord({ id: "b", cursorChatId: "chat-def" }));
    const found = store.findByCursorChatId("chat-abc");
    expect(found?.id).toBe("a");
  });

  it("prunes records older than max age", () => {
    const store = createSessionStore();
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const fresh = new Date().toISOString();
    store.save(makeRecord({ id: "old-one", createdAt: old }));
    store.save(makeRecord({ id: "fresh-one", createdAt: fresh }));
    store.prune(24 * 60 * 60 * 1000);
    const all = store.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("fresh-one");
  });

  it("serializes to and deserializes from JSON", () => {
    const store = createSessionStore();
    store.save(makeRecord({ id: "persist" }));
    const json = store.toJSON();
    const store2 = createSessionStore();
    store2.loadFromJSON(json);
    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0].id).toBe("persist");
  });

  it("handles loadFromJSON with invalid data", () => {
    const store = createSessionStore();
    store.loadFromJSON("not valid json");
    expect(store.list()).toHaveLength(0);
  });
});
