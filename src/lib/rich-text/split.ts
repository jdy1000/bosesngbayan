const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
const VOID = new Set(["br", "hr", "img", "col", "input", "meta", "link"]);

/**
 * Splits sanitized article HTML right after its `n`-th top-level paragraph, so an ad can sit inside the story. Paragraphs
 * inside quotes, lists or tables are not counted. Returns null when the story has fewer than `n` paragraphs or nothing
 * follows the n-th one (an ad at the very end would just duplicate the one under the story).
 */
export function splitAfterParagraph(html: string, n: number): [string, string] | null {
  let depth = 0;
  let seen = 0;
  for (const m of html.matchAll(TAG)) {
    const closing = m[1] === "/";
    const name = m[2]!.toLowerCase();
    if (VOID.has(name) || m[3] === "/") continue;
    if (closing) {
      depth = Math.max(0, depth - 1);
      if (name === "p" && depth === 0 && ++seen === n) {
        const end = m.index! + m[0].length;
        return html.slice(end).trim() === "" ? null : [html.slice(0, end), html.slice(end)];
      }
    } else {
      depth += 1;
    }
  }
  return null;
}
