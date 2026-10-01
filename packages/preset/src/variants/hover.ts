import { prefixVariant } from "../utils/variant.ts";

export const hoverVariant = prefixVariant(
  "spin-hover",
  "hover:",
  (s) => `${s}:hover`,
);
