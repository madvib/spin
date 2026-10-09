import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { effect, signal } from "../core/signal.ts";
import { bindFor } from "./for.ts";

const { document } = parseHTML("<!doctype html><html><body></body></html>");
(globalThis as unknown as { document: unknown }).document = document;

/**
 * Rows rendered by an earlier sync keep responding after a later sync.
 *
 * Alien disposes effects created during a parent's run when that parent
 * re-runs (unlink pushes them through unwatched). Row content must therefore
 * render detached from the sync effect's reactive parentage; the cell owner
 * alone decides lifetime. This test fails if renders ever re-attach.
 */
Deno.test("rows from an earlier sync stay subscribed after a later sync", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const anchor = document.createComment("for");
  host.appendChild(anchor);
  const items = signal<readonly string[]>(["a", "b"]);
  const tick = signal(0);
  const runs: string[] = [];
  bindFor<string>({
    anchor,
    items: () => items(),
    key: (_item, i) => i,
    render: (row) => {
      const frag = document.createDocumentFragment();
      const el = document.createElement("div");
      effect(() => {
        void tick();
        runs.push(`run:${row}`);
      });
      frag.appendChild(el);
      return { nodes: [...frag.childNodes] };
    },
  });
  assertEquals(host.querySelectorAll("div").length, 2, "two rows render");
  items([...items(), "c"]);
  assertEquals(host.querySelectorAll("div").length, 3, "appended row renders");
  runs.length = 0;
  tick(tick() + 1);
  assertEquals(
    runs.some((r) => r === "run:a"),
    true,
    `row from the first sync re-runs on a later tick (runs=[${runs.join("|")}])`,
  );
});

Deno.test("rows stay after preceding siblings (anchor-relative placement)", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const label = document.createElement("div");
  label.textContent = "Options";
  host.appendChild(label);
  const anchor = document.createComment("for");
  host.appendChild(anchor);
  const items = signal<readonly string[]>(["a", "b"]);
  bindFor<string>({
    anchor,
    items: () => items(),
    key: (item) => item,
    render: (row) => {
      const frag = document.createDocumentFragment();
      const el = document.createElement("span");
      el.textContent = row;
      frag.appendChild(el);
      return { nodes: [...frag.childNodes] };
    },
  });
  const order = () => [...host.childNodes].map((n) => n.textContent);
  assertEquals(order(), ["Options", "a", "b", "for"]);
  items(["b", "a"]);
  assertEquals(order(), ["Options", "b", "a", "for"]);
  items([...items(), "c"]);
  assertEquals(order(), ["Options", "b", "a", "c", "for"]);
});
