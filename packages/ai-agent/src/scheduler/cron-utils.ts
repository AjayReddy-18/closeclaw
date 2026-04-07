import { CronExpressionParser } from "cron-parser";

export function isValidCronExpression(expression: string): boolean {
  if (!expression.trim()) return false;
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

export function nextCronOccurrence(
  expression: string,
  from: Date,
  timezone?: string,
): Date | undefined {
  try {
    const options: { currentDate: Date; tz?: string } = { currentDate: from };
    if (timezone) options.tz = timezone;
    const interval = CronExpressionParser.parse(expression, options);
    return interval.next().toDate();
  } catch {
    return undefined;
  }
}
