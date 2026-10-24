import { defaultTwin, isRecord } from "@spin/runtime";

export type FloatingPanelState = "closed" | "open" | "dragging" | "resizing";

export type FloatingPanelStage = "minimized" | "maximized" | "restored";

export interface FloatingPanelSize {
  readonly w: number;
  readonly h: number;
}

export interface FloatingPanelContext {
  position: { readonly x: number; readonly y: number };
  size: FloatingPanelSize;
  restoreSize: FloatingPanelSize | null;
  restorePosition: { readonly x: number; readonly y: number } | null;
  stage: FloatingPanelStage;
  dragFrom: { readonly x: number; readonly y: number } | null;
  minSize: FloatingPanelSize;
  maxSize: FloatingPanelSize;
  resizeFrom: {
    readonly size: FloatingPanelSize;
    readonly position: { readonly x: number; readonly y: number };
  } | null;
  axis: { readonly x: -1 | 0 | 1; readonly y: -1 | 0 | 1 } | null;
  draggable: boolean;
  resizable: boolean;
  closeOnEscape: boolean;
  boundary: { readonly w: number; readonly h: number };
  label: string;
  disabled: boolean;
}

export interface FloatingPanelArgs {
  size?: string;
  minSize?: string;
  maxSize?: string;
  stage?: string;
  draggable?: boolean;
  resizable?: boolean;
  closeOnEscape?: boolean;
  defaultCloseOnEscape?: boolean;
  label?: string;
  disabled?: boolean;
  defaultLabel?: string;
  defaultDisabled?: boolean;
}

export function sizeOf(raw: unknown): FloatingPanelSize | null {
  const shape = (value: unknown): FloatingPanelSize | null => {
    if (!isRecord(value)) return null;
    const w: unknown = value["w"];
    const h: unknown = value["h"];
    return typeof w === "number" && typeof h === "number" ? { w, h } : null;
  };
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      return shape(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return shape(raw);
}

const DEFAULT_SIZE: FloatingPanelSize = { w: 360, h: 240 };
const DEFAULT_MIN: FloatingPanelSize = { w: 120, h: 80 };
const DEFAULT_MAX: FloatingPanelSize = { w: 1024, h: 768 };

export function initial(
  args: FloatingPanelArgs = {},
  authored: (name: string) => boolean,
): FloatingPanelContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const stage: unknown = args.stage;
  return {
    position: { x: 0, y: 0 },
    size: written("size") ? sizeOf(args.size) ?? DEFAULT_SIZE : DEFAULT_SIZE,
    restoreSize: null,
    restorePosition: null,
    stage: stage === "minimized" || stage === "maximized" ? stage : "restored",
    dragFrom: null,
    minSize: sizeOf(args.minSize) ?? DEFAULT_MIN,
    maxSize: sizeOf(args.maxSize) ?? DEFAULT_MAX,
    resizeFrom: null,
    axis: null,
    draggable: written("draggable") ? args.draggable !== false : true,
    resizable: written("resizable") ? args.resizable !== false : true,
    closeOnEscape: written("closeOnEscape")
      ? args.closeOnEscape !== false
      : true,
    boundary: { w: 1024, h: 768 },
    label: written("label") ? args.label ?? "" : "",
    disabled: written("disabled") ? args.disabled === true : false,
  };
}

export function startOpen(
  raw: Record<string, unknown>,
  authored: (name: string) => boolean,
): boolean {
  return authored("open") ? raw["open"] === true : raw["defaultOpen"] === true;
}

export function clampPosition(
  ctx: FloatingPanelContext,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const maxX = Math.max(0, ctx.boundary.w - ctx.size.w);
  const maxY = Math.max(0, ctx.boundary.h - ctx.size.h);
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY),
  };
}
