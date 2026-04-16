const YAML_FENCE_PATTERN = /```ya?ml\s*\n([\s\S]*?)```/i;
const BARE_YAML_PATTERN = /^(name:\s*.+\nsteps:\s*\n)/m;

export function extractYamlBlock(text: string): string | undefined {
  const fenced = YAML_FENCE_PATTERN.exec(text);
  if (fenced) return fenced[1].trim();
  if (BARE_YAML_PATTERN.test(text)) return text.trim();
  return undefined;
}
