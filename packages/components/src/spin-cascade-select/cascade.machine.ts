/**
 * Cascade-select on the forked FSM.
 *
 * What Zag ships here is three states — `idle`, `focused`, `open` — holding a
 * `TreeCollection` the machine walks itself: `highlightNextItem`, `isAtRoot
 * Level` and `canNavigateToChild` are all collection queries inside the
 * machine. The level stack, by contrast, is pure derivation: the visible
 * levels are exactly the nodes along `highlightedValue`, so the view can own
 * them.
 *
 * The split this port makes:
 *
 * 1. **The machine holds value paths, never the tree.** `value` is a list of
 *    root-to-node paths (`string[][]`) and `highlightedValue` is one path
 *    (`string[]`). Index paths — Zag's `highlightedIndexPath`, 1-based over a
 *    synthetic root — are the connect's construction from the item tree.
 * 2. **Navigation is view-owned.** Arrow keys, Home/End, Enter, the trigger's
 *    open-with-first/last and the hover highlight all compute their target
 *    against the tree in the connect and send the resulting path. The machine
 *    never asks "what is the next enabled sibling".
 * 3. **Timers and geometry leave.** The grace area (`isPointerInTransit`,
 *    `graceArea`) is a 300ms polygon whose only consumers clear it — nothing
 *    in the machine reads it for a visible outcome, so it does not come along.
 *    Placement is declarative CSS keyed on `data-placement`; there is no
 *    floating engine to drive `currentPlacement` or `reposition`.
 * 4. **`childrenCount`/lazy collections leave.** The tree crosses the prop
 *    channel as JSON text, so every level is present; a host that loads levels
 *    rewrites the collection property, as tree-view's host rewrites `nodes`.
 */

import type { Service } from "@spin/runtime/fsm";

export interface CascadeInitial {
  readonly value?: unknown;
  readonly defaultValue?: unknown;
  readonly highlightedValue?: unknown;
  readonly defaultHighlightedValue?: unknown;
  readonly open?: unknown;
  readonly defaultOpen?: unknown;
  readonly closeOnSelect?: unknown;
  readonly allowParentSelection?: unknown;
  readonly multiple?: unknown;
  readonly loopFocus?: unknown;
  readonly highlightTrigger?: unknown;
}

/** Parse JSON-text-or-array helpers shared with the bindings. */
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

/** A value path: well-shaped segments only. */
export function parsePath(raw: unknown): readonly string[] {
  if (typeof raw === "string") return raw.split(",");
  return coerceList(raw).filter(isString);
}

/** A list of value paths. */
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

/** Seed shaping: flags name themselves; the value/highlight/open arrive
 * through establish (parsed there). */
export function initial(raw: CascadeInitial): Pick<CascadeContext, "closeOnSelect" | "allowParentSelection" | "multiple" | "loopFocus" | "highlightTrigger"> {
  return {
    closeOnSelect: raw.closeOnSelect !== false,
    allowParentSelection: raw.allowParentSelection === true,
    multiple: raw.multiple === true,
    loopFocus: raw.loopFocus === true,
    highlightTrigger: raw.highlightTrigger === "hover" ? "hover" : "click",
  };
}

/** The seeded open state: an authored open wins, else its default. */
export function startOpen(raw: CascadeInitial): boolean {
  if (typeof raw.open === "boolean") return raw.open;
  return raw.defaultOpen === true;
}

/** Two paths are the same when every segment matches, in order. */
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

export interface CascadeContext {
  /** Selected paths, each root-to-node. Order is selection order. */
  value: string[][];
  /** The highlighted path; the visible level stack is derived from it. */
  highlightedValue: string[];
  /** Props the guards read. Synced per send from scope values by the bridge. */
  closeOnSelect: boolean;
  allowParentSelection: boolean;
  multiple: boolean;
  loopFocus: boolean;
  highlightTrigger: "click" | "hover";
}

