import { defaultTwin } from "@spin/runtime";

export type PinInputSanitize = (value: string) => string;

export interface PinInputTranslations {
  readonly inputLabel: (index: number, length: number) => string;
}

export type PinInputState = "idle" | "focused";

export interface PinInputContext {
  /** One character per cell, filled to `count` by every assign. */
  value: string[];
  /** The cell the keyboard talks to; -1 when nothing holds focus. */
  focusedIndex: number;
  count: number;
  dir: "ltr" | "rtl";
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean | undefined;
  required: boolean;
  name: string | undefined;
  form: string | undefined;
  type: "numeric" | "alphabetic" | "alphanumeric";
  mask: boolean;
  otp: boolean;
  placeholder: string;
  pattern: string;
  translations: unknown;
  sanitizeValue: unknown;
  blurOnComplete: boolean;
  autoSubmit: boolean;
  autoFocus: boolean;
}

const DEFAULT_COUNT = 4;

export interface PinInputArgs {
  count?: number;
  value?: string | readonly string[];
  autoFocus?: boolean;
  defaultCount?: number;
  dir?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
  type?: string;
  mask?: boolean;
  otp?: boolean;
  placeholder?: string;
  pattern?: string;
  translations?: unknown;
  sanitizeValue?: unknown;
  blurOnComplete?: boolean;
  autoSubmit?: boolean;
}

const parseChars = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
    ? raw.split(",").map((part) => part.trim())
    : [];
  return parts.filter((part) => part.length === 1);
};

export function initial(
  args: PinInputArgs,
  authored: (name: string) => boolean,
): PinInputContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const count = typeof args.count === "number" && Number.isFinite(args.count)
    ? Math.max(0, Math.trunc(args.count))
    : DEFAULT_COUNT;
  const chars = written("value") ? parseChars(args.value) : [];
  const pinType = args.type;
  return {
    value: fill(chars, count),
    focusedIndex: args.autoFocus === true ? 0 : -1,
    count,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: authored("invalid") ? args.invalid === true : undefined,
    required: args.required === true,
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
    form: typeof args.form === "string" && args.form.length > 0
      ? args.form
      : undefined,
    type: pinType === "alphabetic" || pinType === "alphanumeric"
      ? pinType
      : "numeric",
    mask: args.mask === true,
    otp: args.otp === true,
    placeholder: typeof args.placeholder === "string"
      ? args.placeholder
      : "\u25CB",
    pattern: typeof args.pattern === "string" ? args.pattern : "",
    translations: args.translations,
    sanitizeValue: args.sanitizeValue,
    blurOnComplete: args.blurOnComplete === true,
    autoSubmit: args.autoSubmit === true,
    autoFocus: args.autoFocus === true,
  };
}

/**
 * The value padded (or truncated) to the cell count. A cell the value does
 * not reach reads as the empty string.
 */
export function fill(value: readonly string[], count: number): string[] {
  const length = count || value.length;
  return Array.from({ length }).fill("").map((_char, index) =>
    value[index] || ""
  );
}

export interface PinValueView {
  readonly chars: readonly string[];
  readonly length: number;
  readonly filled: number;
  readonly complete: boolean;
  readonly asString: string;
}

export function pinView(value: readonly string[], count: number): PinValueView {
  const chars = fill(value, count);
  const filled = chars.filter((char) => char.trim() !== "").length;
  return {
    chars,
    length: chars.length,
    filled,
    complete: chars.length === filled,
    asString: chars.join(""),
  };
}

export function getNextValue(current: string, next: string): string {
  let nextValue = next;
  if (current[0] === next[0]) {
    nextValue = next[1] ?? "";
  } else if (current[0] === next[1]) {
    nextValue = next[0] ?? "";
  }
  const chars = nextValue.split("");
  return chars[chars.length - 1] ?? "";
}
