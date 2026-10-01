import { prefixVariant } from "../utils/variant.ts";

export const focusVariant = prefixVariant(
  "spin-focus",
  "focus:",
  (s) => `${s}:focus`,
);
