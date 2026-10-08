import { A, Router, type RouteDefinition } from "@solidjs/router";
import { For, type JSX } from "solid-js";
import Index from "./routes/index.tsx";
import { SPECIMENS } from "./specimens.ts";

function Shell(props: { children?: JSX.Element }) {
  return (
    <main class="max-w-2xl mx-auto p-8">
      <header class="mb-6">
        <h1 class="text-2xl font-bold">spin · specimens</h1>
        <nav class="flex gap-4 mt-2">
          <A href="/" class="text-muted">Index</A>
          <For each={SPECIMENS}>
            {(specimen) => <A href={specimen.path} class="text-muted">{specimen.title}</A>}
          </For>
        </nav>
      </header>
      {props.children}
    </main>
  );
}

// One table drives both the routes and the index links: no URL is typed twice.
const ROUTES: RouteDefinition[] = [
  { path: "/", component: Index },
  ...SPECIMENS.map((specimen) => ({ path: specimen.path, component: specimen.component })),
];

export function App() {
  return <Router root={Shell}>{ROUTES}</Router>;
}
