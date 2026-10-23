import type { AssignFor } from "@spin/runtime/fsm";
import type { SignaturePadEvents } from "./signature-pad.events.ts";
import type { SignaturePadContext } from "./signature-pad.state.ts";
import { pathsOf, strokePath } from "./signature-pad.state.ts";

type SignaturePadAssign<K extends keyof SignaturePadEvents = keyof SignaturePadEvents> = AssignFor<
  SignaturePadContext,
  SignaturePadEvents,
  K
>;

export const clear: SignaturePadAssign<"CLEAR"> = () => ({
  paths: [],
  currentPoints: [],
  currentPath: null,
});

export const setPaths: SignaturePadAssign<"SET_PATHS"> = (_ctx, event) => ({
  paths: pathsOf(event.paths),
});

export const setTuning: SignaturePadAssign<"SET_TUNING"> = (ctx, event) => ({
  tuning: { ...ctx.tuning, ...event.tuning },
});

export const pointerDown: SignaturePadAssign<"POINTER_DOWN"> = (ctx, event) => {
  const currentPoints = [event.point];
  return { currentPoints, currentPath: strokePath(currentPoints, ctx.tuning) };
};

export const pointerMove: SignaturePadAssign<"POINTER_MOVE"> = (ctx, event) => {
  const currentPoints = [...ctx.currentPoints, event.point];
  return { currentPoints, currentPath: strokePath(currentPoints, ctx.tuning) };
};

export const pointerUp: SignaturePadAssign<"POINTER_UP"> = (ctx) => {
  if (ctx.currentPath === null) return { currentPoints: [], currentPath: null };
  return {
    paths: [...ctx.paths, ctx.currentPath],
    currentPoints: [],
    currentPath: null,
  };
};
