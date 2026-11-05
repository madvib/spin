/**
 * The roastery, in markup a consumer would write.
 *
 * No wrapper components, no adapters: a `<card>` is a card and a `<button>`
 * is a button, and everything visual comes from `spin/roastery.json`. This
 * file is the demonstration — a customer editing that theme watches this
 * page change, live, through the studio overlay.
 */

import { MetaProvider, Title } from "@solidjs/meta";
import { A, Route, Router } from "@solidjs/router";
import type { ParentProps } from "solid-js";
import { For, Show } from "solid-js";
import { box } from "./box.ts";
import Menu from "./routes/menu.tsx";
import Brew from "./routes/brew.tsx";
import Story from "./routes/story.tsx";
import BoxPage from "./routes/box.tsx";

const LINKS = [
  ["/", "Beans"],
  ["/brew", "Brewing"],
  ["/story", "The shop"],
] as const;

const FOOTER_SHOP = [
  ["/", "This week's beans"],
  ["/brew", "Brewing"],
  ["/story", "The shop"],
  ["/box", "Your box"],
] as const;

const FOOTER_WEEK = [
  ["Monday", "Orders close at noon"],
  ["Tuesday", "Roast day"],
  ["Wednesday", "Shipping"],
] as const;

export default function App() {
  return (
    <MetaProvider>
      <Title>Basecamp Roastery</Title>
      <Router
        root={(props: ParentProps) => (
          <div
            data-theme="roastery"
            class="flex min-h-screen flex-col bg-surface"
          >
            <div class="bg-primary py-2 text-center text-on-primary">
              Roast day is Tuesday · free shipping over $40
            </div>

            <nav class="flex flex-row items-center gap-4 border-b border-border bg-surface-raised p-4">
              <A href="/" class="row-sm no-underline whitespace-nowrap">
                <img src="/mark.svg" alt="" width="28" height="28" />
                <span>
                  Basecamp Roastery
                </span>
              </A>
              <ul class="row-list flex-1 justify-center">
                <For each={LINKS}>
                  {([href, label]) => (
                    <li>
                      <A
                        href={href}
                        class="no-underline text-text-muted"
                        activeClass="no-underline"
                        inactiveClass="no-underline text-text-muted"
                      >
                        {label}
                      </A>
                    </li>
                  )}
                </For>
              </ul>
              <A
                href="/box"
                class="flex items-center gap-2 rounded-sm border border-border px-3 py-2 no-underline"
              >
                <i
                  class="i-lucide-shopping-bag button-icon icon-sm"
                  aria-hidden="true"
                />
                Box
                <Show when={box().length > 0}>
                  <badge class="badge-accent">{box().length}</badge>
                </Show>
              </A>
            </nav>

            <main class="flex-1">{props.children}</main>

            <footer class="border-t border-border bg-surface-raised text-text-muted">
              <div class="mx-auto grid max-w-5xl gap-8 p-8 md:grid-cols-3">
                <div class="flex flex-col gap-2">
                  <span class="flex items-center gap-2">
                    <img src="/mark.svg" alt="" width="22" height="22" />
                    <span>
                      Basecamp Roastery
                    </span>
                  </span>
                  <p class="m-0">
                    Edge of town, open Friday to Sunday, 8 to 4.
                  </p>
                </div>
                <div class="flex flex-col gap-2">
                  <span>Shop</span>
                  <For each={FOOTER_SHOP}>
                    {([href, label]) => (
                      <A href={href} class="no-underline text-text-muted">
                        {label}
                      </A>
                    )}
                  </For>
                </div>
                <div class="flex flex-col gap-2">
                  <span>The week</span>
                  <For each={FOOTER_WEEK}>
                    {([day, what]) => (
                      <p class="m-0">
                        <span>{day}</span> — {what}
                      </p>
                    )}
                  </For>
                </div>
              </div>
              <div class="border-t border-border p-4 text-center">
                Roasts are Tuesdays, shipping Wednesdays. Orders placed before
                Monday are in the following week's batch.
              </div>
            </footer>
          </div>
        )}
      >
        <Route path="/" component={Menu} />
        <Route path="/brew" component={Brew} />
        <Route path="/story" component={Story} />
        <Route path="/box" component={BoxPage} />
      </Router>
    </MetaProvider>
  );
}
