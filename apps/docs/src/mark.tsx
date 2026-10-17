/**
 * The mark: a spider on a thread.
 *
 * A web is what the product is — threads (custom properties) strung between
 * anchors, a structural sheet that hangs together, and something small at
 * the center of it holding everything. The mark draws that honestly:
 * hairline strands, a linework spider, the widow red as the only fill.
 *
 * Animation is SMIL, inside the asset, so no app CSS can be required to
 * make it move: the web draws itself in, the thread pays out, the spider
 * descends, overshoots once and settles, then sways. The visible sheet can
 * mute it by pausing the SVG (`svg:paused`), which is the contract.
 */
export function Mark(props: { class?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      class={props.class}
      role="img"
      aria-label="spin — a spider hanging from its thread"
    >
      {/* The web fan: five spokes, drawn together... */}
      <g
        stroke="currentColor"
        stroke-width="0.9"
        opacity="0.4"
        stroke-linecap="round"
        stroke-dasharray="1"
        stroke-dashoffset="1"
      >
        <line pathLength="1" x1="60" y1="8" x2="39" y2="29" />
        <line pathLength="1" x1="60" y1="8" x2="48.5" y2="35.5" />
        <line pathLength="1" x1="60" y1="8" x2="60" y2="38" />
        <line pathLength="1" x1="60" y1="8" x2="71.5" y2="35.5" />
        <line pathLength="1" x1="60" y1="8" x2="81" y2="29" />
        <animate
          attributeName="stroke-dashoffset"
          values="1;0"
          dur="0.7s"
          begin="0.05s"
          fill="freeze"
        />
      </g>
      {/* ...then three strand arcs joining the spokes. */}
      <g
        stroke="currentColor"
        stroke-width="0.9"
        opacity="0.55"
        stroke-linecap="round"
        fill="none"
        stroke-dasharray="1"
        stroke-dashoffset="1"
      >
        <path pathLength="1" d="M46.5 15.5 Q52 19.5 60 21 Q68 19.5 73.5 15.5" />
        <path pathLength="1" d="M42 22 Q51 28 60 29.5 Q69 28 78 22" />
        <path pathLength="1" d="M39 29 Q49 36.5 60 38 Q71 36.5 81 29" />
        <animate
          attributeName="stroke-dashoffset"
          values="1;0"
          dur="0.65s"
          begin="0.2s"
          fill="freeze"
        />
      </g>

      {/* The thread pays out. */}
      <g
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-dasharray="1"
        stroke-dashoffset="1"
      >
        <line pathLength="1" x1="60" y1="8" x2="60" y2="71" />
        <animate
          attributeName="stroke-dashoffset"
          values="1;0"
          dur="0.5s"
          begin="0.55s"
          fill="freeze"
        />
      </g>

      {/* The spider descends, overshoots once, settles, and sways. */}
      <g opacity="0">
        <animate
          attributeName="opacity"
          values="0;1"
          dur="0.4s"
          begin="0.6s"
          fill="freeze"
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 -72;0 0;0 -7;0 0;0 -2;0 0"
          keyTimes="0;0.5;0.66;0.82;0.92;1"
          calcMode="spline"
          keySplines="0.3 0 0.4 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
          dur="1.5s"
          begin="0.6s"
          fill="freeze"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-1.4 60 8;1.4 60 8;-1.4 60 8"
          dur="7s"
          begin="2.4s"
          repeatCount="indefinite"
          additive="sum"
        />

        {/* Legs: front pairs reach up, rear pairs hang down. */}
        <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M56.5 73.5 C50 68.5 45 67.5 40 70.5" />
          <path d="M63.5 73.5 C70 68.5 75 67.5 80 70.5" />
          <path d="M54 80 C46 78 41 79.5 37 85" />
          <path d="M66 80 C74 78 79 79.5 83 85" />
          <path d="M55.5 92 C50 95 46.5 99 45 104" />
          <path d="M64.5 92 C70 95 73.5 99 75 104" />
          <path d="M57.5 95.5 C55.5 99 55.5 102 57 105.5" />
          <path d="M62.5 95.5 C64.5 99 64.5 102 63 105.5" />
          {/* Head and abdomen, hanging straight down the thread. */}
          <circle cx="60" cy="74.5" r="4.4" fill="var(--color-surface, #fff)" />
          <ellipse
            cx="60"
            cy="86.5"
            rx="6.6"
            ry="8.2"
            transform="rotate(-14 60 86.5)"
            fill="var(--color-surface, #fff)"
          />
        </g>
        {/* The mark itself: the widow's hourglass, the one loud color. */}
        <path
          d="M60.2 82.5 L63.4 86.8 L60 92.2 L56.6 86.8 Z"
          fill="var(--color-primary, #c8102e)"
        />
      </g>
    </svg>
  );
}
