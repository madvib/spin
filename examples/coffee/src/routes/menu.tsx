/**
 * The beans page — the shop's front.
 *
 * A hero that states the week, the four origins in a grid, and one band
 * pointing at how the week works. The buttons act: add-to-box writes the
 * shared box and the header badge follows, and once a bean is in the box the
 * button says so. Every colour, radius and shadow comes from
 * `spin/roastery.json` — the page states layout, the theme decides the look.
 */
import { A } from "@solidjs/router";
import { For } from "solid-js";
import { addToBox, inBox } from "../box.ts";

interface Bean {
  readonly image: string;
  readonly origin: string;
  readonly notes: string;
  readonly process: string;
  readonly price: number;
}

const BEANS: readonly Bean[] = [
  {
    image: "/beans/ethiopia.svg",
    origin: "Ethiopia Guji",
    notes: "Apricot, jasmine, black tea",
    process: "Washed",
    price: 19,
  },
  {
    image: "/beans/colombia.svg",
    origin: "Colombia Huila",
    notes: "Cocoa, walnut, orange peel",
    process: "Honey",
    price: 17,
  },
  {
    image: "/beans/sumatra.svg",
    origin: "Sumatra Lintong",
    notes: "Cedar, tobacco, molasses",
    process: "Wet-hulled",
    price: 18,
  },
  {
    image: "/beans/guatemala.svg",
    origin: "Guatemala Huehuetenango",
    notes: "Apple, caramel, almond",
    process: "Washed",
    price: 20,
  },
];

export default function Menu() {
  return (
    <div class="mx-auto max-w-xl">
      <section class="grid gap-8 p-8 md:grid-cols-2 md:items-center">
        <div class="flex flex-col items-start gap-4">
          <badge class="badge-accent">This week · four origins</badge>
          <h1>
            Roasted Tuesday,
            <br />
            on your table Thursday.
          </h1>
          <p class="text-muted">
            A two-person roastery, twelve kilos at a time. Orders close Monday
            at noon and everything roast-fresh ships Wednesday.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <a href="#beans">
              Shop this week's beans
            </a>
            <A href="/story" role="button" class="ghost no-underline">
              Meet the shop
            </A>
          </div>
        </div>
        <div class="rounded-md border bg-surface-raised p-6">
          <img
            src="/beans/ethiopia.svg"
            alt="Ethiopia Guji, this week's headliner"
            class="w-full rounded-md"
            width="240"
            height="160"
          />
        </div>
      </section>

      <section id="beans" class="flex flex-col gap-6 p-8">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2>This week's beans</h2>
          <p class="text-muted">Roasted Tuesday, shipped Wednesday.</p>
        </div>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <For each={BEANS}>
            {(bean) => (
              <card class="flex flex-col gap-4 p-6 transition-shadow duration-fast hover:shadow-md">
                <img
                  src={bean.image}
                  alt=""
                  class="rounded-md"
                  width="240"
                  height="160"
                />
                <div class="flex items-center gap-2">
                  <badge variant="accent">{bean.process}</badge>
                </div>
                <h3>{bean.origin}</h3>
                <p class="text-muted">{bean.notes}</p>
                <div class="mt-auto flex items-center justify-between gap-4">
                  <strong>${bean.price}</strong>
                  {inBox(bean.origin)
                    ? (
                      <button type="button" class="secondary" disabled>
                        In your box
                      </button>
                    )
                    : (
                      <button
                        type="button"
                        onClick={() =>
                          addToBox({
                            origin: bean.origin,
                            price: bean.price,
                            image: bean.image,
                          })}
                      >
                        Add to box
                      </button>
                    )}
                </div>
              </card>
            )}
          </For>
        </div>
      </section>

      <section class="p-8 pt-0">
        <card class="flex flex-wrap items-center justify-between gap-4 p-6">
          <div class="flex flex-col gap-1">
            <h2>The week, start to finish</h2>
            <p class="text-muted">
              Orders close Monday, roast Tuesday, out the door Wednesday.
            </p>
          </div>
          <A href="/story" role="button" class="ghost no-underline">
            See the schedule
          </A>
        </card>
      </section>
    </div>
  );
}
