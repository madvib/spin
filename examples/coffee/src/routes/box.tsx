/**
 * The box page: what is in it, what it costs, and the order that empties it.
 *
 * The flow a shop needs to be a shop — add from the menu, review here, place
 * the order — with the confirmation as an alert the theme already paints,
 * and an empty state that points back at the week.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import { box, clearBox, removeFromBox } from "../box.ts";

export default function BoxPage() {
  const [placed, setPlaced] = createSignal(false);
  const total = () => box().reduce((sum, item) => sum + item.price, 0);

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex flex-col gap-4">
        <h1 class="m-0">Your box</h1>
        <p class="m-0 text-text-muted">
          Roasted Tuesday, shipped Wednesday — orders close Monday at noon.
        </p>
      </header>

      {placed()
        ? (
          <div class="flex flex-col items-start gap-4">
            <alert role="status" variant="success">
              <strong>Order placed.</strong>
              <p>Tracking arrives the day it ships.</p>
            </alert>
            <A href="/" role="button" class="no-underline">
              Back to this week's beans
            </A>
          </div>
        )
        : box().length === 0
        ? (
          <card class="flex flex-col items-start gap-4 p-6">
            <p class="m-0 text-text-muted">Your box is empty.</p>
            <A href="/" role="button" class="no-underline">
              Browse this week's beans
            </A>
          </card>
        )
        : (
          <card class="flex flex-col gap-4 p-6">
            <table class="w-full">
              <thead>
                <tr>
                  <th scope="col">Bean</th>
                  <th scope="col">Price</th>
                  <th scope="col" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                <For each={box()}>
                  {(item) => (
                    <tr>
                      <td>
                        <div class="flex items-center gap-3">
                          <img
                            src={item.image}
                            alt=""
                            width="40"
                            height="27"
                            class="rounded-sm"
                          />
                          <span>{item.origin}</span>
                        </div>
                      </td>
                      <td>${item.price}</td>
                      <td class="text-right">
                        <button
                          type="button"
                          class="icon ghost"
                          aria-label={`Remove ${item.origin}`}
                          onClick={() => removeFromBox(item.origin)}
                        >
                          <i
                            class="i-lucide-x button-icon icon-sm"
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <div class="flex items-center justify-between gap-4 border-t border-border pt-4">
              <span>
                Total <strong>{`$${total()}`}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  clearBox();
                  setPlaced(true);
                }}
              >
                Place order
              </button>
            </div>
          </card>
        )}
    </div>
  );
}