export type CascadeEvent =
  | { type: "OPEN" }
  /** A dismissal or a programmatic close; `restoreFocus: false` puts focus on
   *  the outside element instead of the trigger, so the machine lands idle. */
  | { type: "CLOSE"; restoreFocus?: boolean }
  | { type: "CONTROLLED_OPEN" }
  | { type: "CONTROLLED_CLOSE" }
  | { type: "TRIGGER_CLICK" }
  | { type: "TRIGGER_FOCUS" }
  | { type: "TRIGGER_BLUR" }
  /** The trigger's open intents; the connect has already computed the target. */
  | { type: "TRIGGER_OPEN"; highlight: string[] }
  | { type: "ITEM_CLICK"; value: string[]; hasChildren: boolean }
  | { type: "ITEM_POINTER_ENTER"; value: string[]; hasChildren: boolean }
  | { type: "VALUE_SET"; value: string[][] }
  | { type: "VALUE_CLEAR" }
  | { type: "HIGHLIGHTED_VALUE_SET"; value: string[] }
  | { type: "HIGHLIGHTED_VALUE_CLEAR" }
  | { type: "ITEM_SELECT"; value: string[]; hasChildren: boolean }
  | { type: "ITEM_CLEAR"; value: string[] }
  | { type: "CLEAR_TRIGGER_CLICK" };

export const config = {
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
  // Root tier: the imperative surface. Zag has the same set on `on`, where it
  // is valid from every state — a host's `setValue` works while closed.
  on: {
    "VALUE_SET": { actions: [{ assign: "setValue" }] },
    "VALUE_CLEAR": { actions: [{ assign: "clearValue" }] },
    "HIGHLIGHTED_VALUE_SET": { actions: [{ assign: "setHighlightedValue" }] },
    "HIGHLIGHTED_VALUE_CLEAR": { actions: [{ assign: "clearHighlightedValue" }] },
    "ITEM_SELECT": { actions: [{ assign: "selectItem" }] },
    "ITEM_CLEAR": { actions: [{ assign: "clearItem" }] },
    "CLEAR_TRIGGER_CLICK": { actions: [{ assign: "clearValue" }] },
  },
  states: {
    idle: {
      on: {
        OPEN: { target: "open" },
        CONTROLLED_OPEN: { target: "open" },
        TRIGGER_CLICK: { target: "open", actions: [{ assign: "highlightSelected" }] },
        TRIGGER_OPEN: { target: "open", actions: [{ assign: "openWithHighlight" }] },
        TRIGGER_FOCUS: { target: "focused" },
      },
    },
    focused: {
      on: {
        OPEN: { target: "open" },
        CONTROLLED_OPEN: { target: "open" },
        TRIGGER_CLICK: { target: "open", actions: [{ assign: "highlightSelected" }] },
        TRIGGER_OPEN: { target: "open", actions: [{ assign: "openWithHighlight" }] },
        TRIGGER_BLUR: { target: "idle" },
      },
    },
    open: {
      on: {
        // Zag's restoreFocusFn: the dismisser reports whether focus goes back
        // to the trigger. A focusable outside (or a context menu) takes it
        // instead, so the machine lands idle rather than focused.
        CONTROLLED_CLOSE: [
          {
            cond: "restoresFocus",
            target: "focused",
            actions: [{ assign: "clearHighlightedValue" }],
          },
          { target: "idle", actions: [{ assign: "clearHighlightedValue" }] },
        ],
        CLOSE: [
          {
            cond: "restoresFocus",
            target: "focused",
            actions: [{ assign: "clearHighlightedValue" }],
          },
          { target: "idle", actions: [{ assign: "clearHighlightedValue" }] },
        ],
        // A press on the trigger while open is a toggle, and Zag's dismiss
        // layer reports the close with focus back on the trigger.
        TRIGGER_CLICK: { target: "focused", actions: [{ assign: "clearHighlightedValue" }] },
        ITEM_CLICK: [
          { cond: "closesOnSelect", target: "focused", actions: [{ assign: "selectItem" }, { assign: "clearHighlightedValue" }] },
          { cond: "selectable", actions: [{ assign: "selectItem" }] },
          // A branch that may not be selected still takes the highlight, so
          // the level stack follows the click.
          { actions: [{ assign: "highlightItem" }] },
        ],
        // The connect reports every pointer move; the machine keeps the
        // highlight-follows-hover behaviour opt-in, as Zag's isHoverHighlight
        // guard does.
        ITEM_POINTER_ENTER: [
          { cond: "hoverHighlight", actions: [{ assign: "highlightHovered" }] },
        ],
      },
    },
  },
};

