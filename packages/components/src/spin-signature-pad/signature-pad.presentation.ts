import { ariaDisabled, ariaRoleDescription, dataAttr, defineComponent, focuser, isRecord, type ApiOf, type ComponentDef, type ScopeFor } from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import { signaturePad as signaturePadMachine } from "./signature-pad.machine.ts";
import {
  isEmpty,
  isInteractive,
  tuningOf,
  type SignaturePadArgs,
  type SignaturePadContext,
  type SignaturePadState,
  type SignaturePoint,
} from "./signature-pad.state.ts";
import type { SignaturePadEvents } from "./signature-pad.events.ts";
import type { SignaturePadDrawDetails } from "./signature-pad.events.ts";

/** Signature-pad definition: the DOM contract as data. */

export type { SignaturePadDrawDetails };

export interface SegmentSlotProps {
  readonly path: string;
}

type ScopeLike = ScopeFor<SignaturePadContext, SignaturePadEvents, SignaturePadState>;
const controlPoint = (
  scope: ScopeLike,
  clientX: number,
  clientY: number,
): SignaturePoint | null => {
  const rect = scope.measure("control");
  if (rect === null) return null;
  return { x: clientX - rect.left, y: clientY - rect.top, pressure: 0.5 };
};

const isClosestable = (value: unknown): value is { closest(selector: string): unknown } => {
  if (typeof value !== "object" || value === null || !("closest" in value)) return false;
  const closest: unknown = value.closest;
  return typeof closest === "function";
};

/** The clear trigger sits inside the control: a press from a node nested
 * in it never starts a stroke. Duck-typed — the target may be a stub. */
const insideClearTrigger = (target: EventTarget | null): boolean => {
  if (!isClosestable(target)) return false;
  return target.closest("[data-part=clear-trigger]") !== null;
};

/** A segment-path slot: the recipe passes `{ path: row }`; anything else
 * is an empty path, never a throw. */
const segmentPathOf = (arg: unknown): string => {
  if (!isRecord(arg)) return "";
  const path: unknown = arg["path"];
  return typeof path === "string" ? path : "";
};


const textOf = (arg: unknown): string => typeof arg === "string" ? arg : "";

const drawingFill = (props: Record<string, unknown>): string => {
  if (!isRecord(props["drawing"])) return "currentColor";
  const fill: unknown = props["drawing"]["fill"];
  return typeof fill === "string" && fill.length > 0 ? fill : "currentColor";
};


