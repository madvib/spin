/**
 * The beans page: what the shop sells, in primitives a consumer writes.
 *
 * A card per origin, a badge for process, a button to add one to the box.
 * Every colour, radius and shadow here comes from `spin/roastery.json` — the
 * page states nothing but layout, which is the division of labour the theme
 * exists to enforce.
 */

import { For } from "solid-js";
import { Alert, Badge, Card } from "../components/spin.tsx";

interface Bean {
  readonly origin: string;
  readonly notes: string;
  readonly process: string;
  readonly price: string;
}

const BEANS: readonly Bean[] = [
  {
    origin: "Ethiopia Guji",
    notes: "Apricot, jasmine, black tea",
    process: "Washed",
    price: "$19",
  },
  {
    origin: "Colombia Huila",
    notes: "Cocoa, walnut, orange peel",
    process: "Honey",
    price: "$17",
  },
  {
    origin: "Sumatra Lintong",
    notes: "Cedar, tobacco, molasses",
    process: "Wet-hulled",
    price: "$18",
  },
  {
    origin: "Guatemala Huehuetenango",
    notes: "Apple, caramel, almond",
    process: "Washed",
    price: "$20",
  },
];

export default function Menu() {
  return (
    <div class="stack-lg max-w-5xl mx-auto p-8">
      <header class="stack">
        <h1 class="text-3xl">This week's beans</h1>
        <p class="text-text-muted">
          Four origins, roasted Tuesday and shipped Wednesday.
        </p>
      </header>
      <div class="flex flex-wrap gap-6">
        <For each={BEANS}>
          {(bean) => (
            <Card class="flex flex-col gap-4 p-6 w-72">
              <div class="row-sm">
                <Badge variant="accent">{bean.process}</Badge>
              </div>
              <h2 class="text-xl">{bean.origin}</h2>
              <p class="text-text-muted">{bean.notes}</p>
              <div class="split mt-auto">
                <strong>{bean.price}</strong>
                <button type="button">Add to box</button>
              </div>
            </Card>
          )}
        </For>
      </div>
    </div>
  );
}
