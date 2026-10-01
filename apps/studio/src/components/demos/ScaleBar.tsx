import { createSignal } from "solid-js";

function toRem(px: number): string {
  if (px <= 0) return "0";
  return `${Number((px / 16).toFixed(2))}rem`;
}

export default function ScaleBar(props: {
  label: string;
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
    <div class="flex items-center gap-4 bg-surface-raised rounded-lg shadow-sm p-4 border border-border">
      <code>{props.label}</code>
      <div class="flex-1 h-8 bg-neutral-100 rounded-md overflow-hidden">
        <div
          class="h-8 bg-primary rounded-md cursor-col-resize"
          style={{ width: `${Math.min(shown(), 320)}px` }}
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
        class="text-sm p-2 border border-border rounded-md"
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
