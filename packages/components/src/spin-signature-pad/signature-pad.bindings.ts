import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  isEmpty,
  isInteractive,
  pathsOf,
  samePaths,
  tuningOf,
  type DrawingTuning,
  type SignaturePadContext,
  type SignaturePadDrawDetails,
  type SignaturePadEvent,
  type SignaturePadInitial,
  type SignaturePoint,
} from "./signature-pad.machine.ts";

/**
 * Signature-pad definition: the DOM contract as data. The machine owns
 * the two phases, the committed paths and the in-progress stroke; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and draw/draw-end transitions to their events.
 *
 * Everything that needs a node lives here — the control-relative point
 * measurement (reported in as events, because the machine never touches
 * the DOM), pointer capture (an off-node release must still end the
 * stroke), and the guide affordance.
 */

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

/** Transport guarantees the raw prop bag is a SignaturePadInitial-shaped object. */
const isSignaturePadInitial = (raw: unknown): raw is SignaturePadInitial =>
  raw !== null && typeof raw === "object";

const controlPoint = (
  scope: ScopeLike,
  clientX: number,
  clientY: number,
): SignaturePoint | null => {
  const rect = scope.measure("control");
  if (rect === null) return null;
  return { x: clientX - rect.left, y: clientY - rect.top, pressure: 0.5 };
};

const isCapturable = (value: unknown): value is Element & { setPointerCapture(id: number): void } => {
  if (!(value instanceof Element) || !("setPointerCapture" in value)) return false;
  const fn: unknown = value.setPointerCapture;
  return typeof fn === "function";
};

const capturePointer = (target: EventTarget | null, pointerId: number): void => {
  if (isCapturable(target)) target.setPointerCapture(pointerId);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

/** The view reflex: the control takes focus. */
const focusControl = (id: (part: string, slot?: unknown) => string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id("control"))?.focus({ preventScroll: true });
};

/** The stroke fill off the opaque `drawing` prop: a non-empty fill, else
 * the canvas default. The recipe paints the stroke; this names the paint. */
const textOf = (arg: unknown): string => typeof arg === "string" ? arg : "";

const drawingFill = (props: Record<string, unknown>): string => {
  if (!isRecord(props["drawing"])) return "currentColor";
  const fill: unknown = props["drawing"]["fill"];
  return typeof fill === "string" && fill.length > 0 ? fill : "currentColor";
};

const def: ComponentDef<SignaturePadContext, SignaturePadEvent> = {
  name: "signature-pad",
  config,
  implementations,
  seed: (raw, _authored) => {
    const props: SignaturePadInitial = isSignaturePadInitial(raw) ? raw : {};
    const shaped = initial(props);
    return { ...shaped, currentPoints: [], currentPath: null };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    // Tuning merges through the machine's SET_TUNING: it shapes the
    // stroke renderer, and the merge stays one assign.
    const patch = tuningOf(parsed["drawing"]);
    const keys = ["size", "thinning", "smoothing", "streamline", "simulatePressure"] as const;
    const stale = keys.some((key) => patch[key] !== undefined && context.tuning[key] !== patch[key]);
    if (stale) {
      send({ type: "SET_TUNING", tuning: patch });
      return true;
    }
    if (authored("paths")) {
      const outer = pathsOf(parsed["paths"]);
      if (!samePaths(context.paths, outer)) {
        send({ type: "SET_PATHS", paths: [...outer] });
        return true;
      }
    }
    return false;
  },
  scalars: ["disabled", "readOnly"],
  parts: {
    root: {
      sig: (scope) => [scope.props["dir"], `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "root",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    label: {
      sig: (scope, _arg: unknown) => [`${scope.props["dir"]}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "label",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent): void => {
          if (!isInteractive(scope.context)) return;
          if (event.defaultPrevented) return;
          focusControl(scope.id);
        },
      }),
    },
    control: {
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.state, scope.props["disabled"], ctx.disabled, ctx.readOnly].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("control"),
          role: "application",
          "aria-roledescription": "signature pad",
          "aria-label": "signature pad",
          "aria-disabled": disabled ? "true" : undefined,
          tabindex: disabled ? undefined : "0",
          "data-scope": "signature-pad",
          "data-part": "control",
          "data-disabled": dataAttr(disabled),
          "data-drawing": dataAttr(scope.state === "drawing"),
          style: { position: "relative", touchAction: "none", userSelect: "none" },
          onPointerdown: (event: PointerEvent): void => {
            // The clear trigger sits inside the control: its click must
            // not start a stroke. The target may be a stub (tests) — any
            // node advertising the trigger part refuses the stroke.
            if (insideClearTrigger(event.target)) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (!isInteractive(ctx)) return;
            const point = controlPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            capturePointer(event.currentTarget, event.pointerId);
            scope.send({ type: "POINTER_DOWN", point, pressure: event.pressure });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "drawing") return;
            const point = controlPoint(scope, event.clientX, event.clientY);
            if (point === null) return;
            scope.send({ type: "POINTER_MOVE", point, pressure: event.pressure });
          },
          onPointerup: (event: PointerEvent): void => {
            if (!isInteractive(scope.context)) return;
            capturePointer(event.currentTarget, event.pointerId);
            if (scope.state !== "drawing") return;
            scope.send({ type: "POINTER_UP" });
          },
        };
      },
    },
    segment: {
      sig: (scope: ScopeLike) => [drawingFill(scope.props)].join(" "),
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
      sig: (_scope, arg: unknown) => `${segmentPathOf(arg)}`,
      attrs: (_scope, _arg: unknown) => ({
        "data-scope": "signature-pad",
        "data-part": "segment-path",
        d: segmentPathOf(_arg),
      }),
    },
    guide: {
      sig: (scope) => [`${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "guide",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    clearTrigger: {
      id: "clear-trigger",
      sig: (scope: ScopeLike, arg: unknown) => {
        const ctx = scope.context;
        return [`${textOf(arg)}`, scope.state, ctx.paths.length, `${scope.props["disabled"] === true}`].join(" ");
      },
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
      sig: (scope: ScopeLike, arg: unknown) => {
        const ctx = scope.context;
        return [`${textOf(arg)}`, ctx.paths.length, `${scope.props["disabled"] === true}`].join(" ");
      },
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
        // that ref, so this resolves the live SVG the recipe renders
        // instead.
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
      // Commit (release) and clear only.
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

export const signaturePad = defineComponent<SignaturePadContext, SignaturePadEvent, SignaturePadApi>(def);
