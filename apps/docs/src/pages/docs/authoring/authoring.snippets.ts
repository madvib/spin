/**
 * Code snippets for the Components & Runtime subgroup (`/docs/authoring/*`).
 */
export const AUTHORING_SNIPPETS = {
  copySelect: `npx spin component copy select basic`,
  solidController: `import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components";

const [el, setEl] = createSignal<HTMLElement>();
const ctl = createSpinComponent(el, select);

createEffect(() => {
  ctl.bind({ items: [{ value: "bun", label: "bun" }] });
});`,
  runtimeSignals: `import { computed, effect, signal } from "@spinjs/components/runtime";

const count = signal(0);
const doubled = computed(() => count() * 2);
effect(() => {
  console.log("count:", count(), "doubled:", doubled());
});`,
} as const;
