import { Show, type JSX } from "solid-js";

/**
 * The specimen primitives, on tarkui's pattern: every example is a bounded
 * CARD — the component at a realistic size with real vertical presence,
 * never stretched to the rail — and every control is BARE: a quiet label-
 * sized button that answers the pointer, not a filled slab competing with
 * the component it drives.
 *
 * A stage the size of a page turns every component into a slab of nothing:
 * the specimen is the subject, the panel is the floor it stands on, and the
 * floor should not compete.
 */

/** The card every example stands in. `width` bounds the component itself;
 * the card always fills its grid cell. */
export function DemoCard(props: {
  title: string;
  width?: "xs" | "sm" | "md" | "lg" | "full";
  note?: JSX.Element;
  children: JSX.Element;
}) {
  // Arbitrary values on purpose: the utility theme here does not generate
  // the named spacing scale for max-width, only the arbitrary form.
  const bound =
    props.width === "xs"
      ? "max-w-[14rem]"
      : props.width === "sm"
        ? "max-w-[18rem]"
        : props.width === "md"
          ? "max-w-[24rem]"
          : props.width === "lg"
            ? "max-w-[36rem]"
            : "";
  // A card is half the stage (two per row) unless the demo is wide: `lg` and
  // `full` take the whole row, because a data-dense demo is not a specimen
  // card, it is a page. The component inside stays bounded by `bound`, so
  // the card never becomes a slab.
  const shell = props.width === "full" || props.width === "lg"
    ? "flex min-w-0 basis-full flex-col"
    : "flex min-w-0 basis-full flex-col md:basis-[calc(50%-0.75rem)]";
  return (
    <figure class={`m-0 ${shell} rounded-lg border border-solid border-border bg-surface`}>
      <figcaption class="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2">
        <span class="text-sm font-medium text-text">{props.title}</span>
      </figcaption>
      <div class="flex flex-1 items-center justify-center px-4 py-12">
        <div class={`w-full ${bound}`}>{props.children}</div>
      </div>
      <Show when={props.note !== undefined}>
        <div class="border-t border-border px-4 py-2 text-xs text-text-muted">{props.note}</div>
      </Show>
    </figure>
  );
}

/** The quiet control: bare, mono, label-sized. */
export const DEMO_BUTTON =
  "inline-flex min-h-0 shrink-0 items-center justify-center rounded-md border border-solid border-transparent bg-transparent px-2 py-1 font-mono text-xs font-medium normal-case tracking-normal text-text-muted shadow-none cursor-pointer hover:border-border-strong hover:text-text";

/** The readout row every demo ends with: mono, tabular, quiet. */
export function DemoReadout(props: { children: JSX.Element }) {
  return <div class="mt-4 font-mono text-xs text-text-muted tabular-nums">{props.children}</div>;
}

/** The examples grid: cards wrap, so a lone example fills its row and a
 * pair sits two-up. The card grows; the component inside stays bounded. */
export function DemoGrid(props: { children: JSX.Element }) {
  return <div class="flex flex-wrap gap-6">{props.children}</div>;
}

/** A row of quiet controls. */
export function DemoControls(props: { children: JSX.Element }) {
  return <div class="mt-4 flex flex-wrap items-center gap-2">{props.children}</div>;
}
