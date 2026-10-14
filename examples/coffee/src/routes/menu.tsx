/**
 * The beans page: what the shop sells, in primitives a consumer writes.
 *
 * A card per origin, a badge for process, a button to add one to the box.
 * Every colour, radius and shadow here comes from `spin/roastery.json` — the
 * page states nothing but layout, which is the division of labour the theme
 * exists to enforce.
 */

import { For } from "solid-js";

interface Bean {
  readonly image: string;
  readonly origin: string;
  readonly notes: string;
  readonly process: string;
  readonly price: string;
}

const BEANS: readonly Bean[] = [
  {
    image: "/beans/ethiopia.svg",
    origin: "Ethiopia Guji",
    notes: "Apricot, jasmine, black tea",
    process: "Washed",
    price: "$19",
  },
  {
    image: "/beans/colombia.svg",
    origin: "Colombia Huila",
    notes: "Cocoa, walnut, orange peel",
    process: "Honey",
    price: "$17",
  },
  {
    image: "/beans/sumatra.svg",
    origin: "Sumatra Lintong",
    notes: "Cedar, tobacco, molasses",
    process: "Wet-hulled",
    price: "$18",
  },
  {
    image: "/beans/guatemala.svg",
    origin: "Guatemala Huehuetenango",
    notes: "Apple, caramel, almond",
    process: "Washed",
    price: "$20",
  },
];

export default function Menu() {
  return (
    <div class="flex flex-col gap-8 max-w-5xl mx-auto p-8">
      <header class="flex flex-col gap-4">
        <h1 class="text-3xl">This week's beans</h1>
        <p class="text-text-muted">
          Four origins, roasted Tuesday and shipped Wednesday.
        </p>
      </header>
      <div class="flex flex-wrap gap-6">
        <For each={BEANS}>
          {(bean) => (
            <card class="flex flex-col gap-4 p-6 w-72">
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
              <h2 class="text-xl">{bean.origin}</h2>
              <p class="text-text-muted">{bean.notes}</p>
              <div class="flex items-center justify-between gap-4 mt-auto">
                <strong>{bean.price}</strong>
                <button type="button">Add to box</button>
              </div>
            </card>
          )}
        </For>
      </div>
    </div>
  );
}
