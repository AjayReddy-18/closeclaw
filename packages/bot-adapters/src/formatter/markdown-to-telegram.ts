export interface FormatterResult {
  text: string;
  parseMode: "HTML" | undefined;
}

const PLACEHOLDER_PREFIX = "\x00CB";
let placeholderIndex = 0;
const placeholders = new Map<string, string>();

function storePlaceholder(content: string): string {
  const key = `${PLACEHOLDER_PREFIX}${placeholderIndex++}\x00`;
  placeholders.set(key, content);
  return key;
}

function restorePlaceholders(text: string): string {
  let result = text;
  for (const [key, value] of placeholders) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function protectCodeBlocks(text: string): string {
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtml(code.replace(/\n$/, ""));
    const inner = lang
      ? `<code class="language-${lang}">${escaped}</code>`
      : escaped;
    return storePlaceholder(`<pre>${inner}</pre>`);
  });
}

function protectInlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, (_m, code) => {
    return storePlaceholder(`<code>${escapeHtml(code)}</code>`);
  });
}

function convertHeaders(text: string): string {
  return text.replace(/^#{1,6}\s+(.+)$/gm, (_m, heading) => {
    return `<b>${heading.trim()}</b>`;
  });
}

function convertBlockquotes(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inQuote = false;
  const quoteLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("> ")) {
      inQuote = true;
      quoteLines.push(line.slice(2));
    } else {
      if (inQuote) {
        result.push(`<blockquote>${quoteLines.join("\n")}</blockquote>`);
        quoteLines.length = 0;
        inQuote = false;
      }
      result.push(line);
    }
  }
  if (inQuote) {
    result.push(`<blockquote>${quoteLines.join("\n")}</blockquote>`);
  }
  return result.join("\n");
}

function convertTable(text: string): string {
  return text.replace(
    /(?:^(?:\|.+\|)\n(?:\|[-: |]+\|)\n(?:\|.+\|(?:\n|$))+)/gm,
    (tableBlock) => {
      const rows = tableBlock.trim().split("\n");
      const dataRows = rows.filter((r) => !/^\|[-: |]+\|$/.test(r));
      return dataRows
        .map((row) =>
          row
            .split("|")
            .filter((c) => c.trim() !== "")
            .map((c) => c.trim())
            .join("  |  "),
        )
        .join("\n");
    },
  );
}

function convertHorizontalRules(text: string): string {
  return text.replace(/^---+$/gm, "———");
}

function convertLists(text: string): string {
  return text.replace(/^(\s*)[-*]\s+/gm, "$1• ");
}

function convertBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function convertItalic(text: string): string {
  return text.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>");
}

function convertItalicAsterisks(text: string): string {
  return text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");
}

function convertStrikethrough(text: string): string {
  return text.replace(/~~(.+?)~~/g, "<s>$1</s>");
}

function convertLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeRemainingHtml(text: string): string {
  return text.replace(/[<>&]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    return "&gt;";
  });
}

function applyInlineFormatting(text: string): string {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      if (line.startsWith(PLACEHOLDER_PREFIX) || line.startsWith("<")) {
        return line;
      }
      let l = convertBold(line);
      l = convertItalicAsterisks(l);
      l = convertItalic(l);
      l = convertStrikethrough(l);
      l = convertLinks(l);
      return l;
    })
    .join("\n");
}

function isHtmlTag(part: string): boolean {
  return /^<\/?[a-z][a-z0-9]*[\s>]/i.test(part) || /^<\/?[a-z]+>$/i.test(part);
}

function escapeNonTagContent(text: string): string {
  const parts = text.split(/(<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>)/i);
  return parts
    .map((part) => {
      if (isHtmlTag(part)) return part;
      if (part.includes(PLACEHOLDER_PREFIX)) return part;
      return escapeRemainingHtml(part);
    })
    .join("");
}

export function formatForTelegram(markdown: string): FormatterResult {
  if (!markdown.trim()) {
    return { text: markdown, parseMode: undefined };
  }

  placeholders.clear();
  placeholderIndex = 0;

  let text = protectCodeBlocks(markdown);
  text = protectInlineCode(text);
  text = convertHeaders(text);
  text = convertBlockquotes(text);
  text = convertTable(text);
  text = convertHorizontalRules(text);
  text = convertLists(text);
  text = applyInlineFormatting(text);
  text = escapeNonTagContent(text);
  text = restorePlaceholders(text);

  return { text, parseMode: "HTML" };
}
