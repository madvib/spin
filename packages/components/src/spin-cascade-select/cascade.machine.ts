/**
 * Cascade-select on the forked FSM.
 *
 * The machine holds value paths, never the tree: `value` is a list of
 * root-to-node paths (`string[][]`) and `highlightedValue` is one path. The
 * visible levels are exactly the nodes along `highlightedValue`, so the view
 * owns them. Navigation is view-owned too — the connect computes each target
 * against the tree and sends the resulting path; the machine never asks
 * "what is the next enabled sibling".
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type Service, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const clearValue = () : Partial<CascadeContext> => { return ({ value: [] }); };

const clearHighlightedValue = (ctx: CascadeContext) : Partial<CascadeContext> => { return ctx.highlightedValue.length === 0 ? {} : { highlightedValue: [] }; };

const highlightSelected = (ctx: CascadeContext) : Partial<CascadeContext> => {
      const last = ctx.value[ctx.value.length - 1];
      if (last === undefined || samePath(ctx.highlightedValue, last)) return {};
      return { highlightedValue: clonePath(last) };
    };

const openWithHighlight = (_ctx: CascadeContext, e: CascadeEvent) : Partial<CascadeContext> => { return e.type === "TRIGGER_OPEN" ? { highlightedValue: clonePath(e.highlight) } : {}; };

const selectItem = (ctx: CascadeContext, e: CascadeEvent) : Partial<CascadeContext> => {
      if (e.type !== "ITEM_CLICK" && e.type !== "ITEM_SELECT") return {};
      const path = e.value;
      if (ctx.allowParentSelection) {
        // A selected branch also takes the highlight: the level stack
        // follows the pick either way.
        return {
          value: [...withoutRelated(ctx.value, path), clonePath(path)],
          ...(e.hasChildren ? { highlightedValue: clonePath(path) } : {}),
        };
      }
      if (e.hasChildren) {
        return {
          value: ctx.multiple && ctx.value.length > 0
            ? [...ctx.value.slice(0, -1).map((p) => [...p]), clonePath(path)]
            : [clonePath(path)],
          highlightedValue: clonePath(path),
        };
      }
      if (ctx.multiple) {
        return {
          value: ctx.value.some((candidate) => samePath(candidate, path))
            ? ctx.value.filter((candidate) => !samePath(candidate, path)).map((candidate) => [...candidate])
            : [...ctx.value.map((candidate) => [...candidate]), clonePath(path)],
        };
      }
      return { value: [clonePath(path)] };
    };

const restoresFocus = (_ctx: CascadeContext, event: EventUnion<CascadeEvents>) : boolean => { return "restoreFocus" in event ? event.restoreFocus !== false : true; };



/**
 * The cascade-select's arguments: the values the host may set.
 */
export interface CascadeArgs {
  value?: string;
  highlightedValue?: string;
  closeOnSelect?: boolean;
  allowParentSelection?: boolean;
  multiple?: boolean;
  loopFocus?: boolean;
  highlightTrigger?: string;
  defaultHighlightTrigger?: string;
}

const coerceList = (raw: unknown): readonly unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isString = (segment: unknown): segment is string => typeof segment === "string";

export function parsePath(raw: unknown): readonly string[] {
  if (typeof raw === "string") return raw.split(",");
  return coerceList(raw).filter(isString);
}

export function parsePaths(raw: unknown): readonly string[][] {
  const list = coerceList(raw);
  const out: string[][] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      out.push(entry.split(","));
      continue;
    }
    if (Array.isArray(entry)) out.push(entry.filter(isString));
  }
  return out;
}

