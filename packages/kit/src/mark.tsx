/**
 * The brand mark, in two states: the hero and the corner.
 *
 * The HERO is the spinnaker. An orb web — nine spokes from a hub, four rings
 * of sagging capture silk — spins itself in; the silk pays out from the hub;
 * the spider descends with an overshoot. Then the physics take over: the silk
 * and the spider swing as ONE body pivoting at the hub, a damped pendulum the
 * faintest draft keeps alive. Hover wakes it — the sway picks up and the
 * spider climbs its own silk onto the web; leaving lets it climb back down.
 * Shortening string quickens the beat, because that is what a pendulum does.
 *
 * The animation lives in the asset: SMIL for the spin-in, one rAF loop for the
 * pendulum and the crawl (paused when the tab is hidden, and skipped whole
 * under prefers-reduced-motion).
 *
 * The CORNER is the same creature at the size a corner mark actually
 * appears: the spider reduced to a FILLED silhouette, one ink that inherits
 * `currentColor` so it wears whatever surface it lands on, with spin's
 * hourglass cut out of its abdomen. The linework that suits a hero does not
 * survive a corner: at 16px a hairline is a grey smudge, and a mark that
 * smudges is no mark at all. A filled shape holds its edge, and the
 * hourglass — a bright diamond cut out of the dark body — is the one detail
 * that still reads that small.
 */
import type { JSX } from "solid-js";
import { For, onCleanup, onMount } from "solid-js";
import { Web } from "./web.tsx";

const RAD = Math.PI / 180;
const HUB = { x: 60, y: 13 };
const SILK_BOTTOM = 71; // where the spider hangs, at rest
const CLIMB = 44; // how far up it crawls on hover
const GRAVITY = 473; // tuned for a ~2.2s beat at full length

/** The point r units out from the hub along a spoke angle. */
const at = (r: number, deg: number): { x: number; y: number } => ({
  x: HUB.x + r * Math.cos(deg * RAD),
  y: HUB.y + r * Math.sin(deg * RAD),
});

const SPOKES: readonly number[] = [...Array(9)].map((_, i) => 20 + i * 17.5);
const RINGS: readonly number[] = [15, 26, 37, 47];

