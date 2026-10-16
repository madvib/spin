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
 * until it commits.
 *
 * Deliberately just the bar. The row owns the token's name and its editor,
 * because two labels and two fields for one token is what this component
 * used to produce when it carried its own.
 */
export default function ScaleBar(props: {
  /** The custom property the bar's width reads when it is not being dragged. */
  variable: string;
  /** The step resolved in px, where a drag starts. */
  px: number | undefined;
  /** The furthest a drag can propose, so a wide step cannot leave the track. */
  maxPx?: number;
  onCommit: (rem: string) => void;
  /** Reports the length a drag proposes, so a linked group can follow it. */
  onPreview?: (rem: string) => void;
  /** Reports a drag abandoned before it committed. */
  onCancel?: () => void;
}) {
  const [dragPx, setDragPx] = createSignal<number | undefined>(undefined);
  const shown = () => dragPx() ?? props.px ?? 0;
  const max = () => props.maxPx ?? 320;
  let startX = 0;
  let startPx = 0;

  const onPointerMove = (event: PointerEvent) => {
    const px = Math.max(0, startPx + event.clientX - startX);
    setDragPx(px);
    props.onPreview?.(toRem(px));
  };
  const endDrag = (event: PointerEvent) => {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    const final = dragPx();
    setDragPx(undefined);
    if (final !== undefined) props.onCommit(toRem(final));
  };

  return (
    <div class="h-6 overflow-hidden rounded-md bg-surface-sunken">
      <div
        class="h-full rounded-md bg-primary cursor-col-resize"
        style={{
          width: dragPx() === undefined
            ? `var(${props.variable})`
            : `${Math.min(dragPx() ?? 0, max())}px`,
        }}
        onPointerDown={(event) => {
          startX = event.clientX;
          startPx = shown();
          (event.currentTarget as Element).setPointerCapture?.(
            event.pointerId,
          );
          event.currentTarget.onpointermove = onPointerMove;
          event.currentTarget.onpointerup = endDrag;
          event.currentTarget.onpointercancel = () => {
            setDragPx(undefined);
            props.onCancel?.();
          };
        }}
      />
    </div>
  );
}
