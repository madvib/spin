/**
 * The toast's own reflexes — the two timers the upstream toast machine runs
 * as effects, as actions instead, because a timer is never machine state.
 *
 * `toast-timer` rides one toast row and owns two clocks:
 *
 *   - the dismissal clock, which counts down `remaining` while the row is
 *     visible and not paused, reports the remainder when it stops early, and
 *     fires `onTimeout` when it runs out;
 *   - the remove clock, armed when the row starts dismissing, which fires
 *     `onRemove` after `removeDelay` — the exit beat that finally takes the
 *     row out of the queue.
 *
 * The pause is where the `syncRemainingTime` lives: it subtracts the
 * elapsed time from the armed duration and hands it back through
 * `onPause`, so the number the machine holds is the number the clock
 * resumes from. A row that never pauses keeps its `remaining` untouched and
 * the clock never re-arms.
 *
 * `toast-row` is the one-row counterpart of the stdlib's observers: it reads
 * the row's layout height once it is in the document and reports it, which
 * is the measurement the group machine wants for its stack offsets.
 */

// Leaf import, not "@spinjs/runtime": the actions table imports this module,
// so the package root would cycle back through the table.
import { createAction } from "./action.ts";
import type { ElementAction } from "./action.ts";

export interface ToastTimerParam {
  /** What is left on the dismissal clock, in milliseconds. */
  readonly remaining: number;
  /** The row is paused: the clock holds its remainder. */
  readonly paused: boolean;
  /** The row is playing its exit. */
  readonly dismissing: boolean;
  /** The gap between the exit starting and the row leaving the queue. */
  readonly removeDelay: number;
  readonly onTimeout: () => void;
  readonly onRemove: () => void;
  /** Fires once when the row reports a clock remainder it stopped at. */
  readonly onPause: (remaining: number) => void;
  /** Fires once on the frame after the row attaches — the entry beat. */
  readonly onReady: () => void;
}

export const toastTimer: ElementAction<ToastTimerParam> = createAction(
  (_node, param) => {
    let armed = false;
    let start = 0;
    let runFor = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;

    const clearClock = (): void => {
      clearTimeout(timer);
      timer = undefined;
    };

    const arm = (ms: number): void => {
      clearClock();
      start = Date.now();
      runFor = ms;
      armed = true;
      timer = setTimeout(() => {
        timer = undefined;
        armed = false;
        param?.onTimeout();
      }, ms);
    };

    const stop = (): void => {
      const elapsed = Date.now() - start;
      clearClock();
      armed = false;
      if (runFor > elapsed) param?.onPause(runFor - elapsed);
    };

    const beat = (): void => {
      if (ready) return;
      ready = true;
      param?.onReady();
    };

    /** The entry beat lands one frame after the row attaches, so the browser
     * has painted the pre-enter state and the transition has something to
     * animate from. An environment with no frame clock beats immediately. */
    const schedule = (): void => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(beat);
      } else beat();
    };

    /** A clock that never elapses — a loading toast, or no limit at all. */
    const clockable = (ms: number): boolean => Number.isFinite(ms) && ms > 0;

    if (param !== undefined) {
      if (param.paused || !clockable(param.remaining)) {
        armed = false;
      } else {
        arm(param.remaining);
      }
      schedule();
    }

    return {
      update: (next) => {
        if (next === undefined) return;
        if (next.dismissing) {
          // The exit is playing: the dismissal clock is irrelevant, and the
          // remove clock starts from wherever the row is.
          if (armed) stop();
          clearClock();
          timer = setTimeout(() => {
            timer = undefined;
            next.onRemove();
          }, next.removeDelay);
          return;
        }
        if (next.paused) {
          if (armed) stop();
          return;
        }
        if (!clockable(next.remaining)) {
          clearClock();
          armed = false;
          return;
        }
        if (!armed || runFor !== next.remaining) arm(next.remaining);
      },
      destroy: clearClock,
    };
  },
);

export interface ToastRowParam {
  /** Fires with the row's layout height, whenever it changes. */
  readonly onHeight: (height: number) => void;
}

/**
 * The measurement half. A ResizeObserver reports the row's own box, so the
 * stack's offsets come from a height the element actually has rather than
 * from a measurement the machine guesses.
 */
export const toastRow: ElementAction<ToastRowParam> = createAction(
  (node, param) => {
    if (typeof ResizeObserver !== "function") return;
    const measure = (): void => {
      const height = (node as HTMLElement).offsetHeight;
      if (height > 0) param?.onHeight(height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return {
      destroy: () => observer.disconnect(),
    };
  },
);

export interface ToastRegionParam {
  /** The keys that together focus the region, e.g. `["altKey", "KeyT"]`. */
  readonly hotkey: readonly string[];
  /** Whether a hidden document pauses the toasts. */
  readonly pauseOnPageIdle: boolean;
  readonly onIdleChange: (idle: boolean) => void;
}

/**
 * The region's document reflexes — the `trackHotKeyPress` and
 * `trackDocumentVisibility` effects. Both are listeners on the document,
 * which is what an action is for: the element it is attached to is the
 * region, and the only thing it does with it is focus it.
 */
export const toastRegion: ElementAction<ToastRegionParam> = createAction(
  (node, param) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const keys = param?.hotkey ?? [];
      if (keys.length === 0) return;
      const pressed = keys.every((key) =>
        isModifier(key)
          ? event.getModifierState(key.slice(0, -3))
          : event.code === key
      );
      if (!pressed) return;
      event.preventDefault();
      if (node instanceof HTMLElement) node.focus();
    };
    const onVisibility = (): void => {
      param?.onIdleChange(document.visibilityState === "hidden");
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    if (param?.pauseOnPageIdle !== false) {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return {
      destroy: () => {
        document.removeEventListener("keydown", onKeyDown, { capture: true });
        document.removeEventListener("visibilitychange", onVisibility);
      },
    };
  },
);

/** A hotkey entry is a modifier name when it reads as one. */
function isModifier(key: string): boolean {
  return key === "altKey" || key === "ctrlKey" || key === "metaKey" ||
    key === "shiftKey";
}
