import type { FsmService } from "@spin/runtime/fsm";

/**
 * Tabs machine: selection plus focus, two states.
 *
 * The value/focus split is the whole chart. `selectOnFocus` (automatic
 * activation) is a named cond; arrow navigation computes its target in the
 * connect and sends TAB_FOCUS — the machine never walks the DOM.
 * Zag's indicator rect/animation machinery is absent: our markup has no
 * indicator part, and a visual effect is not machine state.
 */

export interface TabsContext {
  value: string | null;
  focusedValue: string | null;
  activationMode: "automatic" | "manual";
  /** Props the assigns read, synced from scope by the bridge. */
  deselectable: boolean;
}

export type TabsEvent =
  | { type: "TAB_CLICK"; value: string }
  | { type: "TAB_FOCUS"; value: string | null }
  | { type: "TAB_BLUR" }
  | { type: "SELECT_FOCUSED" }
  | { type: "SET_VALUE"; value: string | null }
  | { type: "CLEAR_VALUE" };

export const config = {
  id: "tabs",
  initial: "idle",
  context: {
    value: null as string | null,
    focusedValue: null as string | null,
    activationMode: "automatic" as "automatic" | "manual",
    deselectable: false,
  },
  // Root tier: programmatic value changes work in every state, including
  // `focused` — the host's select() must not depend on where focus sits.
  on: {
    SET_VALUE: { actions: [{ assign: "setValue" }] },
    CLEAR_VALUE: { actions: [{ assign: "clearValue" }] },
  },
  states: {
    idle: {
      on: {
        TAB_CLICK: { target: "focused", actions: [{ assign: "setFocused" }, { assign: "setValue" }] },
        TAB_FOCUS: { target: "focused", actions: [{ assign: "setFocused" }] },
      },
    },
    focused: {
      on: {
        TAB_CLICK: { actions: [{ assign: "setFocused" }, { assign: "setValue" }] },
        TAB_FOCUS: { actions: [{ assign: "setFocused" }] },
        TAB_BLUR: { target: "idle", actions: [{ assign: "clearFocused" }] },
        SELECT_FOCUSED: { actions: [{ assign: "selectFocused" }] },
      },
    },
  },
};

export const implementations = {
  conds: {
    selectOnFocus: (ctx: TabsContext): boolean => ctx.activationMode === "automatic",
  },
  assigns: {
    setFocused: (_ctx: TabsContext, e: TabsEvent): Partial<TabsContext> =>
      e.type === "TAB_FOCUS" || e.type === "TAB_CLICK" ? { focusedValue: e.value || null } : {},
    clearFocused: (): Partial<TabsContext> => ({ focusedValue: null }),
    setValue: (ctx: TabsContext, e: TabsEvent): Partial<TabsContext> => {
      if (e.type === "SET_VALUE") return { value: e.value };
      if (e.type !== "TAB_CLICK") return {};
      // Clicking the selected tab clears it when deselectable.
      return { value: ctx.deselectable && ctx.value === e.value ? null : e.value };
    },
    selectFocused: (ctx: TabsContext): Partial<TabsContext> => ({
      value: ctx.focusedValue,
    }),
    clearValue: (): Partial<TabsContext> => ({ value: null }),
  },
};

export type TabsService = FsmService<TabsContext, TabsEvent>;
