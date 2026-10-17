import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  isEmpty,
  isInteractive,
  type SignaturePadContext,
  type SignaturePadDrawDetails,
  type SignaturePadEvent,
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

// Scope props arrive as strings; hooks write numbers. Accept both — a
// string-authored `defaultValue="45"` seeds 45, not 0.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const boolProp = (raw: unknown): boolean => raw === true;

/** Paths travel the prop channel as JSON: the grammar types an array
 * either as `string[]` (whose default coercion produces `["[]"]` for
 * `= []`) or as a JSON string, so both spellings parse and anything else
 * is no paths. */
const pathsProp = (raw: unknown): string[] | null => {
  if (Array.isArray(raw)) {
    return raw.every((item) => typeof item === "string") ? [...(raw as string[])] : null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? [...(parsed as string[])]
      : null;
  } catch {
    return null;
  }
};

const samePaths = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((path, index) => path === b[index]);

type Ctx = SignaturePadContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const controlPoint = (
  control: Element | null,
  clientX: number,
  clientY: number,
): SignaturePoint | null => {
  if (control === null || typeof control.getBoundingClientRect !== "function") return null;
  const rect = control.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top, pressure: 0.5 };
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

const def: ComponentDef<SignaturePadContext, SignaturePadEvent> = {
  name: "signature-pad",
  config,
  implementations,
  seed: (props, authored) => {
    const seeded = authored("paths") ? pathsProp(props["paths"]) : pathsProp(props["defaultPaths"]);
    const drawing = props["drawing"];
    const tuning: Record<string, unknown> = {};
    if (typeof drawing === "object" && drawing !== null) {
      const d = drawing as Record<string, unknown>;
      const size = numProp(d["size"]);
      const thinning = numProp(d["thinning"]);
      const smoothing = numProp(d["smoothing"]);
      const streamline = numProp(d["streamline"]);
      const simulate = d["simulatePressure"];
      if (size !== null) tuning["size"] = size;
      if (typeof simulate === "boolean") tuning["simulatePressure"] = simulate;
      if (thinning !== null) tuning["thinning"] = thinning;
      if (smoothing !== null) tuning["smoothing"] = smoothing;
      if (streamline !== null) tuning["streamline"] = streamline;
    }
    const fill = typeof drawing === "object" && drawing !== null &&
        typeof (drawing as Record<string, unknown>)["fill"] === "string" &&
        ((drawing as Record<string, unknown>)["fill"] as string).length > 0
      ? ((drawing as Record<string, unknown>)["fill"] as string)
      : "currentColor";
    return {
      paths: seeded ?? [],
      disabled: boolProp(props["disabled"]),
      readOnly: boolProp(props["readOnly"]),
      tuning,
      fill,
    };
  },
  channels: {
    paths: {
      controlled: true,
      parse: pathsProp,
      nullable: true,
      event: (value: readonly string[] | null) => ({
        type: "SET_PATHS",
        paths: value === null ? [] : [...value],
      }),
      equal: (current, outer) => {
        if (current === null || current === undefined || outer === null || outer === undefined) {
          return current == null && outer == null;
        }
        return samePaths(current as string[], outer as string[]);
      },
    },
    defaultPaths: { parse: pathsProp },
    disabled: { parse: boolProp },
    readOnly: { parse: boolProp },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    drawing: { parse: (raw) => raw },
  },
  scalars: ["disabled", "readOnly"],
  reconcile: ({ context, parsed }) => {
    const ctx = asCtx(context);
    // Tuning merges straight in: it shapes the stroke renderer, and no
    // machine event owns it.
    const drawing = parsed["drawing"];
    if (typeof drawing !== "object" || drawing === null) return false;
    const d = drawing as Record<string, unknown>;
    const tuning = ctx.tuning as unknown as Record<string, unknown>;
    let moved = false;
    for (const key of ["size", "thinning", "smoothing", "streamline"] as const) {
      const value = numProp(d[key]);
      if (value !== null && tuning[key] !== value) {
        tuning[key] = value;
        moved = true;
      }
    }
    if (typeof d["simulatePressure"] === "boolean" && tuning["simulatePressure"] !== d["simulatePressure"]) {
      tuning["simulatePressure"] = d["simulatePressure"];
      moved = true;
    }
    return moved;
  },
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
      sig: (scope, arg) => [`${arg}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        dir: scope.props["dir"],
        "data-scope": "signature-pad",
        "data-part": "label",
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        for: scope.id("hiddenInput"),
        onClick: (event: MouseEvent): void => {
          if (!isInteractive(asCtx(scope.context))) return;
          if (event.defaultPrevented) return;
          if (typeof document !== "undefined") {
            document.getElementById(scope.id("control"))?.focus({ preventScroll: true });
          }
        },
      }),
    },
    control: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.state, scope.props["disabled"], ctx.disabled, ctx.readOnly].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
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
            // not start a stroke.
            const target = event.target as Element | null;
            if (target !== null && typeof target.closest === "function") {
              if (target.closest("[data-part=clear-trigger]") !== null) return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (!isInteractive(ctx)) return;
            const control = typeof document !== "undefined"
              ? document.getElementById(scope.id("control"))
              : null;
            if (control === null) return;
            const point = controlPoint(control, event.clientX, event.clientY);
            if (point === null) return;
            (event.currentTarget as Capturable | null)?.setPointerCapture?.(event.pointerId);
            scope.send({ type: "POINTER_DOWN", point, pressure: event.pressure });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "drawing") return;
            const control = typeof document !== "undefined"
              ? document.getElementById(scope.id("control"))
              : null;
            if (control === null) return;
            const point = controlPoint(control, event.clientX, event.clientY);
            if (point === null) return;
            scope.send({ type: "POINTER_MOVE", point, pressure: event.pressure });
          },
          onPointerup: (event: PointerEvent): void => {
            if (!isInteractive(asCtx(scope.context))) return;
            if (event.currentTarget instanceof Element) {
              const capturable = event.currentTarget as Capturable;
              try {
                (capturable as unknown as { hasPointerCapture?: (id: number) => boolean })
                  .hasPointerCapture?.(event.pointerId);
              } catch {
                // A node without capture support releases nothing.
              }
            }
            if (scope.state !== "drawing") return;
            scope.send({ type: "POINTER_UP" });
          },
        };
      },
    },
    segment: {
      sig: (scope) => [`${(scope.props["drawing"] as Record<string, unknown> | undefined)?.["fill"] ?? "currentColor"}`].join(" "),
      attrs: (scope) => {
        const drawing = scope.props["drawing"];
        const fill = typeof drawing === "object" && drawing !== null &&
            typeof (drawing as Record<string, unknown>)["fill"] === "string" &&
            ((drawing as Record<string, unknown>)["fill"] as string).length > 0
          ? ((drawing as Record<string, unknown>)["fill"] as string)
          : "currentColor";
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
      sig: (scope, arg) => `${(arg as SegmentSlotProps).path}`,
      attrs: (scope, arg) => {
        const slots = arg as SegmentSlotProps;
        return {
          "data-scope": "signature-pad",
          "data-part": "segment-path",
          d: slots.path,
        };
      },
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
      sig: (scope, arg) => {
        const ctx = asCtx(scope.context);
        return [`${arg}`, scope.state, (ctx.paths ?? []).length, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope, arg) => {
        const label = arg as string;
        const ctx = asCtx(scope.context);
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("clearTrigger"),
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
      sig: (scope, arg) => {
        const ctx = asCtx(scope.context);
        return [`${arg}`, (ctx.paths ?? []).length, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope, arg) => {
        const name = arg as string;
        const ctx = asCtx(scope.context);
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
    empty: { read: (context) => isEmpty(context as unknown as Ctx) },
    drawing: { read: (_context, state) => state === "drawing" },
    currentPath: { read: (context) => (context as unknown as Ctx).currentPath },
    paths: { read: (context) => [...(context as unknown as Ctx).paths] },
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
      detail: (watched) => ({ paths: watched as string[], currentPath: null }),
      // Every stroke event reports, whether or not a path landed: the
      // in-progress stroke is part of the detail.
      select: (event, _before, after) =>
        event.type === "POINTER_DOWN" ||
          event.type === "POINTER_MOVE" ||
          event.type === "POINTER_UP" ||
          event.type === "CLEAR"
          ? {
            paths: [...(after as unknown as Ctx).paths],
            currentPath: (after as unknown as Ctx).currentPath,
          }
          : null,
    },
    "draw-end": {
      prop: "onDrawEnd",
      watch: () => [],
      detail: (watched) => ({ paths: watched as string[], currentPath: null }),
      // Commit (release) and clear only.
      select: (event, _before, after) =>
        event.type === "POINTER_UP" || event.type === "CLEAR"
          ? {
            paths: [...(after as unknown as Ctx).paths],
            currentPath: (after as unknown as Ctx).currentPath,
          }
          : null,
    },
  },
};

export const signaturePad = defineComponent<SignaturePadContext, SignaturePadEvent, SignaturePadApi>(def);
