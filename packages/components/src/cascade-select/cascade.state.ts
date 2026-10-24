import { defaultTwin } from "@spinjs/runtime";
import { coerceJsonArray, isRecord } from "@spinjs/runtime";
import type { CascadeNode } from "./cascade.presentation.ts";

// Re-export types that live in presentation for convenience.
export type { CascadeNode };

export type CascadeState = "idle" | "focused" | "open";

export interface CascadeArgs {
  value?: string;
  highlightedValue?: string;
  closeOnSelect?: boolean;
  allowParentSelection?: boolean;
  multiple?: boolean;
  loopFocus?: boolean;
  highlightTrigger?: string;
  defaultHighlightTrigger?: string;
  collection?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
  dir?: string;
  formatValue?: unknown;
  placement?: string;
  form?: unknown;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  onFocusOutside?: unknown;
  onInteractOutside?: unknown;
  onPointerDownOutside?: unknown;
  scrollToIndexFn?: unknown;
  defaultOpen?: boolean;
  open?: boolean;
}

export interface CascadeContext {
  value: string[][];
  highlightedValue: string[];
  closeOnSelect: boolean;
  allowParentSelection: boolean;
  multiple: boolean;
  loopFocus: boolean;
  highlightTrigger: "click" | "hover";
  collection: readonly CascadeNode[];
  disabled: boolean;
  readOnly: boolean;
  dir: "ltr" | "rtl";
  formatValue: unknown;
  placement: string;
  form: unknown;
  name: string;
  required: boolean;
  invalid: boolean;
  onFocusOutside: unknown;
  onInteractOutside: unknown;
  onPointerDownOutside: unknown;
  scrollToIndexFn: unknown;
}

// --- collection parsing helpers ---
const coerceList = (raw: unknown): readonly unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function parsePath(raw: unknown): readonly string[] {
  if (typeof raw === "string") return raw.split(",");
  const list = coerceList(raw);
  return list.filter((v): v is string => typeof v === "string");
}

export function parsePaths(raw: unknown): readonly string[][] {
  const list = coerceList(raw);
  const out: string[][] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      out.push(entry.split(","));
      continue;
    }
    if (Array.isArray(entry)) {
      out.push(entry.filter((v): v is string => typeof v === "string"));
    }
  }
  return out;
}

const parseNode = (raw: unknown): CascadeNode | undefined => {
  if (!isRecord(raw)) return undefined;
  const value = raw["value"];
  if (typeof value !== "string" || value.length === 0) return undefined;
  const label = typeof raw["label"] === "string" ? raw["label"] : value;
  const disabled = raw["disabled"] === true;
  const childrenRaw = raw["children"];
  const children = Array.isArray(childrenRaw)
    ? (childrenRaw.map(parseNode).filter((n): n is CascadeNode =>
      n !== undefined
    ))
    : undefined;
  return { value, label, disabled, children };
};

const parseNodes = (list: readonly unknown[]): readonly CascadeNode[] =>
  list.flatMap((raw) => {
    const node = parseNode(raw);
    return node === undefined ? [] : [node];
  });

const collectionCache = new WeakMap<object, readonly CascadeNode[]>();
const jsonCollections = new Map<string, readonly CascadeNode[]>();

export const parseCollection = (raw: unknown): readonly CascadeNode[] => {
  if (typeof raw === "object" && raw !== null) {
    const hit = collectionCache.get(raw);
    if (hit !== undefined) return hit;
    const shaped = Array.isArray(raw) ? parseNodes(raw) : [];
    collectionCache.set(raw, shaped);
    return shaped;
  }
  if (typeof raw !== "string") return [];
  const hit = jsonCollections.get(raw);
  if (hit !== undefined) return hit;
  const shaped = parseNodes(coerceJsonArray(raw, []));
  jsonCollections.set(raw, shaped);
  return shaped;
};

export function initial(
  args: CascadeArgs = {},
  authored: (name: string) => boolean,
): CascadeContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const collection = parseCollection(
    (args as Record<string, unknown>)["collection"],
  );
  return {
    value: written("value")
      ? parsePaths(args.value).map((path) => [...path])
      : [],
    highlightedValue: written("highlightedValue")
      ? [...parsePath(args.highlightedValue)]
      : [],
    closeOnSelect: written("closeOnSelect")
      ? args.closeOnSelect !== false
      : true,
    allowParentSelection: written("allowParentSelection")
      ? args.allowParentSelection === true
      : false,
    multiple: written("multiple") ? args.multiple === true : false,
    loopFocus: written("loopFocus") ? args.loopFocus === true : false,
    highlightTrigger: written("highlightTrigger")
      ? (args.highlightTrigger === "hover" ? "hover" : "click")
      : "click",
    collection,
    disabled: written("disabled") ? args.disabled === true : false,
    readOnly: written("readOnly") ? args.readOnly === true : false,
    dir: written("dir") ? (args.dir === "rtl" ? "rtl" : "ltr") : "ltr",
    formatValue: written("formatValue") ? args.formatValue : undefined,
    placement: written("placement") && typeof args.placement === "string" &&
        args.placement.length > 0
      ? args.placement
      : "bottom-start",
    form: written("form") ? args.form : undefined,
    name: written("name")
      ? (typeof args.name === "string" ? args.name : "")
      : "",
    required: written("required") ? args.required === true : false,
    invalid: written("invalid") ? args.invalid === true : false,
    onFocusOutside: written("onFocusOutside") ? args.onFocusOutside : undefined,
    onInteractOutside: written("onInteractOutside")
      ? args.onInteractOutside
      : undefined,
    onPointerDownOutside: written("onPointerDownOutside")
      ? args.onPointerDownOutside
      : undefined,
    scrollToIndexFn: written("scrollToIndexFn")
      ? args.scrollToIndexFn
      : undefined,
  };
}

export function startOpen(raw: Record<string, unknown>): boolean {
  if (typeof raw["open"] === "boolean") return raw["open"];
  return raw["defaultOpen"] === true;
}
