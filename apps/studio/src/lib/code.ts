/**
 * The markup, read for display.
 *
 * The component pages render sourced markup with `innerHTML` — the daemon is
 * the only thing that writes it — so the code view shows the same string a
 * consumer would copy. Two jobs: take the indentation the fixture template
 * left behind off the continuation lines, and split the run into tokens so an
 * element reads differently from the attribute it carries.
 *
 * The split is structural. It asks only which position inside a tag the
 * scanner is in, so a component's vocabulary can change without a list here
 * chasing it.
 */

/** Where a run of characters sits in the markup. */
export type CodeKind = "tag" | "attr" | "value" | "text";

/** One run of characters, and what position it is in. */
export interface CodeToken {
  readonly kind: CodeKind;
  readonly text: string;
}

/**
 * Take the shared leading indentation off every line but the first.
 *
 * A fixture is authored inside a template literal, so its continuation lines
 * carry the indentation of the source file rather than of the markup. The
 * first line is already at column zero.
 */
export function dedent(html: string): string {
  const lines = html.replace(/\r\n/g, "\n").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  if (lines.length < 2) return lines.join("\n");
  const shared = Math.min(
    ...lines.slice(1).map((line) => line.length - line.trimStart().length),
  );
  return [lines[0], ...lines.slice(1).map((line) => line.slice(shared))].join(
    "\n",
  );
}

/**
 * Split markup into runs by position in a tag.
 *
 * An attribute value stays one run however many words it holds, so
 * `class="flex gap-2"` reads as the class list a consumer copies rather than
 * as three fragments.
 */
export function tokenizeHtml(html: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let i = 0;

  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      tokens.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (open > i) tokens.push({ kind: "text", text: html.slice(i, open) });

    const closing = html.startsWith("</", open);
    tokens.push({ kind: "tag", text: closing ? "</" : "<" });
    i = open + (closing ? 2 : 1);

    const nameStart = i;
    while (i < html.length && !/[\s>/]/.test(html[i])) i++;
    if (i > nameStart) {
      tokens.push({ kind: "tag", text: html.slice(nameStart, i) });
    }

    while (i < html.length) {
      if (/\s/.test(html[i])) {
        const gap = i;
        while (i < html.length && /\s/.test(html[i])) i++;
        // Character data, not markup: an attribute's leading space belongs to
        // the run the code view already shows as the gap it is.
        tokens.push({ kind: "text", text: html.slice(gap, i) });
        continue;
      }
      if (html[i] === ">") {
        tokens.push({ kind: "tag", text: ">" });
        i++;
        break;
      }
      if (html[i] === "/") {
        tokens.push({ kind: "tag", text: "/" });
        i++;
        continue;
      }

      const attributeStart = i;
      while (i < html.length && !/[\s=>/]/.test(html[i])) i++;
      tokens.push({ kind: "attr", text: html.slice(attributeStart, i) });
      if (html[i] !== "=") continue;

      // The `=` is part of the value's syntax, so a reader copying the run
      // gets `class="danger"` and not a bare string that will not parse.
      const equals = i;
      i++;
      while (i < html.length && /\s/.test(html[i])) i++;

      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        const stop = close === -1 ? html.length : close + 1;
        tokens.push({ kind: "value", text: html.slice(equals, stop) });
        i = stop;
        continue;
      }
      while (i < html.length && !/[\s>]/.test(html[i])) i++;
      tokens.push({ kind: "value", text: html.slice(equals, i) });
    }
  }

  return tokens;
}
