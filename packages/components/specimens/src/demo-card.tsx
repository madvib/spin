import { type JSX, Show } from "solid-js";

/** The card every example stands in. `width` picks the card's size step. */
export function DemoCard(props: {
  title: string;
  width?: "xs" | "sm" | "md" | "lg" | "full";
  note?: JSX.Element;
  children: JSX.Element;
}) {
  const size = props.width === "xs" || props.width === "sm"
    ? "card-narrow"
    : props.width === "lg"
    ? "card-wide"
    : "card-default";
  const span = props.width === "full" || props.width === "lg"
    ? "md:col-span-2"
    : "";
  return (
    <card class={`${size} ${span}`}>
      <card-header>
        <card-title>{props.title}</card-title>
      </card-header>
      <card-content>{props.children}</card-content>
      <Show when={props.note !== undefined}>
        <card-footer>{props.note}</card-footer>
      </Show>
    </card>
  );
}
