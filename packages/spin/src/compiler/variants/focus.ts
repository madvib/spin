import { prefixVariant } from "../utils/variant.ts";

export const FOCUS_PREFIX = "focus:";

export const focusVariant = prefixVariant(
  "spin-focus",
  FOCUS_PREFIX,
  (s) => `${s}:focus`,
);
