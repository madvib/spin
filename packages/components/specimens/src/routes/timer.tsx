import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import type { TimerTickChange } from "../../../src/spin-timer/timer.presentation.ts";

import "./spin-timer.html";
interface TimerCommands {
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  restart: () => void;
}

/** Every prop a timer takes, all of them optional: the scope grammar's
 * defaults are the machine's, and an omitted prop is not an authored one. */
/** The element as a host writes it: seeds are plain property writes. */
interface TimerElement extends HTMLElement {
  startMs?: number;
  targetMs?: number;
  countdown?: boolean;
  autoStart?: boolean;
  interval?: number;
}

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
 * The claim under test: the four states collapse to the three phases a
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

  const [stopwatchEl, setStopwatch] = createSignal<HTMLElement>();
  const stopwatch = createSpinComponent<TimerCommands>(stopwatchEl);
  createEffect(() => {
    const ctl = stopwatch();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
      tick: (event: CustomEvent<TimerTickChange>) => setValue(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    });
  });
;

  const [autoEl, setAuto] = createSignal<HTMLElement>();
  const auto = createSpinComponent<TimerCommands>(autoEl);
  createEffect(() => {
    const ctl = auto();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
      tick: (event: CustomEvent<TimerTickChange>) =>
        setCountdown(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    });
  });
;

  const [shortTimerEl, setShortTimer] = createSignal<HTMLElement>();
  const shortTimer = createSpinComponent<TimerCommands>(shortTimerEl);
  createEffect(() => {
    const ctl = shortTimer();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
      tick: (event: CustomEvent<TimerTickChange>) => setShort(readout(event)),
      complete: () => setCompletes((n) => n + 1),
    });
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Stopwatch, 250ms interval"
        width="md"
        note="The interval is a stdlib action; the tick's arithmetic is pure assigns."
      >
        <spin-timer
          id="stopwatch"
          ref={(node: HTMLElement) => {
            setStopwatch(node);
            const host = node as TimerElement;
            host.startMs = 0;
            host.countdown = false;
            host.autoStart = false;
            host.interval = 250;
          }}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch()?.commands.start()}
          >
            el.start()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch()?.commands.pause()}
          >
            el.pause()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch()?.commands.resume()}
          >
            el.resume()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch()?.commands.reset()}
          >
            el.reset()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => stopwatch()?.commands.restart()}
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
        <spin-timer
          id="auto"
          ref={(node: HTMLElement) => {
            setAuto(node);
            const host = node as TimerElement;
            host.startMs = 60_000;
            host.countdown = true;
            host.autoStart = true;
            host.interval = 1_000;
          }}
        />
        <DemoReadout>
          auto countdown: <span id="timer-countdown">{countdown()}</span>
        </DemoReadout>
      </DemoCard>

      <DemoCard
        title="Countdown, one and a half seconds"
        width="sm"
        note="A countdown runs its bar from full to empty and completes on its own."
      >
        <spin-timer
          id="short"
          ref={(node: HTMLElement) => {
            setShortTimer(node);
            const host = node as TimerElement;
            host.startMs = 1_500;
            host.countdown = true;
            host.autoStart = false;
            host.interval = 500;
          }}
        />
        <DemoReadout>
          short: <span id="timer-short">{short()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
