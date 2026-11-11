import { defaultTwin } from "@spinjs/components/runtime";
import type { TagsEvent } from "./tags.events.ts";

export interface TagsValidateArgs {
  readonly inputValue: string;
  readonly value: readonly string[];
}

export type SanitizeValue = (value: string) => string;

export type ValidateTag = (details: TagsValidateArgs) => boolean;

/** The mutation log: the connect turns each entry into an announcement. */
export type TagsLog =
  | { readonly type: "add"; readonly value: string }
  | { readonly type: "delete"; readonly value: string }
  | { readonly type: "update"; readonly value: string }
  | { readonly type: "paste"; readonly values: readonly string[] }
  | { readonly type: "select"; readonly value: string }
  | { readonly type: "clear" };

export type TagsState =
  | "idle"
  | "focused:input"
  | "navigating:tag"
  | "editing:tag";
export interface TagsContext {
  value: string[];
  /** The seed for form reset: the value the host declared. */
  initialValue: string[];
  inputValue: string;
  highlightedIndex: number | null;
  editedValue: string;
  editedIndex: number | null;
  log: TagsLog | null;
  logPrev: TagsLog | null;
  /** Set when an add was refused; the bridge reports and clears it. */
  refusal: "invalidTag" | null;
  max: number;
  allowOverflow: boolean;
  allowDuplicates: boolean;
  editable: boolean;
  addOnPaste: boolean;
  addOnBlur: boolean;
  clearOnBlur: boolean;
  delimiter: string;
  sanitizeValue: SanitizeValue;
  validate: ValidateTag;
  dir: "ltr" | "rtl";
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean | undefined;
  required: boolean;
  name: string | undefined;
  form: string | undefined;
  maxLength: number | null;
  placeholder: string;
  translations: unknown;
}

export interface TagsArgs {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly inputValue?: string;
  readonly defaultInputValue?: string;
  readonly max?: number;
  readonly allowOverflow?: boolean;
  readonly allowDuplicates?: boolean;
  readonly editable?: boolean;
  readonly addOnPaste?: boolean;
  /** The blur behavior: `add` commits, `clear` empties, neither does. */
  readonly blurBehavior?: string;
  readonly delimiter?: string;
  readonly sanitizeValue?: SanitizeValue;
  readonly validate?: ValidateTag;
  readonly dir?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly invalid?: boolean;
  readonly required?: boolean;
  readonly name?: string;
  readonly form?: string;
  readonly maxLength?: number;
  readonly placeholder?: string;
  readonly translations?: unknown;
}

/** Strings off the transport: JSON text or arrays, well-shaped only.
 * The scope grammar coerces `= []` to `["[]"]` — the lone artifact entry
 * drops here, once, for every reader. */
export function stringsOf(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const clean = raw.filter((item): item is string =>
      typeof item === "string"
    );
    return clean.some((item) => item === "[]") && clean.length === 1
      ? []
      : clean;
  }
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
        parsed.every((item): item is string => typeof item === "string")
      ? [...parsed]
      : [];
  } catch {
    return [];
  }
}

export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export const uniq = (
  values: readonly string[],
): string[] => [...new Set(values)];

export const clampIndex = (index: number, length: number): number | null =>
  index < 0 || index >= length ? null : index;

const sanitizeDefault: SanitizeValue = (value: string): string => value.trim();

const validateDefault: ValidateTag = (): boolean => true;

export function initial(
  args: TagsArgs,
  authored: (name: string) => boolean,
): TagsContext {
  const count = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : Infinity;
  const flag = (value: unknown): boolean => value === true;
  const text = (value: unknown, fallback: string): string =>
    typeof value === "string" ? value : fallback;
  const fn = <T>(
    value: unknown,
    fallback: T,
  ): T => (typeof value === "function" ? value as T : fallback);
  const behavior: unknown = args.blurBehavior;
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const seeded = written("value")
    ? stringsOf(args.value)
    : stringsOf(args.defaultValue);
  return {
    value: seeded,
    initialValue: seeded,
    inputValue: written("inputValue")
      ? text(args.inputValue, "")
      : text(args.defaultInputValue, ""),
    max: count(args.max),
    allowOverflow: flag(args.allowOverflow),
    allowDuplicates: flag(args.allowDuplicates),
    editable: args.editable !== false,
    addOnPaste: flag(args.addOnPaste),
    addOnBlur: behavior === "add",
    clearOnBlur: behavior === "clear",
    delimiter: text(args.delimiter, ","),
    sanitizeValue: fn(args.sanitizeValue, sanitizeDefault),
    validate: fn(args.validate, validateDefault),
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: args.invalid === true ? true : undefined,
    required: args.required === true,
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
    form: typeof args.form === "string" && args.form.length > 0
      ? args.form
      : undefined,
    maxLength:
      typeof args.maxLength === "number" && Number.isFinite(args.maxLength) &&
        args.maxLength > 0
        ? Math.trunc(args.maxLength)
        : null,
    placeholder: typeof args.placeholder === "string" ? args.placeholder : "",
    translations: args.translations,
  } as TagsContext;
}

/** An exact count rather than a ceiling: a list already past the cap is not
 * "at" it, so the insert still goes through — which is why `api.atMax`
 * reports `>=` while this guard reports equality. */
export const isAtMax = (ctx: TagsContext): boolean =>
  ctx.value.length === ctx.max;

/** The INSERT_TAG overflow guard: at the cap the input text survives. */
export const canAdd = (ctx: TagsContext): boolean =>
  ctx.allowOverflow || !isAtMax(ctx);

export const caretAtStart = (event: TagsEvent): boolean => {
  switch (event.type) {
    case "ARROW_LEFT":
    case "ARROW_RIGHT":
    case "BACKSPACE":
    case "DELETE":
      return event.caretAtStart === true;
    default:
      return false;
  }
};

/** The selection is announced from a watch on the highlight; here it is
 * written wherever the highlight moves. */
export const withSelectLog = (
  ctx: TagsContext,
  index: number | null,
): Partial<TagsContext> => {
  if (index === null || ctx.log === null) return { highlightedIndex: index };
  const value = ctx.value[index];
  if (value === undefined) return { highlightedIndex: index };
  return {
    highlightedIndex: index,
    logPrev: ctx.log,
    log: { type: "select", value },
  };
};

export const valueAtIndex = (
  ctx: TagsContext,
  index: number,
): string | undefined => ctx.value[index];

/** Append the sanitized input text, then clear it. Guarded by `canInsert`
 * at every call site. */
export const addFromInput = (ctx: TagsContext): Partial<TagsContext> => {
  const inputValue = ctx.sanitizeValue(ctx.inputValue);
  if (!ctx.validate({ inputValue, value: ctx.value })) {
    return { refusal: "invalidTag" as const };
  }
  const next = ctx.allowDuplicates
    ? [...ctx.value, inputValue]
    : uniq([...ctx.value, inputValue]);
  return {
    value: next,
    inputValue: "",
    log: { type: "add", value: inputValue },
    logPrev: ctx.log,
  };
};
