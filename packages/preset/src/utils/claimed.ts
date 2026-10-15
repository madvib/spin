/**
 * Which classes a stylesheet CLAIMS, by reading each rule's selector list.
 *
 * "Does a rule claim this class" has three answers in CSS — the class alone,
 * inside a grouped selector list, and before a combinator — and a substring
 * check gets one of them wrong every time, then reports a working utility as
 * broken. Two suites ask this question, so one of them owns the answer or the
 * two will eventually disagree.
 */
export function claimedClasses(css: string): Set<string> {
  const out = new Set<string>();
  for (const rule of css.split("}")) {
    const open = rule.indexOf("{");
    if (open === -1) continue;
    // uno writes the layer marker and the rule into the SAME chunk, so the
    // head begins with a comment — and skipping on that throws away every real
    // rule along with the marker.
    const head = rule.slice(0, open).replace(/\/\*[^*]*\*\//g, "").trim();
    if (head === "" || head.startsWith("@")) continue;
    for (const part of head.split(",")) {
      const first = part.trim().split(/[\s>+~]+/)[0];
      if (first === undefined || first === "") continue;
      // Strip the pseudo so `button:hover` claims `button`.
      const base = first.replace(/:{1,2}[a-z-]+(\(.*\))?/g, "");
      if (base.startsWith(".")) out.add(base);
    }
  }
  return out;
}

/** The escaped class selector for a utility.
 *
 * The escape set is the characters a utility's own grammar can produce:
 * a variant separator (`:`), a fraction slash (`/`), and a dotted step name
 * (`0.5`, `1.5`). An unescaped dot in a selector is a CSS class-name
 * separator, so `.p-0.5` would read as "class p-0 then class 5" — the rule
 * exists and the oracle would call it missing. */
export function selectorFor(utility: string): string {
  return `.${utility.replace(/([.:/])/g, "\\$1")}`;
}

/** Whether a sheet claims this class. */
export function claims(css: string, utility: string): boolean {
  return claimedClasses(css).has(selectorFor(utility));
}
