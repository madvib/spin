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
import { For } from "solid-js";
import Menu from "./routes/menu.tsx";
import Brew from "./routes/brew.tsx";
import Story from "./routes/story.tsx";

const LINKS = [
  ["/", "Beans"],
  ["/brew", "Brewing"],
  ["/story", "The shop"],
] as const;

export default function App() {
  return (
    <MetaProvider>
      <Title>Basecamp Roastery</Title>
      <Router
        root={(props: ParentProps) => (
          <div
            data-theme="roastery"
            class="flex flex-col gap-4 min-h-screen bg-surface"
          >
            <nav class="flex flex-row items-center gap-4 bg-surface-raised border-b border-border p-4">
              <A href="/" class="row-sm no-underline">
                <img src="/mark.svg" alt="" width="28" height="28" />
                <span class="font-heading font-semibold">
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
                        activeClass="no-underline text-text font-semibold"
                        inactiveClass="no-underline text-text-muted"
                      >
                        {label}
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </nav>
            <main class="flex-1">{props.children}</main>
            <footer class="border-t border-border p-4 text-text-muted text-sm">
              Roasts are Tuesdays, shipping Wednesdays. Orders placed before
              Monday are in the following week's batch.
            </footer>
          </div>
        )}
      >
        <Route path="/" component={Menu} />
        <Route path="/brew" component={Brew} />
        <Route path="/story" component={Story} />
      </Router>
    </MetaProvider>
  );
}
