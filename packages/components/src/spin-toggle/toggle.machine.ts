/**
 * Toggle machine: a single two-state press button. The machine owns the
 * pressed bit and the disabled flag; the def maps props, bags, and
 * commands onto them. Controlled `pressed` wins; uncontrolled falls back
 * to `defaultPressed` at seed.
 */

export interface ToggleContext {
  pressed: boolean;
  disabled: boolean;
}

export type ToggleEvent =
  | { type: "PRESS" }
  | { type: "PRESSED.SET"; value: boolean }
  | { type: "SET_DISABLED"; disabled: boolean };

export type TogglePressedChange = {
  readonly pressed: boolean;
};

const assignPressed = (pressed: boolean): Partial<ToggleContext> => ({ pressed });

export const config = {
  id: "toggle",
  initial: "idle",
  context: {
    pressed: false,
    disabled: false,
  },
  states: {
    idle: {
      on: {
        PRESS: { actions: [{ assign: "togglePressed" }] },
      },
    },
  },
  on: {
    "PRESSED.SET": { actions: [{ assign: "setPressed" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
  },
};

export const implementations = {
  conds: {},
  assigns: {
    togglePressed: (ctx: ToggleContext): Partial<ToggleContext> => assignPressed(!ctx.pressed),
    setPressed: (_ctx: ToggleContext, event: ToggleEvent): Partial<ToggleContext> => {
      if (event.type !== "PRESSED.SET") return {};
      return assignPressed(event.value);
    },
    setDisabled: (_ctx: ToggleContext, event: ToggleEvent): Partial<ToggleContext> => {
      if (event.type !== "SET_DISABLED") return {};
      return { disabled: event.disabled };
    },
  },
};

/** Zag's pressed guard, pure: interaction needs an enabled machine. */
export function isInteractive(ctx: ToggleContext): boolean {
  return ctx.disabled !== true;
}

/** Zag's pressed read, pure: the view's `data-state` and `aria-pressed`. */
export function isPressed(ctx: ToggleContext): boolean {
  return ctx.pressed === true;
}
