import type { EventUnion } from "@spin/runtime/fsm";

export type ToastType = "info" | "success" | "warning" | "error" | "loading";

export interface ToastEvents {
  "TOAST.CREATE": { id: string; title: string; description: string; toastType: ToastType; duration: number; priority: number; action: string };
  "TOAST.UPDATE": { id: string; title: string; description: string; toastType: ToastType; duration: number; priority: number; action: string };
  "TOAST.REMOVE": { id: string };
  "TOAST.DISMISS": { id: string; src: string };
  "DISMISS.ALL": {};
  "TOAST.PAUSE": { id: string; remaining: number };
  "TOAST.RESUME": { id: string };
  "TOAST.MOUNTED": { id: string };
  "TIMER.ELAPSED": { id: string };
  "TIMER.REMOVED": { id: string };
  "HEIGHT.SET": { id: string; height: number };
  "REGION.POINTER_ENTER": {};
  "REGION.POINTER_LEAVE": {};
  "REGION.FOCUS": {};
  "REGION.BLUR": {};
  "REGION.OVERLAP": {};
  "REGION.STACK": {};
  "PAGE.IDLE": {};
  "PAGE.ACTIVE": {};
}

export type ToastEvent = EventUnion<ToastEvents>;