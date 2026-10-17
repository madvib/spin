import {
  defineComponent,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  isInteractive,
  isPressed,
  type ToggleContext,
  type ToggleEvent,
  type TogglePressedChange,
} from "./toggle.machine.ts";

/**
 * Toggle definition: the DOM contract as data. The machine owns the
 * pressed bit; this file maps props to channels, parts to attribute bags,
 * and commands to sends. Zag's anatomy is root + indicator: the root is
 * the press button itself, the indicator an optional visual swap.
 */

export interface ToggleApi {
  setPressed(pressed: boolean): void;
  readonly pressed: boolean;
  readonly disabled: boolean;
  isPressed(): boolean;
  getRootProps(): Record<string, unknown>;
  getIndicatorProps(): Record<string, unknown>;
}

const boolProp = (raw: unknown): boolean | null =>
  typeof raw === "boolean" ? raw : null;

type Ctx = ToggleContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const def: ComponentDef<ToggleContext, ToggleEvent> = {
  name: "toggle",
  config,
  implementations,
  start: "idle",
  seed: (props) => ({
    // Controlled `pressed` wins; uncontrolled falls back to
    // `defaultPressed` (an authored default alone must still press).
    pressed: boolProp(props["pressed"]) ?? boolProp(props["defaultPressed"]) ?? false,
    disabled: props["disabled"] === true,
  }),
  channels: {
    pressed: {
      controlled: true,
      parse: boolProp,
      event: (value: boolean) => ({ type: "PRESSED.SET", value }),
      equal: (current, outer) => current === outer,
    },
    defaultPressed: { parse: boolProp },
    disabled: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    label: { parse: (raw) => (typeof raw === "string" ? raw : "") },
  },
  scalars: ["disabled"],
  parts: {
    root: {
      sig: (scope) => [asCtx(scope.context).pressed, scope.props["disabled"], scope.props["dir"], scope.state].join("|"),
      attrs: (scope) => {
        const context = asCtx(scope.context);
        const pressed = isPressed(context);
        const itemDisabled = scope.props["disabled"] === true;
        return {
          id: scope.id("root"),
          type: "button",
          dir: scope.props["dir"],
          role: undefined,
          "aria-pressed": pressed ? "true" : "false",
          "aria-label": (scope.props["label"] as string).length > 0 ? scope.props["label"] : undefined,
          "data-scope": "toggle",
          "data-part": "root",
          "data-disabled": scope.attr(itemDisabled),
          "data-state": pressed ? "on" : "off",
          disabled: itemDisabled ? true : undefined,
          onClick: (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            if (!isInteractive(context)) return;
            scope.send({ type: "PRESS" });
          },
        };
      },
    },
    indicator: {
      sig: (scope) => [asCtx(scope.context).pressed, scope.state].join("|"),
      attrs: (scope) => {
        const pressed = isPressed(asCtx(scope.context));
        return {
          id: scope.id("indicator"),
          "data-scope": "toggle",
          "data-part": "indicator",
          "data-state": pressed ? "on" : "off",
          "aria-hidden": "true",
        };
      },
    },
  },
  commands: {
    setPressed: { event: (args) => ({ type: "PRESSED.SET", value: args[0] as boolean }) },
  },
  readers: {
    pressed: { read: (context) => asCtx(context).pressed },
    disabled: { read: (context) => asCtx(context).disabled },
  },
  methods: {
    isPressed: {
      call: (context) => isPressed(asCtx(context)),
    },
  },
  events: {
    "pressed-change": {
      prop: "onPressedChange",
      watch: (context) => [asCtx(context).pressed],
      detail: (watched) => ({ pressed: watched[0] as boolean }),
    },
  },
};

export const toggle = defineComponent(def);
export type { TogglePressedChange };
export type ToggleValueChange = TogglePressedChange;
