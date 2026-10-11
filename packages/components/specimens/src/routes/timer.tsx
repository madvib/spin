import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import {
  DEMO_BUTTON,
  DemoCard,
  DemoControls,
  DemoGrid,
  DemoReadout,
} from "../demo.tsx";
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
    "spin-timer",
    () => ({ startMs: 0, countdown: false, autoStart: false, interval: 250 }),
    {
      tick: (event: CustomEvent<TimerTickChange>) => setValue(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  const auto = createSpin<TimerProps, TimerCommands>(
    "spin-timer",
    () => ({
      startMs: 60_000,
      targetMs: 0,
      countdown: true,
      autoStart: true,
      interval: 1_000,
    }),
    {
      tick: (event: CustomEvent<TimerTickChange>) =>
        setCountdown(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  const shortTimer = createSpin<TimerProps, TimerCommands>(
    "spin-timer",
    () => ({
      startMs: 1_500,
      targetMs: 0,
      countdown: true,
      autoStart: false,
      interval: 500,
    }),
    {
      tick: (event: CustomEvent<TimerTickChange>) => setShort(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    },
  );

  return (
    <DemoGrid>
      <DemoCard
        title="Stopwatch, 250ms interval"
        width="md"
        note="The interval is a stdlib action; the tick's arithmetic is pure assigns."
      >
        <spin-timer id="stopwatch" ref={stopwatch.ref} />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch.commands().start()}
          >
            el.start()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch.commands().pause()}
          >
            el.pause()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch.commands().resume()}
          >
            el.resume()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch.commands().reset()}
          >
            el.reset()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch.commands().restart()}
          >
            el.restart()
          </button>
        </DemoControls>
        <DemoReadout>
          stopwatch: <span id="timer-value">{value()}</span> · completes:{" "}
          <span id="timer-completes">{completes()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Countdown, autoStart, one minute"
        width="md"
        note="autoStart seeds the running phase, so the clock is already going."
      >
        <spin-timer id="auto" ref={auto.ref} />
        <DemoReadout>
          auto countdown: <span id="timer-countdown">{countdown()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Countdown, one and a half seconds"
        width="sm"
        note="A countdown runs its bar from full to empty and completes on its own."
      >
        <spin-timer id="short" ref={shortTimer.ref} />
        <DemoReadout>
          short: <span id="timer-short">{short()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
