import type { SessionRecord } from "./types.js";

export interface SessionStore {
  save(record: SessionRecord): void;
  list(): SessionRecord[];
  getMostRecent(): SessionRecord | undefined;
  findByCursorChatId(chatId: string): SessionRecord | undefined;
  prune(maxAgeMs: number): void;
  toJSON(): string;
  loadFromJSON(json: string): void;
}

export function createSessionStore(): SessionStore {
  let records: SessionRecord[] = [];

  return {
    save(record) {
      const idx = records.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        records[idx] = record;
      } else {
        records.push(record);
      }
    },

    list() {
      return [...records];
    },

    getMostRecent() {
      if (records.length === 0) return undefined;
      return records.reduce((latest, r) =>
        r.createdAt > latest.createdAt ? r : latest,
      );
    },

    findByCursorChatId(chatId) {
      return records.find((r) => r.cursorChatId === chatId);
    },

    prune(maxAgeMs) {
      const cutoff = Date.now() - maxAgeMs;
      records = records.filter((r) => new Date(r.createdAt).getTime() > cutoff);
    },

    toJSON() {
      return JSON.stringify(records);
    },

    loadFromJSON(json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          records = parsed as SessionRecord[];
        }
      } catch {
        records = [];
      }
    },
  };
}
