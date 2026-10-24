import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { effect, machineTick, signal } from "../core/signal.ts";
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
    `row from the first sync re-runs on a later tick (runs=[${
      runs.join("|")
    }])`,
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

/**
 * A list that re-derives from a machine move re-syncs when the move's
 * signal flips.
 *
 * The items thunk reads a machine-shaped object (a plain object the owner
 * mutates in place, exactly like a bridge's context) — no signal of its
 * own. The machine-move signal is what re-runs the for, the same signal
 * the bag spreads read. This test fails if the for stops reading it: the
 * list would freeze at its first rows.
 */
Deno.test("the for re-syncs on the machine-move signal", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const anchor = document.createComment("for");
  host.appendChild(anchor);
  const ctx = { rows: ["a"] as readonly string[] };
  bindFor<string>({
    anchor,
    items: () => {
      machineTick();
      return ctx.rows;
    },
    key: (item) => item,
    render: (row) => {
      const el = document.createElement("div");
      el.textContent = row;
      return { nodes: [el] };
    },
  });
  assertEquals(
    host.querySelectorAll("div").length,
    1,
    "the seeded row renders",
  );

  // A machine move: the context object mutates, and the move signal flips.
  ctx.rows = ["a", "b"];
  machineTick(machineTick() + 1);
  assertEquals(
    host.querySelectorAll("div").length,
    2,
    "the new row renders from the move",
  );
});

Deno.test("multi-root rows keep source order (item then twin)", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const anchor = document.createComment("for");
  host.appendChild(anchor);
  bindFor<string>({
    anchor,
    items: () => ["h", "m", "s"],
    key: (_item, i) => i,
    render: (row) => {
      const frag = document.createDocumentFragment();
      const div = document.createElement("div");
      div.textContent = row;
      const twin = document.createElement("span");
      twin.textContent = ":";
      frag.appendChild(div);
      frag.appendChild(twin);
      return { nodes: [...frag.childNodes] };
    },
  });
  const order = [...host.childNodes]
    .filter((n) => n.nodeName !== "#comment")
    .map((n) => (n as Element).textContent ?? "?")
    .join("");
  assertEquals(
    order,
    "h:m:s:",
    `row twins follow their item (got ${
      [...host.childNodes].map((n) => (n as Element).textContent ?? "?").join(
        "|",
      )
    })`,
  );
});
