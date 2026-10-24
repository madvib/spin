import { defaultTwin, isRecord } from "@spin/runtime";
import type { CarouselEvents } from "./carousel.events.ts";

export interface CarouselSlide {
  readonly value: string;
  readonly label: string;
  readonly content: string;
  readonly image?: string | undefined;
  readonly avatar?: string | undefined;
}

export const slidesOf = (raw: unknown): readonly CarouselSlide[] => {
  if (!Array.isArray(raw)) return [];
  const slides: CarouselSlide[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const value: unknown = entry["value"];
    if (typeof value !== "string") continue;
    const label: unknown = entry["label"];
    const content: unknown = entry["content"];
    const image: unknown = entry["image"];
    const avatar: unknown = entry["avatar"];
    slides.push({
      value,
      label: typeof label === "string" ? label : "",
      content: typeof content === "string" ? content : "",
      ...(typeof image === "string" ? { image } : {}),
      ...(typeof avatar === "string" ? { avatar } : {}),
    });
  }
  return slides;
};

export type CarouselDragStatus = "idle" | "focus" | "dragging" | "settling";

export type CarouselState = "idle" | "autoplay";

export interface CarouselContext {
  index: number;
  pageCount: number;
  slidesInView: number[];
  focused: boolean;
  focusedId: string | null;
  dragStatus: CarouselDragStatus;
  loop: boolean;
  perMove: number;
  slideParams: {
    readonly perMove: number;
    readonly slidesPerPage: number;
    readonly autoSize: boolean;
    readonly slideCount: number;
  };
  slides: readonly CarouselSlide[];
  orientation: "horizontal" | "vertical";
  allowMouseDrag: boolean;
  autoplayDelay: number;
  dir: string;
  inViewThreshold: number;
  autoSize: boolean;
  slidesPerPage: number;
}

const lastPage = (pageCount: number): number => Math.max(0, pageCount - 1);
const cycle = (pageCount: number): number => Math.max(1, pageCount);
export const clampIndex = (index: number, pageCount: number): number => {
  const last = lastPage(pageCount);
  return index < 0 ? 0 : index > last ? last : Math.trunc(index);
};

const asInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;

export const slidesPerPageOf = (raw: unknown): number =>
  Math.max(1, asInt(raw, 1));

export const slidesPerMoveOf = (raw: unknown, perPage: number): number => {
  const parsed = typeof raw === "string"
    ? Number.parseInt(raw, 10)
    : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : perPage;
};

export interface CarouselArgs {
  index?: number;
  loop?: boolean;
  items?: readonly unknown[];
  slidesPerPage?: number;
  slidesPerMove?: string;
  autoSize?: boolean;
  defaultLoop?: boolean;
  orientation?: "horizontal" | "vertical";
  allowMouseDrag?: boolean;
  autoplayDelay?: number;
  dir?: string;
  inViewThreshold?: number;
}

export function initial(
  args: CarouselArgs,
  authored: (name: string) => boolean,
): CarouselContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const slidesPerPage = slidesPerPageOf(args.slidesPerPage);
  const perMove = slidesPerMoveOf(args.slidesPerMove, slidesPerPage);
  const autoSize = args.autoSize === true;
  const slideCount = slidesOf(args.items).length;
  const pageCount = pageCountFor(slideCount, perMove, slidesPerPage, autoSize);
  const last = Math.max(0, pageCount - 1);
  const at = written("index") ? asInt(args.index, 0) : 0;
  return {
    index: Math.min(Math.max(0, at), last),
    pageCount,
    slidesInView: [],
    focused: false,
    focusedId: null,
    dragStatus: "idle",
    loop: written("loop") ? args.loop === true : false,
    perMove,
    slideParams: { perMove, slidesPerPage, autoSize, slideCount },
    slides: slidesOf(args.items),
    orientation: args.orientation === "vertical" ? "vertical" : "horizontal",
    allowMouseDrag: args.allowMouseDrag === true,
    autoplayDelay: typeof args.autoplayDelay === "number"
      ? args.autoplayDelay
      : 4000,
    dir: typeof args.dir === "string" ? args.dir : "ltr",
    inViewThreshold: typeof args.inViewThreshold === "number"
      ? args.inViewThreshold
      : 60,
    autoSize,
    slidesPerPage,
  };
}

export function pageCountFor(
  slideCount: number,
  perMove: number,
  slidesPerPage: number,
  autoSize: boolean,
): number {
  const total = Math.max(0, Math.trunc(slideCount));
  if (autoSize) return total;
  const step = Math.max(1, Math.trunc(perMove));
  const per = Math.max(1, Math.trunc(slidesPerPage));
  let count = 0;
  for (let i = 0; i < total; i += step) {
    if (i + per > total) break;
    count += 1;
  }
  return count;
}

export function cycleCount(pageCount: number): number {
  return Math.max(1, pageCount);
}

export const lastPageOf = (pageCount: number): number =>
  Math.max(0, pageCount - 1);

export const movesPer = (ctx: CarouselContext): number =>
  Math.max(1, Math.trunc(ctx.perMove));

export const pageOf = (ctx: CarouselContext, slide: number): number =>
  clampIndex(Math.floor(slide / movesPer(ctx)), ctx.pageCount);

export const restStatus = (ctx: CarouselContext): CarouselDragStatus =>
  ctx.focused ? "focus" : "idle";

export const midGesture = (status: CarouselDragStatus): boolean =>
  status === "dragging" || status === "settling";