export function initial(args: CascadeArgs, authored: (name: string) => boolean): CascadeContext {
  // A host that wrote `defaultValue` (or `defaultHighlightedValue`) wrote
  // the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value")
      ? parsePaths(args.value).map((path) => [...path])
      : [],
    highlightedValue: written("highlightedValue")
      ? [...parsePath(args.highlightedValue)]
      : [],
    closeOnSelect: written("closeOnSelect") ? args.closeOnSelect !== false : true,
    allowParentSelection: written("allowParentSelection")
      ? args.allowParentSelection === true
      : false,
    multiple: written("multiple") ? args.multiple === true : false,
    loopFocus: written("loopFocus") ? args.loopFocus === true : false,
    highlightTrigger: written("highlightTrigger")
      ? (args.highlightTrigger === "hover" ? "hover" : "click")
      : "click",
  };
}

export function startOpen(raw: Record<string, unknown>): boolean {
  if (typeof raw["open"] === "boolean") return raw["open"];
  return raw["defaultOpen"] === true;
}

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const samePaths = (a: readonly string[][], b: readonly string[][]): boolean =>
  a.length === b.length && a.every((path, i) => samePath(path, b[i] ?? []));

/** One path is an ancestor (or the equal) of the other. */
const related = (a: readonly string[], b: readonly string[]): boolean => {
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return long.slice(0, short.length).every((v, i) => v === short[i]);
};

const withoutRelated = (paths: readonly string[][], path: readonly string[]): string[][] =>
  paths.filter((candidate) => !related(candidate, path)).map((candidate) => [...candidate]);

const clonePath = (path: readonly string[]): string[] => [...path];

/**
 * The machine's context: the selected paths, the highlighted path, and the
 * flags the guards read.
 */
export interface CascadeContext {
  value: string[][];
  highlightedValue: string[];
  closeOnSelect: boolean;
  allowParentSelection: boolean;
  multiple: boolean;
  loopFocus: boolean;
  highlightTrigger: "click" | "hover";
}

export interface CascadeEvents {
  "OPEN": {};
  "CLOSE": { restoreFocus?: boolean };
  "CONTROLLED_OPEN": {};
  "CONTROLLED_CLOSE": {};
  "TRIGGER_CLICK": {};
  "TRIGGER_FOCUS": {};
  "TRIGGER_BLUR": {};
  "TRIGGER_OPEN": { highlight: string[] };
  "ITEM_CLICK": { value: string[]; hasChildren: boolean };
  "ITEM_POINTER_ENTER": { value: string[]; hasChildren: boolean };
  "VALUE_SET": { value: string[][] | string };
  "VALUE_CLEAR": {};
  "HIGHLIGHTED_VALUE_SET": { /** The command's payload: the path the host named. */
      value: string[]; /** The host write's payload: the prop's own name. */
      highlightedValue?: string | string[] };
  "HIGHLIGHTED_VALUE_CLEAR": {};
  "ITEM_SELECT": { value: string[]; hasChildren: boolean };
  "ITEM_CLEAR": { value: string[] };
  "CLEAR_TRIGGER_CLICK": {};
}

export type CascadeEvent = EventUnion<CascadeEvents>;


