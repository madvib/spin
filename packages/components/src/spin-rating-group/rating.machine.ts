/**
 * Rating machine: the value, the hover preview, and which of the three
 * Zag states the group sits in.
 *
 * Zag's `idle`/`focus`/`hover` survive the port intact — unlike menu, none
 * of them exists to hold a timer. Two things change shape:
 *
 * - `focusActiveRadio` is a focus call, so it is not an action here: the
 *   connect performs it after a committing send (the fork's send is
 *   synchronous, so the new value is already in context).
 * - Zag's `isRadioFocused` guard reads `document.activeElement` to decide
 *   whether a pointer leave should land in `focus` or `idle`. The machine
 *   reads no DOM, so focus is a context scalar kept current by FOCUS/BLUR,
 *   and the guard reads that. It is the same question, answered without a
 *   document lookup.
 *
 * `value` follows Zag exactly, sentinel included: -1 means "nothing
 * selected", 0 is the empty-but-touched value, and halves are legal when
 * `allowHalf` is on. The controlled channel and the scalars the assigns read
 * (`count`, `allowHalf`) are synced by the bridge, not stored here.
 */

export interface RatingContext {
  /** The rating value; -1 when nothing is selected. */
  value: number;
  /** The previewed value while the pointer is over the group; -1 when not. */
  hoveredValue: number;
  /** The prop's `disabled` OR a disabled ancestor fieldset. */
  disabled: boolean;
  readOnly: boolean;
  /** Total number of ratings — clamped to 1 so the items are never empty. */
  count: number;
  allowHalf: boolean;
  /** Whether focus sits inside the control, which is what the leave cond reads. */
  hasFocus: boolean;
}

export type RatingEvent =
  | { type: "GROUP_POINTER_OVER" }
  | { type: "GROUP_POINTER_LEAVE" }
  | { type: "POINTER_OVER"; index: number; isMidway: boolean }
  | { type: "FOCUS" }
  | { type: "BLUR" }
  | { type: "CLICK"; value: number }
  | { type: "SPACE"; value: number }
  | { type: "ARROW_LEFT" }
  | { type: "ARROW_RIGHT" }
  | { type: "HOME" }
  | { type: "END" }
  | { type: "SET_VALUE"; value: number }
  | { type: "CLEAR_VALUE" }
  /** Zag's `watch(allowHalf)` fold: a whole-star value when halves turn off. */
  | { type: "ROUND_VALUE" }
  | { type: "FIELD_DISABLED"; disabled: boolean };

export const config = {
  id: "rating",
  initial: "idle",
  context: {
    value: -1,
    hoveredValue: -1,
    disabled: false,
    readOnly: false,
    count: 5,
    allowHalf: false,
    hasFocus: false,
  },
  // Root tier: the host's imperative writes and the fieldset channel work
  // from every state, exactly as Zag's root `on:` block does.
  on: {
    SET_VALUE: { actions: [{ assign: "setValue" }] },
    CLEAR_VALUE: { actions: [{ assign: "clearValue" }] },
    ROUND_VALUE: { actions: [{ assign: "roundValue" }] },
    FIELD_DISABLED: { actions: [{ assign: "setDisabled" }] },
  },
  states: {
    idle: {
      // Leaving hover drops the preview: the group shows the real value again.
      entry: [{ assign: "clearHovered" }],
      on: {
        GROUP_POINTER_OVER: { target: "hover" },
        FOCUS: { target: "focus", actions: [{ assign: "setFocus" }] },
        CLICK: { actions: [{ assign: "setValue" }] },
      },
    },
    focus: {
      on: {
        POINTER_OVER: { actions: [{ assign: "setHovered" }] },
        GROUP_POINTER_LEAVE: { actions: [{ assign: "clearHovered" }] },
        BLUR: { target: "idle", actions: [{ assign: "clearFocus" }] },
        // Space only commits: Zag guards it so a filled rating cannot be
        // cleared from the keyboard, which matches the radio-group contract.
        SPACE: { cond: "isValueEmpty", actions: [{ assign: "setValue" }] },
        CLICK: { actions: [{ assign: "setValue" }] },
        ARROW_LEFT: { actions: [{ assign: "setPrevValue" }] },
        ARROW_RIGHT: { actions: [{ assign: "setNextValue" }] },
        HOME: { actions: [{ assign: "setValueToMin" }] },
        END: { actions: [{ assign: "setValueToMax" }] },
      },
    },
    hover: {
      on: {
        POINTER_OVER: { actions: [{ assign: "setHovered" }] },
        // A leave while focus is inside the group is a leave of the pointer,
        // not of the rating: the keyboard state survives it.
        GROUP_POINTER_LEAVE: [
          { cond: "isControlFocused", target: "focus", actions: [{ assign: "clearHovered" }] },
          { target: "idle", actions: [{ assign: "clearHovered" }] },
        ],
        // Zag drops FOCUS in hover, which leaves the guard's answer stale for
        // a group the pointer arrived at first; recording it is the same
        // behavior with the stale answer removed.
        FOCUS: { actions: [{ assign: "setFocus" }] },
        BLUR: { actions: [{ assign: "clearFocus" }] },
        CLICK: { actions: [{ assign: "setValue" }] },
      },
    },
  },
};