const SPOKE_PATHS: readonly string[] = SPOKES.map((deg) => {
  const p = at(48, deg);
  return `M${HUB.x} ${HUB.y} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
});

/** Capture silk: a sagging arc between each pair of spokes, per ring. */
const RING_PATHS: readonly (readonly string[])[] = RINGS.map((r) =>
  SPOKES.slice(0, -1).map((deg, i) => {
    const a = at(r, deg);
    const b = at(r, SPOKES[i + 1]);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const c = {
      x: mid.x + (HUB.x - mid.x) * 0.16,
      y: mid.y + (HUB.y - mid.y) * 0.16,
    };
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${
      c.y.toFixed(1)
    } ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  })
);

const DRAW = (begin: string, dur: string): JSX.Element => (
  <animate
    attributeName="stroke-dashoffset"
    values="1;0"
    dur={dur}
    begin={begin}
    fill="freeze"
  />
);

/**
 * The hero mark: the spinnaker, animated.
 *
 * The class decides the box; the ink is whatever the class inherits. Under
 * `prefers-reduced-motion` the drawing is complete and still: the spin-in is
 * skipped, the physics never run, and the spider hangs where it hangs.
 */
export function Mark(props: { class?: string }) {
  const reduced = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches ?? false;

  let body: SVGSVGElement | undefined;
  let pendulum: SVGGElement | undefined;
  let silk: SVGLineElement | undefined;
  let climber: SVGGElement | undefined;
  let legsA: SVGGElement | undefined;
  let legsB: SVGGElement | undefined;

  // The loop and the pointer share these the direct way — no reactivity
  // needed between an event and a frame.
  let hovered = false;
  let crawlTarget = 0;
  let crawl = 0;
  let kick = 0;

  const wake = () => {
    hovered = true;
    crawlTarget = 1;
    kick += 1.15;
  };
  const sleep = () => {
    hovered = false;
    crawlTarget = 0;
  };

  return (
    <svg
      ref={body}
      viewBox="0 0 120 120"
      fill="none"
      class={props.class}
      role="img"
      aria-label="spin — a spider climbing its web"
      onPointerEnter={wake}
      onPointerLeave={sleep}
    >
      {/* The spokes spin out from the hub. */}
      <g
        stroke="currentColor"
        stroke-width="0.9"
        stroke-linecap="round"
        opacity="0.5"
        stroke-dasharray="1"
        stroke-dashoffset={reduced ? 0 : 1}
      >
        <For each={SPOKE_PATHS}>
          {(d) => <path pathLength="1" d={d} />}
        </For>
        {!reduced && DRAW("0.05s", "0.55s")}
      </g>

      {/* Then the rings of capture silk, inner to outer. */}
      {RING_PATHS.map((ring, i) => (
        <g
          stroke="currentColor"
          stroke-width="0.9"
          stroke-linecap="round"
          opacity="0.55"
          stroke-dasharray="1"
          stroke-dashoffset={reduced ? 0 : 1}
        >
          <For each={ring}>{(d) => <path pathLength="1" d={d} />}</For>
          {!reduced && DRAW(`${0.3 + i * 0.18}s`, "0.5s")}
        </g>
      ))}

      {/* The whole hanging assembly — silk and spider — swings here. */}
      <g ref={pendulum}>
        <line
          ref={silk}
          x1={HUB.x}
          y1={HUB.y}
          x2={HUB.x}
          y2={SILK_BOTTOM}
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-dasharray="1"
          stroke-dashoffset={reduced ? 0 : 1}
        >
          {!reduced && DRAW("0.85s", "0.55s")}
        </line>

        {/* The climber: crawl offset × descent, composed. */}
        <g ref={climber}>
          <g opacity={reduced ? 1 : 0}>
            {!reduced && (
              <>
                <animate
                  attributeName="opacity"
                  values="0;1"
                  dur="0.35s"
                  begin="1s"
                  fill="freeze"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 -72;0 0;0 -7;0 0;0 -2;0 0"
                  keyTimes="0;0.5;0.66;0.82;0.92;1"
                  calcMode="spline"
                  keySplines="0.3 0 0.4 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
                  dur="1.4s"
                  begin="1s"
                  fill="freeze"
                />
              </>
            )}
            {/* Legs in two gaits — they alternate only while climbing. */}
            <g
              ref={legsA}
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            >
              <path d="M56.5 73.5 C50 68.5 45 67.5 40 70.5" />
              <path d="M54 80 C46 78 41 79.5 37 85" />
              <path d="M55.5 92 C50 95 46.5 99 45 104" />
              <path d="M57.5 95.5 C55.5 99 55.5 102 57 105.5" />
            </g>
            <g
              ref={legsB}
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            >
              <path d="M63.5 73.5 C70 68.5 75 67.5 80 70.5" />
              <path d="M66 80 C74 78 79 79.5 83 85" />
              <path d="M64.5 92 C70 95 73.5 99 75 104" />
              <path d="M62.5 95.5 C64.5 99 64.5 102 63 105.5" />
            </g>
            {/* Head and abdomen, hanging straight down the silk. */}
            <circle
              cx="60"
              cy="74.5"
              r="4.4"
              fill="var(--color-surface, #fff)"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <ellipse
              cx="60"
              cy="86.5"
              rx="6.6"
              ry="8.2"
              transform="rotate(-14 60 86.5)"
              fill="var(--color-surface, #fff)"
              stroke="currentColor"
              stroke-width="1.6"
            />
            {/* The mark itself: spin's hourglass, the one loud color. */}
            <path
              d="M60.2 82.5 L63.4 86.8 L60 92.2 L56.6 86.8 Z"
              fill="var(--color-primary, #c8102e)"
            />
          </g>
        </g>
      </g>

      {!reduced && <Physics />}
    </svg>
  );

  /** The pendulum and the climb. Mounted inside the SVG so the refs
   * resolve before it runs; one loop drives both. */
  function Physics(): null {
    onMount(() => {
      let theta = 0.16; // radians off plumb — it starts mid-swing
      let omega = 0;
      let last = performance.now();
      let nextDraft = last + 2600;
      let raf = 0;
      let onScreen = true;

      const onVis = () => {
        onScreen = !document.hidden;
        last = performance.now();
      };
      document.addEventListener("visibilitychange", onVis);

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        if (!onScreen) return;

        crawl += (crawlTarget - crawl) * Math.min(1, dt * 2.6);
        const length = SILK_BOTTOM - HUB.y - CLIMB * crawl;

        if (now > nextDraft) {
          // The draft: a nudge every few seconds, harder when woken.
          omega += (hovered ? 0.85 : 0.2) * (Math.random() < 0.5 ? 1 : -1) *
            (0.6 + Math.random() * 0.8);
          nextDraft = now +
            (hovered ? 900 + Math.random() * 700 : 3200 + Math.random() * 2600);
        }
        omega += kick;
        kick = 0;

        omega += (-((GRAVITY / length) * Math.sin(theta)) - 0.06 * omega) *
          dt;
        theta += omega * dt;

        pendulum?.setAttribute(
          "transform",
          `rotate(${(theta * 57.2958).toFixed(2)} ${HUB.x} ${HUB.y})`,
        );
        silk?.setAttribute("y2", (SILK_BOTTOM - CLIMB * crawl).toFixed(1));
        climber?.setAttribute(
          "transform",
          `translate(0 ${(-CLIMB * crawl).toFixed(1)})`,
        );

        if (crawl > 0.02) {
          const step = Math.sin(now / 95);
          legsA?.setAttribute(
            "transform",
            `rotate(${(6.5 * step).toFixed(2)} 60 78)`,
          );
          legsB?.setAttribute(
            "transform",
            `rotate(${(-6.5 * step).toFixed(2)} 60 78)`,
          );
        } else {
          legsA?.removeAttribute("transform");
          legsB?.removeAttribute("transform");
        }
      };
      raf = requestAnimationFrame(frame);
      onCleanup(() => {
        cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", onVis);
      });
    });
    return null;
  }
}

// ── the corner mark ──────────────────────────────────────────────────────────

/**
 * The corner mark's sizes: a rail, a header, a page.
 *
 * The sizes are the theme's own spacing steps — a fifth, an eighth and a
 * twelfth of a rem — so the mark sits on the same measure as the type
 * beside it.
 */
export type LogoSize = "sm" | "md" | "lg";

/** What the corner mark draws, and at what size. */
export interface LogoSpec {
  /** The box the mark is drawn in, in pixels. */
  readonly px: number;
  /** The theme's own step for that box, as the utility that names it. */
  readonly box: string;
  /** The geometry the mark is written in. */
  readonly viewBox: string;
  /** The mark's shapes — filled, never stroked. */
  readonly shapes: readonly string[];
  /** The ink the mark paints with: the colour it inherits. */
  readonly ink: string;
  /**
   * How the shapes are filled. Even-odd is what cuts the hourglass out of
   * the abdomen instead of painting it on: the mark stays one colour, and
   * the hourglass shows whatever surface the mark sits on.
   */
  readonly fillRule: "evenodd" | "nonzero" | "inherit";
}

/**
 * The mark's own drawing: the spider from above, one ink, hourglass cut out.
 *
 * The legs are filled tapers rather than strokes, so the silhouette holds its
 * edge at sixteen pixels; the hourglass is cut out of the abdomen rather than
 * painted on it, so the mark stays one colour and reads on any surface.
 */
const LOGO_SHAPES: readonly string[] = [
  // four legs a side, tapering to their tips
  "M10.9 7.4 Q8.8 4.6 5.6 3.6 L5.2 4.4 Q8.4 5.8 9.9 8.6 Z",
  "M14.1 8.6 Q15.6 5.8 18.8 4.4 L18.4 3.6 Q15.2 4.6 13.1 7.4 Z",
  "M9.7 10.5 Q7.5 8.8 4.9 8.6 L4.7 9.4 Q7.3 10.0 9.1 11.9 Z",
  "M14.9 11.9 Q16.7 10.0 19.3 9.4 L19.1 8.6 Q16.5 8.8 14.3 10.5 Z",
  "M9.1 14.2 Q7.1 14.6 4.5 15.2 L4.7 16.0 Q7.3 15.8 9.3 15.8 Z",
  "M14.7 15.8 Q16.7 15.8 19.3 16.0 L19.5 15.2 Q16.9 14.6 14.9 14.2 Z",
  "M9.2 17.8 Q7.9 20.1 6.2 21.4 L6.6 22.2 Q8.5 21.1 10.4 19.0 Z",
  "M13.6 19.0 Q15.5 21.1 17.4 22.2 L17.8 21.4 Q16.1 20.1 14.8 17.8 Z",
  // the head
  "M9.6 8.2 A2.4 2.4 0 1 1 14.4 8.2 A2.4 2.4 0 1 1 9.6 8.2 Z",
  // the abdomen, with the hourglass cut out of it
  "M12.0 9.8 C17.1 11.9 17.1 17.9 12.0 20.6 C6.9 17.9 6.9 11.9 12.0 9.8 Z M12 11.8 L14.4 15.2 L12 18.6 L9.6 15.2 Z",
];

/** The mark's tilt: the spider leans, the way it hangs. */

const LOGO_BOX: Record<
  LogoSize,
  { readonly px: number; readonly box: string }
> = {
  sm: { px: 20, box: "h-5 w-5" },
  md: { px: 32, box: "h-8 w-8" },
  lg: { px: 48, box: "h-12 w-12" },
};

/** The wordmark beside the mark, in the brand face, at the size that reads. */
const LOGO_WORD: Record<
  LogoSize,
  { readonly text: string; readonly gap: string }
> = {
  sm: { text: "text-sm", gap: "gap-1" },
  md: { text: "text-lg", gap: "gap-2" },
  lg: { text: "text-2xl", gap: "gap-3" },
};

/**
 * What the corner mark draws at a size.
 *
 * The drawing is the same at every size: one silhouette, scaled. A corner
 * mark that is redrawn per size is two marks to keep true.
 */
export function logoSpec(size: LogoSize): LogoSpec {
  const box = LOGO_BOX[size];
  return {
    px: box.px,
    box: box.box,
    viewBox: "0 0 24 24",
    shapes: LOGO_SHAPES,
    ink: "currentColor",
    fillRule: "evenodd",
  };
}

/**
 * The corner logo: the mark, and the name it belongs to.
 *
 * The wordmark is type — the theme's brand face — because a wordmark drawn as
 * thread is a wordmark that turns to mush at the size a corner mark appears.
 * The mark carries the picture; the word carries the name.
 */
export function Logo(
  props: { size?: LogoSize; class?: string },
): JSX.Element {
  const size = () => props.size ?? "md";
  const spec = () => logoSpec(size());
  const word = () => LOGO_WORD[size()];
  return (
    <span
      class={`inline-flex items-center font-brand font-semibold tracking-tighter ${word().gap} ${
        props.class ?? ""
      }`}
    >
      <Web size={spec().px} class={`${spec().box} shrink-0`} />
      <span class={word().text}>spin</span>
    </span>
  );
}
