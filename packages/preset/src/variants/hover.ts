import { prefixVariant } from "../utils/variant.ts";

export const HOVER_PREFIX = "hover:";

export const hoverVariant = prefixVariant(
  "spin-hover",
  HOVER_PREFIX,
  (s) => `${s}:hover`,
);
