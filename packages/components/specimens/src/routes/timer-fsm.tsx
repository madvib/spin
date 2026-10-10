import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { TimerTickChange } from "../../../src/spin-timer/timer.bridge.ts";

interface TimerCommands {
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  restart: () => void;
}

/** Every prop a timer takes, all of them optional: the scope grammar's
 * defaults are the machine's, and an omitted prop is not an authored one. */
interface TimerProps {
  readonly startMs?: number;
  readonly targetMs?: number;
  readonly countdown?: boolean;
  readonly autoStart?: boolean;
  readonly interval?: number;
}

const readout = (event: CustomEvent<TimerTickChange>): string => {
  const { hours, minutes, seconds } = event.detail.formattedTime;
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Timer on the forked FSM: the clock is the state, and the interval is a
 * stdlib action.
 *
 * The claim under test: Zag's four states collapse to the three phases a
 * host can observe, the tick's arithmetic is pure assigns, and the clock
 * itself never enters the machine — the `autoplay` action owns the interval
 * and reports TICK. A countdown runs its bar from full to empty and
 * completes on its own; a stopwatch without a target runs on.
 */
export default function TimerFsm() {
  const [value, setValue] = createSignal("00:00:00");
  const [countdown, setCountdown] = createSignal("00:01:00");
  const [short, setShort] = createSignal("00:00:01");
  const [completes, setCompletes] = createSignal(0);

  const stopwatch = createSpin<TimerProps, TimerCommands>(
    "spin-timer-fsm",
    () => ({ startMs: 0, countdown: false, autoStart: false, interval: 250 }),
    {
      tick: (event: CustomEvent<TimerTickChange>) => setValue(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  const auto = createSpin<TimerProps, TimerCommands>(
    "spin-timer-fsm",
    () => ({ startMs: 60_000, targetMs: 0, countdown: true, autoStart: true, interval: 1_000 }),
    {
      tick: (event: CustomEvent<TimerTickChange>) => setCountdown(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  const shortTimer = createSpin<TimerProps, TimerCommands>(
    "spin-timer-fsm",
    () => ({ startMs: 1_500, targetMs: 0, countdown: true, autoStart: false, interval: 500 }),
    {
      tick: (event: CustomEvent<TimerTickChange>) => setShort(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Timer — forked FSM</h2>
      <p class="text-muted mb-4">
        A stopwatch that counts up and runs on, a countdown that starts itself and runs its bar from full to empty, and
        a short one that completes. The phase lives in the machine — idle, running, paused — and the interval is a
        stdlib action on the root, so no timer ever enters the chart. Reset goes home and stops; restart goes home and
        runs.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Stopwatch, 250ms interval</h3>
          <spin-timer-fsm id="stopwatch" ref={stopwatch.ref} />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Countdown, autoStart, one minute</h3>
          <spin-timer-fsm id="auto" ref={auto.ref} />
        </div>
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Countdown, one and a half seconds</h3>
          <spin-timer-fsm id="short" ref={shortTimer.ref} />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-6">
        <button type="button" class={button} onClick={() => stopwatch.commands().start()}>
          el.start()
        </button>
        <button type="button" class={button} onClick={() => stopwatch.commands().pause()}>
          el.pause()
        </button>
        <button type="button" class={button} onClick={() => stopwatch.commands().resume()}>
          el.resume()
        </button>
        <button type="button" class={button} onClick={() => stopwatch.commands().reset()}>
          el.reset()
        </button>
        <button type="button" class={button} onClick={() => stopwatch.commands().restart()}>
          el.restart()
        </button>
      </div>

      <div class="mt-4 text-sm text-muted font-mono tabular-nums">
        <div>
          stopwatch: <span id="timer-value">{value()}</span> · auto countdown:{" "}
          <span id="timer-countdown">{countdown()}</span>
        </div>
        <div>
          short: <span id="timer-short">{short()}</span> · completes:{" "}
          <span id="timer-completes">{completes()}</span>
        </div>
      </div>
    </section>
  );
}
