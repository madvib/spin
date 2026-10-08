import { A } from "@solidjs/router";
import { For } from "solid-js";
import { SPECIMENS } from "../specimens.ts";

export default function Index() {
  return (
    <section>
      <h2 class="text-xl mb-2">Components</h2>
      <p class="text-muted mb-4">Each route mounts a spin element under a Solid controller.</p>
      <ul class="flex flex-col gap-2">
        <For each={SPECIMENS}>
          {(specimen) => (
            <li>
              <A href={specimen.path} class="text-text underline">
                {specimen.title}
              </A>
              <span class="text-muted"> — {specimen.blurb}</span>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
