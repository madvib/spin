/**
 * The mark and the logo: one pen, two states.
 *
 * The MARK is the hero piece. An orb web — nine spokes from a hub, four
 * rings of sagging capture silk — spins itself in; the silk pays out from
 * the hub; the spider descends with an overshoot. Then the physics take
 * over: the silk and the spider swing as ONE body pivoting at the hub, a
 * damped pendulum the faintest draft keeps alive. Hover wakes it — the
 * sway picks up and the spider climbs its own silk onto the web; leaving
 * lets it climb back down. Shortening string quickens the beat, because
 * that is what a pendulum does.
 *
 * The animation lives in the asset: SMIL for the spin-in, one rAF loop
 * for the pendulum and the crawl (paused when the tab is hidden, and
 * skipped whole under prefers-reduced-motion).
 *
 * The LOGO is the corner mark: the same spider, still, drawn in the same
 * silk linework — the wordmark is spun thread, not a font, so it can
 * never clash with a starter's type and never needs an underline.
 */
import type { JSX } from "solid-js";
import { onCleanup, onMount } from "solid-js";
import { For } from "solid-js";

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
            {/* The mark itself: the widow's hourglass, the one loud color. */}
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

/**
 * The logo: the spider, still, and the wordmark in the brand face.
 *
 * The glyph is artwork — the same spider, compact — carrying the
 * theme's surface, text, and primary tokens. The wordmark is type: the
 * document's `font.family.brand`, so the logotype is a real, loaded
 * face and still only ever painted by theme values.
 */
const LOGO_SIZES = {
  sm: { glyph: "h-5", text: "text-lg", gap: "gap-1" },
  md: { glyph: "h-8", text: "text-2xl", gap: "gap-2" },
  lg: { glyph: "h-12", text: "text-3xl", gap: "gap-3" },
} as const;

export function Logo(
  props: { size?: keyof typeof LOGO_SIZES; class?: string },
) {
  const size = () => LOGO_SIZES[props.size ?? "md"];
  return (
    <span
      class={`inline-flex items-center font-brand font-semibold tracking-tighter ${size().gap} ${
        props.class ?? ""
      }`}
    >
      <svg
        viewBox="0 0 22 26"
        fill="none"
        class={size().glyph}
        role="img"
        aria-label="spin"
      >
        <g stroke="currentColor" stroke-linecap="round">
          <line x1="11" y1="0.5" x2="11" y2="6.8" stroke-width="1.1" />
          <g stroke-width="1.5">
            <path d="M9.2 10.8 C7.4 9.4 5.8 9.6 4.6 11" />
            <path d="M8.9 13.6 C6.9 13.4 5.4 14.4 4.4 16.2" />
            <path d="M9.6 16.8 C8.4 18.4 8 20 8.4 21.6" />
            <path d="M12.8 10.8 C14.6 9.4 16.2 9.6 17.4 11" />
            <path d="M13.1 13.6 C15.1 13.4 16.6 14.4 17.6 16.2" />
            <path d="M12.4 16.8 C13.6 18.4 14 20 13.6 21.6" />
          </g>
          <circle
            cx="11"
            cy="9.4"
            r="2.1"
            fill="var(--color-surface, #fff)"
            stroke-width="1.5"
          />
          <ellipse
            cx="11"
            cy="15"
            rx="3.1"
            ry="3.9"
            transform="rotate(-12 11 15)"
            fill="var(--color-surface, #fff)"
            stroke-width="1.5"
          />
          <path
            d="M11.1 13.2 L12.5 15.1 L11 17.6 L9.5 15.1 Z"
            fill="var(--color-primary, #c8102e)"
            stroke="none"
          />
        </g>
      </svg>
      <span class={size().text}>spin</span>
    </span>
  );
}
