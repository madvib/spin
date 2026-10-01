import { Match, Switch } from "solid-js";

/**
 * One renderer for every utility, driven by the catalog section.
 *
 * Each case is a sample *element* — a swatch, a line of prose, a box — chosen
 * by what the utility needs to be visible against, not by which family it
 * belongs to. A new catalog section lands in the fallback; a case earns its
 * place only when the fallback cannot show the utility.
 */
export default function Sample(props: { section: string; utility: string }) {
  const u = () => props.utility;
  return (
    <Switch fallback={<div class={u()} />}>
      {/* Ink on paper: backgrounds, text color, decoration. */}
      <Match when={props.section === "background"}>
        <div class={`h-8 w-full ${u()}`} />
      </Match>
      <Match
        when={props.section === "text-color" ||
          props.section === "text-decoration"}
      >
        <span class={u()}>The quick brown fox jumps.</span>
      </Match>
      {/* Type needs a sentence, not a chip, to show rhythm. */}
      <Match when={props.section === "type-size" || props.section === "font"}>
        <span class={u()}>Agile foxes jump quickly.</span>
      </Match>
      {/* Shape needs a filled box to read against. */}
      <Match when={props.section === "radius" || props.section === "shadow"}>
        <div class={`h-8 w-full bg-surface ${u()}`} />
      </Match>
      {/* Space needs a framed box so the utility's own box is visible. */}
      <Match
        when={props.section === "padding" ||
          props.section === "margin" ||
          props.section === "gap" ||
          props.section === "sizing"}
      >
        <div class="border border-border">
          <div class={`h-8 bg-surface ${u()}`} />
        </div>
      </Match>
      {/* Position needs a stage with room to move in. */}
      <Match when={props.section === "position"}>
        <div class="relative h-16 overflow-hidden border border-border">
          <div class={`absolute h-8 w-16 bg-primary ${u()}`} />
        </div>
      </Match>
      {/* Layout internals: dividing, ordering, and flex need siblings. */}
      <Match when={props.section === "divide"}>
        <div class={`flex ${u()}`}>
          <div class="p-2">one</div>
          <div class="p-2">two</div>
        </div>
      </Match>
      <Match when={u().startsWith("order-")}>
        <div class="flex">
          <div class={`p-2 bg-primary ${u()}`}>{u()}</div>
          <div class="p-2">sibling</div>
        </div>
      </Match>
      <Match
        when={u().startsWith("items-") ||
          u().startsWith("justify-") ||
          u().startsWith("content-") ||
          u().startsWith("self-") ||
          u().startsWith("flex-") ||
          u() === "flex" ||
          u() === "inline-flex"}
      >
        <div class={`flex gap-4 ${u()}`}>
          <div class="p-2 bg-surface">one</div>
          <div class="p-2 bg-surface">two</div>
        </div>
      </Match>
      {/* Overflow needs long content in a short box. */}
      <Match when={props.section === "overflow"}>
        <div class={`h-16 overflow-hidden border border-border ${u()}`}>
          <div class="h-32 bg-surface">tall content</div>
        </div>
      </Match>
      {/* Visibility and display need presence toggles, not styling. */}
      <Match
        when={u() === "hidden" || u() === "invisible" || u() === "collapse"}
      >
        <div class="border border-border p-2">
          <span class={u()}>now you see it</span>
        </div>
      </Match>
      {/* Opacity and interactivity read against a fill. */}
      <Match
        when={props.section === "opacity" || props.section === "interactivity"}
      >
        <div class={`h-8 w-full bg-primary ${u()}`}>hover me</div>
      </Match>
      {/* Borders need a neutral edge so the utility's own edge shows. */}
      <Match when={props.section === "border"}>
        <div class={`h-8 w-full border border-border ${u()}`} />
      </Match>
      {/* Motion renders through the play rig on the motion page. */}
      <Match when={props.section === "transitions"}>
        <div class={`h-8 w-16 bg-primary ${u()}`} />
      </Match>
    </Switch>
  );
}
