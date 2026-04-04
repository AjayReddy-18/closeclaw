import { vi } from "vitest";

const instances: GrammyBotInstance[] = [];

export type GrammyBotInstance = {
  token: string;
  api: {
    getMe: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

export function grammyBotInstances(): readonly GrammyBotInstance[] {
  return instances;
}

export function clearGrammyBotInstances(): void {
  instances.length = 0;
}

export class Bot {
  readonly api: GrammyBotInstance["api"];
  readonly start: GrammyBotInstance["start"];
  readonly stop: GrammyBotInstance["stop"];
  readonly on: GrammyBotInstance["on"];

  constructor(public token: string) {
    this.api = { getMe: vi.fn(), sendMessage: vi.fn() };
    this.start = vi.fn();
    this.stop = vi.fn();
    this.on = vi.fn();
    instances.push(this);
  }
}

export type Context = unknown;
