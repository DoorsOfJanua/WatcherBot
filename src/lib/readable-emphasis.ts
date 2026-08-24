// Keep bot replies scannable without turning every sentence into a highlighter.
// Only stable, structural labels are emphasized; code fences and existing
// markdown are left alone.
const LABEL = /^(\s*)(Important|Decision|Next step|Warning|Status|Result|Evidence|Action|Approval|Blocked|Priority|Today|Tomorrow|Current state|What changed|Need from you)(:)/i;

export function addReadableEmphasis(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced || line.includes("**")) return line;
      return line.replace(LABEL, "$1**$2**$3");
    })
    .join("\n");
}
