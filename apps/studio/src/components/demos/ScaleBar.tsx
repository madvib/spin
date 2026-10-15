import { createSignal } from "solid-js";

function toRem(px: number): string {
  if (px <= 0) return "0";
  return `${Number((px / 16).toFixed(2))}rem`;
}

/**
 * One step of the spacing scale, as a length rather than a number.
 *
 * The bar's width reads the theme's own custom property, so the bar IS the
 * value: a step in any unit resolves in the stylesheet rather than through a
 * parse here, an edit redraws the bar without this component knowing the
 * value changed, and the ramp reads as relative lengths — 4px beside 96px —
 * rather than as a column of numbers. A drag paints the width it proposes
 * until it commits, and the field beside the bar sets the same step the
 * precise way.
 */
export default function ScaleBar(props: {
  label: string;
  /** The custom property the bar's width reads when it is not being dragged. */
  variable: string;
  /** The step resolved in px, where a drag starts and the fields read. */
  px: number | undefined;
  onCommit: (rem: string) => void;
}) {
  const [dragPx, setDragPx] = createSignal<number | undefined>(undefined);
  const shown = () => dragPx() ?? props.px ?? 0;
  let startX = 0;
  let startPx = 0;

  const onPointerMove = (event: PointerEvent) => {
    setDragPx(Math.max(0, startPx + event.clientX - startX));
  };
  const endDrag = (event: PointerEvent) => {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    const final = dragPx();
    setDragPx(undefined);
    if (final !== undefined) props.onCommit(toRem(final));
  };

  return (
    <div class="split panel">
      <code>{props.label}</code>
      <div class="flex-1 h-8 bg-neutral-100 rounded-md overflow-hidden">
        <div
          class="h-8 bg-primary rounded-md cursor-col-resize"
          style={{
            width: dragPx() === undefined
              ? `var(${props.variable})`
              : `${Math.min(dragPx() ?? 0, 320)}px`,
          }}
          onPointerDown={(event) => {
            startX = event.clientX;
            startPx = shown();
            (event.currentTarget as Element).setPointerCapture?.(
              event.pointerId,
            );
            event.currentTarget.onpointermove = onPointerMove;
            event.currentTarget.onpointerup = endDrag;
            event.currentTarget.onpointercancel = () => setDragPx(undefined);
          }}
        />
      </div>
      <code>{toRem(shown())}</code>
      <input
        class="text-sm p-2 border border-border rounded-md w-24"
        type="number"
        step="0.25"
        min="0"
        value={Number((shown() / 16).toFixed(2))}
        onChange={(event) =>
          props.onCommit(toRem(Number(event.currentTarget.value) * 16))}
      />
    </div>
  );
}
