import { A } from "@solidjs/router";
import { For } from "solid-js";
import { GROUPS, SPECIMENS } from "../specimens.ts";

/**
 * The landing page: what this is, and what it runs on.
 *
 * The nav rail already lists every component; this page states the claims
 * the corpus is supposed to prove, with the counts to check them against.
 */
export default function Index() {
  const machines = SPECIMENS.length;
  return (
    <article class="max-w-[45rem]">
      <h1 class="m-0 text-4xl font-bold tracking-tight">spin · components</h1>
      <p class="mt-6 text-xl text-text-muted">
        {machines} components, each a machine authored as config — states, conds and
        assigns as plain data — behind an owned runtime. No third-party interpreter,
        no adapter, no machine-in-a-black-box.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <span class="rounded-full border border-solid border-border bg-surface-raised px-3 py-1 text-sm text-text-muted">
          {machines} machines
        </span>
        <span class="rounded-full border border-solid border-border bg-surface-raised px-3 py-1 text-sm text-text-muted">
          {GROUPS.length} groups
        </span>
        <span class="rounded-full border border-solid border-border bg-surface-raised px-3 py-1 text-sm text-text-muted">
          e2e in real Chromium
        </span>
      </div>
      <p class="mt-8 text-md text-text-muted">
        Pick a component from the rail. Every page mounts the real element in a
        framed stage, with the host-side controls the route demonstrates: the
        imperative commands, the controlled props, and the events the machine
        emits.
      </p>
      <div class="mt-8 grid gap-2 sm:grid-cols-2">
        <For each={SPECIMENS}>
          {(specimen) => (
            <A
              href={specimen.path}
              class="rounded-md border border-solid border-border bg-surface-raised px-3 py-2 text-sm text-text transition-colors hover:border-border-strong"
            >
              <span class="font-medium">{specimen.title}</span>
              <span class="ml-2 text-text-muted">{specimen.group}</span>
            </A>
          )}
        </For>
      </div>
    </article>
  );
}
