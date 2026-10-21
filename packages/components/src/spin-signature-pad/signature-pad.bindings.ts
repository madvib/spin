import { ariaDisabled, ariaRoleDescription, dataAttr, defineComponent, factAttrs, focuser, isRecord, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import type { DragDelta, DragPress } from "@spin/runtime/actions";
import {
  isEmpty,
  isInteractive,
  signaturePad as signaturePadMachine,
  tuningOf,
  type DrawingTuning,
  type SignaturePadArgs,
  type SignaturePadContext,
  type SignaturePadDrawDetails,
  type SignaturePadEvents,
  type SignaturePoint,
} from "./signature-pad.machine.ts";

/** Signature-pad definition: the DOM contract as data. */

export type { SignaturePadDrawDetails };

export interface SegmentSlotProps {
  readonly path: string;
}

export interface SignaturePadApi {
  readonly empty: boolean;
  readonly drawing: boolean;
  readonly currentPath: string | null;
  readonly paths: readonly string[];
  clear(): void;
  getDataUrl(type: string, quality?: number): Promise<string>;
  getRootProps(): Record<string, unknown>;
  getLabelProps(label: string): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getSegmentProps(): Record<string, unknown>;
  getSegmentPathProps(props: SegmentSlotProps): Record<string, unknown>;
  getGuideProps(): Record<string, unknown>;
  getClearTriggerProps(label: string): Record<string, unknown>;
  getHiddenInputProps(name: string): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, SignaturePadContext> {}

interface SlotLike<R> extends SlotScope<R, SignaturePadContext> {}

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

/** The component's public state: the names the markup may key on. */
export const facts = {
  drawing: (scope: ScopeLike) => scope.state === "drawing",
};

const def: ComponentDef<SignaturePadContext, SignaturePadEvents> = {
  name: "signature-pad",
  machine: (props, authored) => signaturePadMachine(props as SignaturePadArgs, authored),
  reconcile: ({ context, parsed, send }) => {
    // Tuning merges through the machine's SET_TUNING: the merge stays one
    // assign.
    const patch = tuningOf(parsed["drawing"]);
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
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "root",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    label: {
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "label",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
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
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("control"),
          role: "application",
          ...ariaRoleDescription("signature pad"),
          "aria-label": "signature pad",
          ...ariaDisabled(disabled ? "true" : undefined),
          tabindex: disabled ? undefined : "0",
          "data-scope": "signature-pad",
          "data-part": "control",
          "data-disabled": dataAttr(disabled),
          ...factAttrs(scope, facts, "drawing"),
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
        const fill = drawingFill(scope.props);
        return {
          "data-scope": "signature-pad",
          "data-part": "segment",
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
        "data-scope": "signature-pad",
        "data-part": "segment-path",
        d: segmentPathOf(_arg),
      }),
    },
    guide: {
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "guide",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    clearTrigger: {
      id: "clear-trigger",
      attrs: (scope: ScopeLike, arg: unknown) => {
        const label = textOf(arg);
        const ctx = scope.context;
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("clear-trigger"),
          type: "button",
          "aria-label": label,
          "data-scope": "signature-pad",
          "data-part": "clear-trigger",
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
          id: scope.id("hiddenInput"),
          type: "text",
          hidden: true,
          disabled: scope.props["disabled"] === true ? true : undefined,
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
};

export const signaturePad = defineComponent<SignaturePadContext, SignaturePadEvents, SignaturePadApi>(def);
