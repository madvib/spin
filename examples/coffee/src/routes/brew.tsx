/**
 * The brewing page: a method per card, steps as prose.
 *
 * The point of this page in an example app is motion and steps — a `<meter>`
 * for strength, `<kbd>` for the settings you tap on a scale, and a `progress`
 * while the bloom runs. All of it themed from `spin/roastery.json`.
 */

import { For } from "solid-js";

interface Method {
  readonly name: string;
  readonly ratio: string;
  readonly steps: readonly string[];
  readonly strength: number;
}

const METHODS: readonly Method[] = [
  {
    name: "Pour-over",
    ratio: "1:16",
    steps: [
      "Rinse the filter, warm the cone.",
      "Bloom with twice the coffee's weight in water for 45 seconds.",
      "Pour in slow spirals, three pours total.",
      "Drawdown should finish near three minutes.",
    ],
    strength: 0.8,
  },
  {
    name: "French press",
    ratio: "1:15",
    steps: [
      "Coarse grind, water just off the boil.",
      "Four minutes, lid on, plunger up.",
      "Break the crust at one minute.",
      "Press slowly and decant immediately.",
    ],
    strength: 0.95,
  },
];

export default function Brew() {
  return (
    <div class="flex flex-col gap-8 max-w-xl mx-auto p-8">
      <header class="flex flex-col gap-4">
        <h1>Brewing</h1>
        <p class="text-muted">
          Two methods, the settings we use, and what to watch for.
        </p>
      </header>
      <For each={METHODS}>
        {(method) => (
          <card class="flex flex-col gap-4 p-6">
            <div class="flex items-center justify-between gap-4">
              <h2>{method.name}</h2>
              <badge variant="accent">{method.ratio}</badge>
            </div>
            <ol class="flex flex-col gap-2 text-muted">
              <For each={method.steps}>
                {(step) => <li>{step}</li>}
              </For>
            </ol>
            <div class="flex flex-col gap-2">
              <progress value={method.strength} aria-label="Strength" />
              {
                /* The ratio was already a badge in the header. Repeating it
                  under a label that says the other thing entirely is how this
                  flex flex-row items-center gap-4 came to read "Strength 1:16". */
              }
              <p class="text-muted">
                Strength {Math.round(method.strength * 100)}%
              </p>
            </div>
          </card>
        )}
      </For>
    </div>
  );
}
