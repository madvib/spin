/**
 * The one scanner every example-HTML reader uses. Quoted runs
 * (`"..."`, `'...'`) and brace runs (`{...}`, nested) are single
 * values wherever they sit — attribute values, spreads, inline
 * expressions — so `show={a - b === 4}` never splits on its spaces
 * and `{...slider.getRootProps()}` never reads as an attribute name.
 * Unclosed runs go to the end of the string: the viewer formats
 * half-written markup rather than failing it.
 */
export function scanRun(html: string, i: number): number {
  const open = html[i];
  if (open === '"' || open === "'") {
    const close = html.indexOf(open, i + 1);
    return close === -1 ? html.length : close + 1;
  }
  if (open === "{") {
    let depth = 0;
    let stop = i;
    while (stop < html.length) {
      if (html[stop] === "{") depth += 1;
      if (html[stop] === "}") {
        depth -= 1;
        if (depth === 0) return stop + 1;
      }
      stop += 1;
    }
    return html.length;
  }
  return i;
}
