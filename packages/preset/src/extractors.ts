import type { Extractor } from "@unocss/core";

/**
 * The keys of a class object as tokens.
 *
 * A class attribute may hold an OBJECT: its keys are the utilities and
 * its values are live reads, so the class follows the state —
 * `class={{ "bg-primary": slider.state === "open" }}`. The keys are
 * static strings in the source, so the build must see them: uno's
 * default extractor reads the attribute's VALUE (an object literal, not
 * a class list) and finds nothing, and a utility nobody extracts has no
 * rule and cannot apply.
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
    for (const match of code.matchAll(/class=\{\{([\s\S]*?)\}\}/g)) {
      for (const key of (match[1] ?? "").matchAll(/"([^"]+)"|'([^']+)'/g)) {
        const name = key[1] ?? key[2];
        if (name === undefined) continue;
        // A key may name several utilities: the classes that belong
        // together.
        for (const token of name.split(/\s+/)) {
          if (token.length > 0) out.push(token);
        }
      }
    }
    return out;
  },
};

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
