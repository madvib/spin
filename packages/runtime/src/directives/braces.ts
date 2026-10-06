export function matchBrace(source: string, start: number, end: number): number {
  let depth = 0;
  let j = start;
  while (j < end) {
    const c = source[j]!;
    if (c === '"' || c === "'" || c === "`") {
      j = skipQuoted(source, j, end);
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return end;
}

function skipQuoted(source: string, i: number, end: number): number {
  const q = source[i]!;
  let j = i + 1;
  while (j < end) {
    if (source[j] === "\\") {
      j += 2;
      continue;
    }
    if (source[j] === q) return j + 1;
    j++;
  }
  return end;
}