const clonePaths = (paths: readonly string[][]): string[][] => paths.map((path) => [...path]);

export const implementations = {
  conds: {
    restoresFocus: (_ctx: CascadeContext, event: CascadeEvent): boolean =>
      "restoreFocus" in event ? event.restoreFocus !== false : true,
    hoverHighlight: (ctx: CascadeContext): boolean => ctx.highlightTrigger === "hover",
    /** Zag's `canSelectItem`: a branch is selectable only when the host allows it. */
    selectable: (ctx: CascadeContext, event: CascadeEvent): boolean =>
      event.type === "ITEM_CLICK" ? ctx.allowParentSelection || !event.hasChildren : false,
    /** Zag's `shouldCloseOnSelect && !multiple` — only a leaf closes. */
    closesOnSelect: (ctx: CascadeContext, event: CascadeEvent): boolean =>
      event.type === "ITEM_CLICK"
        ? ctx.closeOnSelect && !event.hasChildren && !ctx.multiple
        : false,
  },
  assigns: {
    setValue: (ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "VALUE_SET" && !samePaths(ctx.value, e.value) ? { value: clonePaths(e.value) } : {},
    clearValue: (): Partial<CascadeContext> => ({ value: [] }),
    setHighlightedValue: (ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "HIGHLIGHTED_VALUE_SET" && !samePath(ctx.highlightedValue, e.value)
        ? { highlightedValue: clonePath(e.value) }
        : {},
    clearHighlightedValue: (ctx: CascadeContext): Partial<CascadeContext> =>
      ctx.highlightedValue.length === 0 ? {} : { highlightedValue: [] },
    clearItem: (ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "ITEM_CLEAR" && ctx.value.some((path) => samePath(path, e.value))
        ? { value: ctx.value.filter((path) => !samePath(path, e.value)).map((path) => [...path]) }
        : {},
    /** Opening on a trigger click resumes the most recent selection. */
    highlightSelected: (ctx: CascadeContext): Partial<CascadeContext> => {
      const last = ctx.value[ctx.value.length - 1];
      if (last === undefined || samePath(ctx.highlightedValue, last)) return {};
      return { highlightedValue: clonePath(last) };
    },
    openWithHighlight: (_ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "TRIGGER_OPEN" ? { highlightedValue: clonePath(e.highlight) } : {},
    highlightItem: (_ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "ITEM_CLICK" ? { highlightedValue: clonePath(e.value) } : {},
    /** Zag's `setHighlightingForHoveredItem`: hover shows a branch's own level
     *  and a leaf's parent level. */
    highlightHovered: (_ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> =>
      e.type === "ITEM_POINTER_ENTER"
        ? { highlightedValue: e.hasChildren ? clonePath(e.value) : e.value.slice(0, -1) }
        : {},
    /** Zag's `selectItem`, read off the event's own `hasChildren` flag so the
     *  assign never walks the tree. */
    selectItem: (ctx: CascadeContext, e: CascadeEvent): Partial<CascadeContext> => {
      if (e.type !== "ITEM_CLICK" && e.type !== "ITEM_SELECT") return {};
      const path = e.value;
      if (ctx.allowParentSelection) {
        // Zag's selectItem drills the highlight into a selected branch too:
        // the level stack follows the pick either way.
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
    },
  },
  // No `actions` table: every transition is a pure context transform. The
  // out-side callbacks fire from the bridge after each send, guarded by a
  // change snapshot, so a no-op event means no event anywhere.
};

export type CascadeService = Service<CascadeContext, CascadeEvent>;
