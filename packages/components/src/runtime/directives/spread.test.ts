import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { signal } from "../core/signal.ts";
import { bindSpread } from "./spread.ts";

// linkedom, not happy-dom: it needs no `--allow-env`, so the package's own
// `deno test --allow-read` task runs these unchanged. Only `document` is
// installed — bindSpread touches the element it is handed and nothing else.
const { window } = parseHTML("<!doctype html><html><body></body></html>");
const { document } = window;
Object.assign(globalThis, { document });

test("a re-run with a new handler identity fires exactly once per dispatch", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  let firstCalls = 0;
  let secondCalls = 0;
  const first = () => {
    firstCalls++;
  };
  const second = () => {
    secondCalls++;
  };

  const current = signal<Record<string, unknown>>({ onClick: first, "data-x": "1" });
  bindSpread(el, () => current());

  el.dispatchEvent(new window.Event("click"));
  deepStrictEqual(firstCalls, 1);
  deepStrictEqual(secondCalls, 0);

  current({ onClick: second, "data-x": "1" });

  el.dispatchEvent(new window.Event("click"));
  // The old listener is gone and the new one fires once: a duplicated
  // listener would push firstCalls to 2.
  deepStrictEqual(firstCalls, 1);
  deepStrictEqual(secondCalls, 1);
});

test("re-running with the same handler identity keeps a single listener", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  let calls = 0;
  const handler = () => {
    calls++;
  };

  const current = signal<Record<string, unknown>>({ onClick: handler });
  bindSpread(el, () => current());

  current({ onClick: handler });

  el.dispatchEvent(new window.Event("click"));
  deepStrictEqual(calls, 1);
});

test("attributes the reader drops are removed from the element", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const current = signal<Record<string, unknown>>({ "data-x": "1", "data-y": "2" });
  bindSpread(el, () => current());

  deepStrictEqual(el.getAttribute("data-x"), "1");
  deepStrictEqual(el.getAttribute("data-y"), "2");

  current({ "data-x": "1" });

  deepStrictEqual(el.getAttribute("data-x"), "1");
  deepStrictEqual(el.getAttribute("data-y"), null);
});

test("a listener the reader drops stops firing", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  let calls = 0;
  const current = signal<Record<string, unknown>>({
    onClick: () => {
      calls++;
    },
  });
  bindSpread(el, () => current());

  el.dispatchEvent(new window.Event("click"));
  deepStrictEqual(calls, 1);

  current({});

  el.dispatchEvent(new window.Event("click"));
  deepStrictEqual(calls, 1);
});

test("style object is serialized to cssText", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const current: Record<string, unknown> = {
    style: { position: "absolute", top: "10px", backgroundColor: "red" },
  };
  bindSpread(el, () => current);

  deepStrictEqual(
    el.getAttribute("style"),
    "position:absolute;top:10px;background-color:red;",
  );
});

test("aria booleans render as true/false strings, never empty or absent", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const current = signal<Record<string, unknown>>({
    "aria-selected": false,
    hidden: false,
  });
  bindSpread(el, () => current());
  // false on an aria state is explicit, not absent; on a plain boolean it removes.
  deepStrictEqual(el.getAttribute("aria-selected"), "false");
  deepStrictEqual(el.hasAttribute("hidden"), false);

  current({ "aria-selected": true, hidden: true });
  // true on an aria state is "true", not the empty string (which AT reads as unset).
  deepStrictEqual(el.getAttribute("aria-selected"), "true");
  deepStrictEqual(el.getAttribute("hidden"), "");
});

test("a bag-carried use: directive is consumed, never written as an attribute", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  // A name the registry does not hold: the assertion is the attribute
  // writer's behaviour, which must never fall through for any `use:` key.
  // The attach pass owns the entry, so an unregistered name skips it.
  const bag = signal<Record<string, unknown>>({
    "data-x": "1",
    "use:unregistered-directive": { onDisabledChange: () => {} },
  });
  bindSpread(el, () => bag());

  // The attach pass owns `use:name` entries: the attribute writer must not
  // leak the stringified param into the DOM.
  deepStrictEqual(el.getAttribute("data-x"), "1");
  deepStrictEqual(el.hasAttribute("use:unregistered-directive"), false);

  // Dropping the directive writes nothing either — no attribute to remove.
  bag({ "data-x": "1" });

  deepStrictEqual(el.getAttribute("data-x"), "1");
  deepStrictEqual(el.hasAttribute("use:unregistered-directive"), false);
});