// ----------------------------------------------------------- implementations

export const implementations = {
  conds: {
    isControlFocused: (ctx: RatingContext): boolean => ctx.hasFocus,
    isValueEmpty: (ctx: RatingContext): boolean => ctx.value <= 0,
  },
  assigns: {
    setValue: (ctx: RatingContext, event: RatingEvent): Partial<RatingContext> => {
      if (event.type !== "CLICK" && event.type !== "SPACE" && event.type !== "SET_VALUE") return {};
      // A live preview wins over the committed index, which is what makes a
      // half-star pick stick when the pointer is still over the item.
      const next = ctx.hoveredValue === -1 ? event.value : ctx.hoveredValue;
      return next === ctx.value ? {} : { value: next };
    },
    clearValue: (): Partial<RatingContext> => ({ value: -1 }),
    setHovered: (ctx: RatingContext, event: RatingEvent): Partial<RatingContext> => {
      if (event.type !== "POINTER_OVER") return {};
      const half = ctx.allowHalf && event.isMidway;
      return { hoveredValue: event.index - (half ? 0.5 : 0) };
    },
    clearHovered: (ctx: RatingContext): Partial<RatingContext> =>
      ctx.hoveredValue === -1 ? {} : { hoveredValue: -1 },
    setFocus: (): Partial<RatingContext> => ({ hasFocus: true }),
    clearFocus: (ctx: RatingContext): Partial<RatingContext> =>
      ctx.hasFocus ? { hasFocus: false } : {},
    setPrevValue: (ctx: RatingContext): Partial<RatingContext> => {
      const factor = ctx.allowHalf ? 0.5 : 1;
      return { value: Math.max(0, ctx.value - factor) };
    },
    setNextValue: (ctx: RatingContext): Partial<RatingContext> => {
      const factor = ctx.allowHalf ? 0.5 : 1;
      // 0, not -1: the first arrow press from empty lands on the first star.
      const from = ctx.value === -1 ? 0 : ctx.value;
      return { value: Math.min(ctx.count, from + factor) };
    },
    setValueToMin: (): Partial<RatingContext> => ({ value: 1 }),
    setValueToMax: (ctx: RatingContext): Partial<RatingContext> => ({ value: ctx.count }),
    roundValue: (ctx: RatingContext): Partial<RatingContext> =>
      ctx.allowHalf ? {} : { value: Math.round(ctx.value) },
    setDisabled: (_ctx: RatingContext, event: RatingEvent): Partial<RatingContext> =>
      event.type === "FIELD_DISABLED" ? { disabled: event.disabled } : {},
  },
};
