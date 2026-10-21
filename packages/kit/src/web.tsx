import type { JSX } from "solid-js";

/**
 * The mark: a web.
 *
 * A hub, eight spokes, three rings that sag the way silk sags, and a frame
 * that is broken on purpose — a closed ring reads as a wheel, and a web is
 * never closed. It is drawn in strokes on `currentColor`, so it is one colour
 * on any surface.
 *
 * It is ours: nothing here is derived from a third-party icon, so nothing
 * here needs attributing.
 */
const WEB =
  "M16 16L27.64 20.82M16 16L20.82 27.64M16 16L11.33 27.27M16 16L4.36 20.82M16 16L5.01 11.45M16 16L11.18 4.36M16 16L20.82 4.36M16 16L27.36 11.29M20.99 18.07Q19.13 19.13 18.07 20.99Q16 20.43 13.93 20.99Q12.87 19.13 11.01 18.07Q11.57 16 11.01 13.93Q12.87 12.87 13.93 11.01Q16 11.57 18.07 11.01Q19.13 12.87 20.99 13.93Q20.43 16 20.99 18.07M24.13 19.37Q21.1 21.1 19.37 24.13Q16 23.22 12.63 24.13Q10.9 21.1 7.87 19.37Q8.78 16 7.87 12.63Q10.9 10.9 12.63 7.87Q16 8.78 19.37 7.87Q21.1 10.9 24.13 12.63Q23.22 16 24.13 19.37M27.09 20.59Q22.96 22.96 20.59 27.09Q16 25.84 11.41 27.09Q9.04 22.96 4.91 20.59Q6.16 16 4.91 11.41Q9.04 9.04 11.41 4.91Q16 6.16 20.59 4.91Q22.96 9.04 27.09 11.41Q25.84 16 27.09 20.59M28.84 21.32Q24.45 24.45 21.32 28.8421.32 28.84Q16 27.95 10.68 28.8410.68 28.84Q7.55 24.45 3.16 21.323.16 21.32Q4.05 16 3.16 10.68M10.68 3.16Q16 4.05 21.32 3.1621.32 3.16Q24.45 7.55 28.84 10.6828.84 10.68Q27.95 16 28.84 21.32";

/**
 * The web at a size where threads would merge: eight spokes, one ring, a hub.
 *
 * The favicon's mark — the same web, thinned to what sixteen pixels can hold,
 * where the strokes merge into the web's silhouette.
 */
const WEB_SMALL =
  "M16 16L26.53 20.36M16 16L20.36 26.53M16 16L11.64 26.53M16 16L5.47 20.36M16 16L5.47 11.64M16 16L11.64 5.47M16 16L20.36 5.47M16 16L26.53 11.64M26.53 20.36Q22.77 22.77 20.36 26.53Q16 25.58 11.64 26.53Q9.23 22.77 5.47 20.36Q6.42 16 5.47 11.64Q9.23 9.23 11.64 5.47Q16 6.42 20.36 5.47Q22.77 9.23 26.53 11.64Q25.58 16 26.53 20.36";

/** The web, in the given size. Decorative unless it is given a title. */
export function Web(
  props: { class?: string; title?: string; size?: number },
): JSX.Element {
  return <WebMark path={WEB} stroke={0.7} hub={1.9} {...props} />;
}

/** The web, thinned for a favicon. */
export function WebGlyph(
  props: { class?: string; title?: string },
): JSX.Element {
  return <WebMark path={WEB_SMALL} stroke={1.7} hub={1.6} {...props} />;
}

function WebMark(
  props: {
    path: string;
    stroke: number;
    hub: number;
    class?: string;
    title?: string;
    size?: number;
  },
): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      width={props.size}
      height={props.size}
      class={props.class}
      fill="none"
      stroke="currentColor"
      stroke-width={props.stroke}
      stroke-linecap="round"
      role={props.title ? "img" : "presentation"}
      aria-hidden={props.title ? undefined : "true"}
    >
      {props.title ? <title>{props.title}</title> : null}
      <path d={props.path} />
      <circle cx="16" cy="16" r={props.hub} fill="currentColor" stroke="none" />
    </svg>
  );
}
