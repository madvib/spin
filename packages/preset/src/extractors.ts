import type { Extractor } from "@unocss/core";

/**
 * The classes a markup's class attribute names.
 *
 * A class attribute may hold a LIST: the classes themselves as a string,
 * and the conditions as an object — `class={["mb-4 text-sm", { "text-primary":
 * focused }]}`. The strings are plain text and uno's own extractor reads
 * them; the object's KEYS are utilities, and uno's extractor reads the
 * attribute's VALUE (an object literal, not a class list) and finds
 * nothing there — a utility nobody extracts has no rule and cannot
 * apply.
 *
 * This extractor reads the keys out of the object form, so the utilities
 * in it are the build's to generate — the same reason the element and
 * type extractors ship.
 */
export const classObjectExtractor: Extractor = {
  name: "spin/class-object",
  order: 0,
  extract({ code }) {
    const out: string[] = [];
    for (const body of classAttributes(code)) {
      for (const name of objectKeysOf(body)) {
        for (const token of name.split(/\s+/)) {
          if (token.length > 0) out.push(token);
        }
      }
    }
    return out;
  },
};

/** The value of every class attribute, braces balanced: a class
 * attribute's value may hold an object, which has braces of its own. */
function classAttributes(code: string): string[] {
  const out: string[] = [];
  const pattern = /class=\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const open = match.index + match[0].length;
    let depth = 1;
    let i = open;
    for (; i < code.length; i++) {
      const ch = code[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    out.push(code.slice(open, i));
    pattern.lastIndex = i;
  }
  return out;
}

/** The keys of the objects in a class attribute's value: the classes the
 * conditions guard. A string in a VALUE is not a class — a ternary's
 * arms are values — so only the keys count. */
function objectKeysOf(body: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] !== "{") {
      i++;
      continue;
    }
    // The object literal's own extent.
    let depth = 0;
    let j = i;
    for (; j < body.length; j++) {
      if (body[j] === "{") depth++;
      else if (body[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;
    for (const entry of splitEntries(body.slice(i + 1, j))) {
      const colon = entry.indexOf(":");
      if (colon < 0) continue;
      const key = entry.slice(0, colon).trim();
      const name = /^"([^"]*)"$|^'([^']*)'$/.exec(key);
      if (name !== null) out.push(name[1] ?? name[2] ?? "");
    }
    i = j + 1;
  }
  return out.filter((name) => name.length > 0);
}

/** The entries of an object literal, at its top level. */
function splitEntries(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if ((ch === "," && depth === 0) || i === body.length) {
      const entry = body.slice(start, i).trim();
      if (entry.length > 0) out.push(entry);
      start = i + 1;
    }
  }
  return out;
}

/**
 * Element names as tokens.
 *
 * uno's default extractor reads class attributes, so a classless primitive
 * like `<button>` produces no token and no rule can style it. This extractor
 * turns every element name in the markup into a token, so `<button>` becomes
 * `button` and matches the button's base rule.
 *
 * It ships with the preset rather than being opt-in because a classless
 * primitive is the point: `<button>` must work with no class at all. It only
 * matches the `<tag` form, so it never collides with class extraction — a
 * page using only classes extracts exactly what it did before, and a token
 * the element extractor adds that no rule matches is simply ignored. uno
 * deduplicates the tokens an extractor returns, so duplicates here are free.
 */
export const elementExtractor: Extractor = {
  name: "spin/element",
  order: 0,
  extract({ code }) {
    return [...code.matchAll(/<([a-z][a-z0-9-]*)[\s/>]/g)]
      .map((match) => match[1] as string);
  },
};

/**
 * `type="…"` values as tokens.
 *
 * The element extractor turns `<input type="checkbox">` into `input`, and the
 * default extractor turns the attribute into `checkbox` — but NOT
 * `type="radio"`, which it consumes for its own purposes and never emits. So a
 * radio rule has no token to match and cannot fire, however it is written.
 * Measured: `type='checkbox'` yields `checkbox`; `type='radio'` yields nothing
 * at all, and neither does a bare `radio` class or a `<radio>` tag.
 *
 * Extracting it here is what makes `<input type="radio">` and `<radio>` the
 * same thing to the generator. It ships with the preset for the same reason
 * the element extractor does — a classless primitive is the point, and a radio
 * that only works if you remember a class is not classless.
 */
export const typeExtractor: Extractor = {
  name: "spin/type",
  order: 0,
  extract({ code }) {
    return [...code.matchAll(/type=["']([a-z]+)["']/g)]
      .map((match) => match[1] as string);
  },
};

/**
 * `variant="…"` values as tokens, paired with their element.
 *
 * The element extractor turns `<badge variant="primary">` into `badge`, but
 * the variant value itself is invisible — no rule can key on it. This
 * extractor pairs each `variant` value with its element, emitting both the
 * compound `badge-primary` and the bare `primary`.
 *
 * The bare form hits rules that already key on bare values — button's
 * `s-sm`/`s-lg` sizes, the `tone-*` utilities — so `<button variant="s-sm">`
 * and `<button class="s-sm">` are the same thing to the generator. The
 * compound form is available for component-scoped rules that want to key on
 * the element without colliding with a bare utility of the same name.
 *
 * Collision caveat: when a bare value and a compound value both match
 * different rules, uno keeps the FIRST rule that matches a token. The bare
 * form is emitted first, so a bare key wins over a compound key when both
 * exist. This is the right default — a shared utility should win over a
 * component-scoped rule — but it means a component cannot override a shared
 * utility by emitting a compound with the same suffix.
 */
export const variantExtractor: Extractor = {
  name: "spin/variant",
  order: 0,
  extract({ code }) {
    return [
      ...code.matchAll(/<([a-z][a-z0-9-]*)[^>]*\svariant=["']([^"']*)["']/g),
    ]
      .flatMap((match) => {
        const element = match[1] as string;
        const values = (match[2] as string).split(/\s+/).filter(Boolean);
        return values.flatMap((value) => [value, `${element}-${value}`]);
      });
  },
};