const config: MachineSpec<CascadeContext, CascadeEvents> = {
  id: "cascade-select",
  initial: "idle",
  context: {
    value: [] as string[][],
    highlightedValue: [] as string[],
    closeOnSelect: true,
    allowParentSelection: false,
    multiple: false,
    loopFocus: false,
    highlightTrigger: "click" as "click" | "hover",
  },
  // Root tier: valid from every state, so a host's `setValue` works while
  // closed.
  on: {
    "VALUE_SET": { assign: (ctx, e) => {
      if (e.type !== "VALUE_SET") return {};
      const paths = parsePaths(e.value);
      return samePaths(ctx.value, paths) ? {} : { value: clonePaths(paths) };
    } },
    "VALUE_CLEAR": { assign: clearValue },
    "HIGHLIGHTED_VALUE_SET": { assign: (ctx, e) => {
      if (e.type !== "HIGHLIGHTED_VALUE_SET") return {};
      const raw = e.highlightedValue !== undefined ? e.highlightedValue : e.value;
      const path = parsePath(raw);
      return samePath(ctx.highlightedValue, path) ? {} : { highlightedValue: clonePath(path) };
    } },
    "HIGHLIGHTED_VALUE_CLEAR": { assign: clearHighlightedValue },
    "ITEM_SELECT": { assign: selectItem },
    "ITEM_CLEAR": { assign: (ctx, e) => { return e.type === "ITEM_CLEAR" && ctx.value.some((path) => samePath(path, e.value))
        ? { value: ctx.value.filter((path) => !samePath(path, e.value)).map((path) => [...path]) }
        : {}; } },
    "CLEAR_TRIGGER_CLICK": { assign: clearValue },
  },
  states: {
    idle: {
      on: {
        OPEN: { target: "open" },
        CONTROLLED_OPEN: { target: "open" },
        TRIGGER_CLICK: { target: "open", assign: highlightSelected },
        TRIGGER_OPEN: { target: "open", assign: openWithHighlight },
        TRIGGER_FOCUS: { target: "focused" },
      },
    },
    focused: {
      on: {
        OPEN: { target: "open" },
        CONTROLLED_OPEN: { target: "open" },
        TRIGGER_CLICK: { target: "open", assign: highlightSelected },
        TRIGGER_OPEN: { target: "open", assign: openWithHighlight },
        TRIGGER_BLUR: { target: "idle" },
      },
    },
    open: {
      on: {
        // The restore-focus rule: a focusable outside (or a context menu)
        // takes the focus instead of the trigger, so the machine lands idle
        // rather than focused.
        CONTROLLED_CLOSE: [
          {
            cond: restoresFocus,
            target: "focused",
            assign: clearHighlightedValue,
          },
          { target: "idle", assign: clearHighlightedValue },
        ],
        CLOSE: [
          {
            cond: restoresFocus,
            target: "focused",
            assign: clearHighlightedValue,
          },
          { target: "idle", assign: clearHighlightedValue },
        ],
        // A press on the trigger while open is a toggle, and the dismiss
        // layer reports the close with focus back on the trigger.
        TRIGGER_CLICK: { target: "focused", assign: clearHighlightedValue },
        ITEM_CLICK: [
          { cond: (ctx, event) => { return event.type === "ITEM_CLICK"
        ? ctx.closeOnSelect && !event.hasChildren && !ctx.multiple
        : false; }, target: "focused", assign: [selectItem, clearHighlightedValue] },
          { cond: (ctx, event) => { return event.type === "ITEM_CLICK" ? ctx.allowParentSelection || !event.hasChildren : false; }, assign: selectItem },
          // A branch that may not be selected still takes the highlight, so
          // the level stack follows the click.
          { assign: (_ctx, e) => { return e.type === "ITEM_CLICK" ? { highlightedValue: clonePath(e.value) } : {}; } },
        ],
        // The connect reports every pointer move; the highlight-follows-hover
        // behaviour stays opt-in, as the `isHoverHighlight` guard does.
        ITEM_POINTER_ENTER: [
          { cond: (ctx) => { return ctx.highlightTrigger === "hover"; }, assign: (_ctx, e) => { return e.type === "ITEM_POINTER_ENTER"
        ? { highlightedValue: e.hasChildren ? clonePath(e.value) : e.value.slice(0, -1) }
        : {}; } },
        ],
      },
    },
  },
};

const clonePaths = (paths: readonly string[][]): string[][] => paths.map((path) => [...path]);

const implementations = {// No `actions` table: every transition is a pure context transform. The
  // out-side callbacks fire from the bridge after each send, guarded by a
  // change snapshot, so a no-op event means no event anywhere.
};

export type CascadeService = Service<CascadeContext, CascadeEvent>;

export function cascade(
  args: CascadeArgs = {},
  authored: (name: string) => boolean,
): Machine<CascadeContext, CascadeEvents> {
  return createMachine<CascadeContext, CascadeEvents>({
    ...config,
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE_SET" },
      highlightedValue: { event: "HIGHLIGHTED_VALUE_SET" },
      closeOnSelect: {},
      allowParentSelection: {},
      multiple: {},
      loopFocus: {},
      highlightTrigger: {},
    },
  });
}
