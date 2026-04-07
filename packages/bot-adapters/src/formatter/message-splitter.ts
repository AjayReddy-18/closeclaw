import type { FormatterResult } from "./markdown-to-telegram.js";

export interface MessageChunk {
  text: string;
  parseMode: "HTML" | undefined;
}

const TELEGRAM_MAX_LENGTH = 4096;

function findOpenTags(text: string): string[] {
  const openPattern = /<(b|i|s|u|a|code|pre|blockquote|strong|em)(?:\s[^>]*)?>/gi;
  const closePattern = /<\/(b|i|s|u|a|code|pre|blockquote|strong|em)>/gi;
  const stack: string[] = [];
  for (const match of text.matchAll(openPattern)) {
    stack.push(match[1].toLowerCase());
  }
  for (const match of text.matchAll(closePattern)) {
    const tag = match[1].toLowerCase();
    const idx = stack.lastIndexOf(tag);
    if (idx !== -1) stack.splice(idx, 1);
  }
  return stack;
}

function closeOpenTags(tags: string[]): string {
  return [...tags].reverse().map((t) => `</${t}>`).join("");
}

function reopenTags(tags: string[]): string {
  return tags.map((t) => `<${t}>`).join("");
}

function splitAtBoundary(
  text: string,
  maxLen: number,
  delimiter: string,
): string[] {
  const segments = text.split(delimiter);
  const chunks: string[] = [];
  let current = "";
  for (const seg of segments) {
    const candidate = current ? current + delimiter + seg : seg;
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = seg;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}

function splitSingleChunk(
  text: string,
  maxLen: number,
): string[] {
  if (text.length <= maxLen) return [text];
  const byLine = splitAtBoundary(text, maxLen, "\n");
  const result: string[] = [];
  for (const chunk of byLine) {
    if (chunk.length <= maxLen) {
      result.push(chunk);
    } else {
      result.push(...hardSplit(chunk, maxLen));
    }
  }
  return result;
}

function repairTagsAcrossChunks(
  rawChunks: string[],
  parseMode: "HTML" | undefined,
): MessageChunk[] {
  if (!parseMode) {
    return rawChunks.map((text) => ({ text, parseMode }));
  }
  const result: MessageChunk[] = [];
  let carryTags: string[] = [];
  for (const chunk of rawChunks) {
    const withReopen = carryTags.length > 0
      ? reopenTags(carryTags) + chunk
      : chunk;
    const openTags = findOpenTags(withReopen);
    const closedText = openTags.length > 0
      ? withReopen + closeOpenTags(openTags)
      : withReopen;
    result.push({ text: closedText, parseMode });
    carryTags = openTags;
  }
  return result;
}

export function splitMessage(
  formatted: FormatterResult,
  maxLength: number = TELEGRAM_MAX_LENGTH,
): MessageChunk[] {
  if (!formatted.text.trim()) {
    return [{ text: formatted.text, parseMode: formatted.parseMode }];
  }
  if (formatted.text.length <= maxLength) {
    return [{ text: formatted.text, parseMode: formatted.parseMode }];
  }
  const paragraphChunks = splitAtBoundary(
    formatted.text,
    maxLength,
    "\n\n",
  );
  const allChunks: string[] = [];
  for (const para of paragraphChunks) {
    if (para.length <= maxLength) {
      allChunks.push(para);
    } else {
      allChunks.push(...splitSingleChunk(para, maxLength));
    }
  }
  return repairTagsAcrossChunks(allChunks, formatted.parseMode);
}
