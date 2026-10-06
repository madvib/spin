import type { Extractor } from "@unocss/core";

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
