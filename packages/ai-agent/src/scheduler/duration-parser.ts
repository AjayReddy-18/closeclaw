const DURATION_REGEX = /^(\d+)([smhd])$/;

const MULTIPLIERS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDuration(input: string): number | undefined {
  const match = DURATION_REGEX.exec(input);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (value <= 0) return undefined;
  const unit = match[2];
  return value * MULTIPLIERS[unit];
}

export function formatDuration(ms: number): string {
  if (ms >= 86_400_000 && ms % 86_400_000 === 0) {
    return `${ms / 86_400_000}d`;
  }
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) {
    return `${ms / 3_600_000}h`;
  }
  if (ms >= 60_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  return `${Math.round(ms / 1_000)}s`;
}