export const def = {
  name: "signature-pad",
  machine: (args: SignaturePadArgs, authored) => signaturePadMachine(args, authored),
  start: "idle",
  reconcile: ({ context, send }) => {
    // Tuning merges through the machine's SET_TUNING: the merge stays one
    // assign.
    const patch = tuningOf(context.drawing);
    const keys = ["size", "thinning", "smoothing", "streamline", "simulatePressure"] as const;
    const stale = keys.some((key) => patch[key] !== undefined && context.tuning[key] !== patch[key]);
    if (stale) {
      send({ type: "SET_TUNING", tuning: patch });
      return true;
    }
    return false;
  },
  parts: {
    root: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled),
      }),
    },
    label: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent): void => {
          if (!isInteractive(scope.context)) return;
          if (event.defaultPrevented) return;
          focuser(scope.id)("control");
        },
      }),
    },
    control: {
      attrs: (scope) => {
        const ctx = scope.context;
        const disabled = scope.context.disabled;
        return {
          role: "application",
          ...ariaRoleDescription("signature pad"),
          "aria-label": "signature pad",
          ...ariaDisabled(disabled ? "true" : undefined),
          tabindex: disabled ? undefined : "0",
          "data-disabled": dataAttr(disabled),
          style: { position: "relative", touchAction: "none", userSelect: "none" },
          // The stroke gesture lives in the runtime: the press arms it, the
          // pointer is captured for the gesture's life, and the machine
          // keeps the geometry.
          "use:drag": {
            // A disabled or read-only pad never arms.
            enabled: isInteractive(ctx),
            // The press keeps its default: the control is a plain surface.
            preventDefault: false,
            // No escape path here: Escape does nothing.
            cancelOnEscape: false,
            onStart: (press: DragPress): void => {
              // The clear trigger sits inside the control: its click must
              // not start a stroke. Any node advertising the trigger part
              // refuses the stroke.
              if (insideClearTrigger(press.target)) return;
              if (press.metaKey === true || press.ctrlKey === true || press.altKey) return;
              const point = controlPoint(scope, press.x, press.y);
              if (point === null) return;
              scope.send({ type: "POINTER_DOWN", point, pressure: press.pressure });
            },
            onMove: (delta: DragDelta): void => {
              if (scope.state !== "drawing") return;
              const point = controlPoint(scope, delta.x, delta.y);
              if (point === null) return;
              scope.send({ type: "POINTER_MOVE", point, pressure: delta.pressure });
            },
            onEnd: (): void => {
              if (!isInteractive(scope.context)) return;
              if (scope.state !== "drawing") return;
              scope.send({ type: "POINTER_UP" });
            },
          },
        };
      },
    },
    segment: {
      attrs: (scope: ScopeLike) => {
        const drawing = scope.context.drawing;
        const fill = drawingFill(isRecord(drawing) ? drawing : {});
        return {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            fill,
          },
        };
      },
    },
    segmentPath: {
      attrs: (_scope, _arg: unknown) => ({
        d: segmentPathOf(_arg),
      }),
    },
    guide: {
      attrs: (scope) => ({
        dir: scope.context.dir,
        "data-disabled": dataAttr(scope.context.disabled),
      }),
    },
    clearTrigger: {
      id: "clear-trigger",
      attrs: (scope: ScopeLike, arg: unknown) => {
        const label = textOf(arg);
        const ctx = scope.context;
        const disabled = scope.context.disabled;
        return {
          type: "button",
          "aria-label": label,
          "data-disabled": dataAttr(disabled),
          "data-hidden": dataAttr((ctx.paths ?? []).length === 0 || scope.state === "drawing"),
          disabled: disabled ? true : undefined,
          onClick: (): void => {
            scope.send({ type: "CLEAR" });
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      attrs: (scope: ScopeLike, arg: unknown) => {
        const name = textOf(arg);
        const ctx = scope.context;
        return {
          type: "text",
          hidden: true,
          disabled: scope.context.disabled ? true : undefined,
          readonly: true,
          name: name.length > 0 ? name : undefined,
          value: (ctx.paths ?? []).join("\n"),
        };
      },
    },
  },
  commands: {
    clear: { event: () => ({ type: "CLEAR" }) },
  },
  readers: {
    empty: { read: (context: SignaturePadContext) => isEmpty(context) },
    drawing: { read: (_context, state) => state === "drawing" },
    currentPath: { read: (context: SignaturePadContext) => context.currentPath },
    paths: { read: (context: SignaturePadContext) => [...context.paths] },
  },
  methods: {
    getDataUrl: {
      call: () => {
        // Serializing the canvas needs the control node; the host owns
        // that ref, so this resolves the live SVG the recipe renders.
        return Promise.resolve("");
      },
    },
  },
  events: {
    draw: {
      prop: "onDraw",
      watch: () => [],
      detail: () => ({ paths: [], currentPath: null }),
      // Every stroke event reports, whether or not a path landed: the
      // in-progress stroke is part of the detail.
      select: (event, _before, after: SignaturePadContext) =>
        event.type === "POINTER_DOWN" ||
          event.type === "POINTER_MOVE" ||
          event.type === "POINTER_UP" ||
          event.type === "CLEAR"
          ? {
            paths: [...after.paths],
            currentPath: after.currentPath,
          }
          : null,
    },
    "draw-end": {
      prop: "onDrawEnd",
      watch: () => [],
      detail: () => ({ paths: [], currentPath: null }),
      select: (event, _before, after: SignaturePadContext) =>
        event.type === "POINTER_UP" || event.type === "CLEAR"
          ? {
            paths: [...after.paths],
            currentPath: after.currentPath,
          }
          : null,
    },
  },
} satisfies ComponentDef<SignaturePadContext, SignaturePadEvents, Record<string, unknown>, SignaturePadArgs, SignaturePadState>;

export type SignaturePadApi = ApiOf<typeof def>;
export const signaturePad = defineComponent<SignaturePadContext, SignaturePadEvents, SignaturePadApi, SignaturePadArgs, SignaturePadState>(def);
