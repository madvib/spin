import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";

// The shim installs its own globals. Declaring them here, rather than in the
// package, is what keeps linkedom's `Window` out of the shared program.
import { attrParsers, define } from "./element.ts";
import { effect, signal } from "../core/signal.ts";
import { controllerOf } from "./table.ts";

/**
 * The element's tests are about lifetime, not rendering.
 *
 * None of them call `scope.run` around their own effects. That is the point:
 * `define` owns what `build` creates, so a component does not have to know a
 * scope exists. A test that wrapped its own effect in `scope.run` would pass
 * whether or not `connectedCallback` disposed anything, and the twenty-cycle
 * test would be a tombstone with a number in it.
 */

/**
 * linkedom, not happy-dom: it needs no `--allow-env`, so the package's own
 * `deno test --allow-read` task runs these unchanged.
 *
 * `define` resolves the registry and the base class when it is called, not when
 * it is imported, so installing the globals here is enough and the imports
 * stay static.
 */
const { window } = parseHTML("<!doctype html><html><body></body></html>");
// linkedom's own types, deliberately not cast to the browser's. Casting them
// to `typeof globalThis.HTMLElement` manufactured a second `Window` in this
// program the moment any other package joined the check. The shim is a
// different DOM and says so; the runtime is written against the subset both
// agree on.
const { document, customElements, HTMLElement, Element, Node } = window;
Object.assign(globalThis, {
  document,
  customElements,
  HTMLElement,
  Element,
  Node,
});

test("a property set before connection is the value the component reads", () => {
  define("spin-before", {
    props: ["label"],
    build({ el, props }) {
      effect(() => {
        el.textContent = String(props.label);
      });
    },
  });

  const el = document.createElement("spin-before") as HTMLElement & {
    label?: string;
  };
  el.label = "set-early";
  document.body.appendChild(el);

  deepStrictEqual(el.textContent, "set-early");
});

test("a property set after connection updates what the component renders", () => {
  define("spin-after", {
    props: ["label"],
    build({ el, props }) {
      effect(() => {
        el.textContent = String(props.label);
      });
    },
  });

  const el = document.createElement("spin-after") as HTMLElement & {
    label?: string;
  };
  el.label = "first";
  document.body.appendChild(el);
  deepStrictEqual(el.textContent, "first");

  el.label = "second";
  deepStrictEqual(el.textContent, "second");
});

test("a prop read inside an effect re-runs when the property changes", () => {
  let runs = 0;

  define("spin-effect", {
    props: ["count"],
    build({ props }) {
      effect(() => {
        props.count;
        runs++;
      });
    },
  });

  const el = document.createElement("spin-effect") as HTMLElement & {
    count?: number;
  };
  el.count = 0;
  document.body.appendChild(el);
  deepStrictEqual(runs, 1);

  el.count = 1;
  deepStrictEqual(runs, 2);
});

test("a primitive attribute reaches the component as a parsed value", () => {
  define("spin-attribute", {
    attributes: {
      disabled: (value) => value === "true",
      level: (value) => Number(value),
    },
    build({ el, props }) {
      effect(() => {
        el.setAttribute("seen", `${props.disabled}:${props.level}`);
      });
    },
  });

  const el = document.createElement("spin-attribute");
  el.setAttribute("disabled", "true");
  el.setAttribute("level", "3");
  document.body.appendChild(el);

  deepStrictEqual(el.getAttribute("seen"), "true:3");

  // The parser is the component's, so a later write is parsed the same way and
  // lands in the same prop a property write would.
  el.setAttribute("disabled", "false");
  deepStrictEqual(el.getAttribute("seen"), "false:3");
});

test("twenty connect and disconnect cycles leave nothing live", async () => {
  const source = signal(0);
  let runs = 0;

  define("spin-twenty", {
    build({ el }) {
      effect(() => {
        runs++;
        el.textContent = String(source());
      });
    },
  });

  for (let i = 0; i < 20; i++) {
    const el = document.createElement("spin-twenty");
    document.body.appendChild(el);
    document.body.removeChild(el);
    // The disconnect's disposal lands on a microtask: flush it before
    // the next cycle so each iteration starts clean.
    await Promise.resolve();
  }

  deepStrictEqual(runs, 20);

  // The source outlives every element, so this write is the only thing that can
  // tell a cascade from twenty independent leaks.
  source(1);

  deepStrictEqual(runs, 20);
});

test("moving an element keeps its build and its scope", () => {
  const source = signal(0);
  let runs = 0;

  define("spin-reconnect", {
    build({ el }) {
      effect(() => {
        runs++;
        el.textContent = String(source());
      });
    },
  });

  const el = document.createElement("spin-reconnect");
  document.body.appendChild(el);
  document.body.removeChild(el);
  document.body.appendChild(el);

  deepStrictEqual(runs, 1);

  // The same live connection answers: a move is not a remount.
  source(1);
  deepStrictEqual(runs, 2);
  deepStrictEqual(el.textContent, "1");
});

test("a removed element disposes its scope once detached", async () => {
  const scopes: object[] = [];

  define("spin-scope", {
    build({ scope }) {
      scopes.push(scope);
    },
  });

  const el = document.createElement("spin-scope");
  document.body.appendChild(el);
  document.body.removeChild(el);
  // A synchronous re-append is a move and keeps the scope: only a
  // detachment that survives the microtask disposes.
  document.body.appendChild(el);

  deepStrictEqual(scopes.length, 1);

  document.body.removeChild(el);
  await Promise.resolve();
  document.body.appendChild(el);

  deepStrictEqual(scopes.length, 2);
  deepStrictEqual(scopes[0] === scopes[1], false);
});

test("a malformed JSON array attribute lands as empty rather than throwing", () => {
  define("spin-malformed", {
    attributes: {
      tags: attrParsers["string[]"],
      items: attrParsers["object[]"],
    },
    build({ el, props }) {
      effect(() => {
        el.setAttribute(
          "seen",
          `${JSON.stringify(props.tags)}|${JSON.stringify(props.items)}`,
        );
      });
    },
  });

  const el = document.createElement("spin-malformed");
  el.setAttribute("tags", "not-json");
  el.setAttribute("items", "{oops");
  document.body.appendChild(el);

  deepStrictEqual(el.getAttribute("seen"), "[]|[]");
});

test("a host-written object/array arrives coerced, not raw, at the channel", () => {
  define("spin-host-array", {
    props: ["items"],
    attributes: {
      items: attrParsers["object[]"],
    },
    build({ el, props }) {
      effect(() => {
        el.setAttribute("seen", JSON.stringify(props.items));
      });
    },
  });

  const el = document.createElement("spin-host-array") as HTMLElement & {
    items?: unknown;
  };
  el.items = [{ value: "a" }, null, "junk", ["nested"]];
  document.body.appendChild(el);

  // The syntax layer's object-array grammar: plain objects survive, the rest drop.
  deepStrictEqual(el.getAttribute("seen"), JSON.stringify([{ value: "a" }]));

  el.items = [{ value: "b" }];
  deepStrictEqual(el.getAttribute("seen"), JSON.stringify([{ value: "b" }]));
});

test("a host-written JSON string property arrives parsed at the channel", () => {
  define("spin-host-string", {
    props: ["items"],
    attributes: {
      items: attrParsers["object[]"],
    },
    build({ el, props }) {
      effect(() => {
        el.setAttribute("seen", JSON.stringify(props.items));
      });
    },
  });

  const el = document.createElement("spin-host-string") as HTMLElement & {
    items?: unknown;
  };
  el.items = JSON.stringify([{ value: "a" }]);
  document.body.appendChild(el);

  deepStrictEqual(el.getAttribute("seen"), JSON.stringify([{ value: "a" }]));
});

test("a nested element consumes its ancestor's watched handle and disposes cleanly", async () => {
  const count = signal(0);
  const counter = {
    get count() {
      return count();
    },
    increment() {
      count(count() + 1);
    },
  };
  define("test-provider", {
    build({ watch }) {
      watch(counter, () => ({
        api: counter,
        dispose: undefined,
      }));
    },
  });
  define("test-consumer", {
    build({ el, consume }) {
      const shared = consume<typeof counter>(counter);
      effect(() => {
        el.textContent = `count:${shared?.count ?? -1}`;
      });
    },
  });

  const provider = document.createElement("test-provider");
  const wrapper = document.createElement("div");
  const consumer = document.createElement("test-consumer");
  wrapper.appendChild(consumer);
  provider.appendChild(wrapper);
  document.body.appendChild(provider);

  deepStrictEqual(consumer.textContent, "count:0");

  counter.increment();
  deepStrictEqual(consumer.textContent, "count:1");

  document.body.removeChild(provider);
  // Disposal lands on a microtask: the write in between still reaches
  // the live scope, the one after does not.
  await Promise.resolve();
  counter.increment();
  deepStrictEqual(consumer.textContent, "count:1");
});

test("projected slots survive a detach past a microtask and a reconnect", async () => {
  const { projectSlots, placeSlot } = await import("../directives/bind.ts");
  define("test-slots", {
    build({ el }) {
      const groups = projectSlots(el as HTMLElement);
      const primary = document.createElement("section");
      primary.setAttribute("data-part", "primary");
      const secondary = document.createElement("section");
      secondary.setAttribute("data-part", "secondary");
      el.appendChild(primary);
      el.appendChild(secondary);
      const anchorA = document.createComment("slot:primary");
      const anchorB = document.createComment("slot:secondary");
      const anchorC = document.createComment("slot:default");
      primary.appendChild(anchorA);
      secondary.appendChild(anchorB);
      el.appendChild(anchorC);
      placeSlot(primary, anchorA, groups.get("primary"), []);
      placeSlot(secondary, anchorB, groups.get("secondary"), []);
      placeSlot(el, anchorC, groups.get(""), []);
    },
  });

  const host = document.createElement("test-slots");
  const first = document.createElement("div");
  first.setAttribute("slot", "primary");
  first.textContent = "alpha";
  const second = document.createElement("div");
  second.setAttribute("slot", "secondary");
  second.textContent = "beta";
  const rest = document.createElement("p");
  rest.textContent = "gamma";
  host.appendChild(first);
  host.appendChild(second);
  host.appendChild(rest);
  document.body.appendChild(host);

  const section = (part: string): Element | null =>
    host.querySelector(`[data-part="${part}"]`);
  deepStrictEqual(section("primary")?.textContent, "alpha");
  deepStrictEqual(section("secondary")?.textContent, "beta");

  document.body.removeChild(host);
  await new Promise((resolve) => setTimeout(resolve, 10));
  document.body.appendChild(host);

  deepStrictEqual(section("primary")?.textContent, "alpha");
  deepStrictEqual(section("secondary")?.textContent, "beta");
  deepStrictEqual(
    [...host.childNodes].filter((node) => node.nodeType !== 8).length,
    3,
  );
});

test("a watched handle's declared commands reach the element's controller", () => {
  const handle = {};
  let fired = false;
  define("test-command-bridge", {
    build({ watch }) {
      watch(handle, () => ({ fire() { fired = true; } }), ["fire"]);
    },
  });
  const el = document.createElement("test-command-bridge");
  document.body.appendChild(el);
  const found = controllerOf(el, handle);
  deepStrictEqual(typeof found?.commands.fire, "function");
  (found?.commands.fire as () => void)();
  deepStrictEqual(fired, true);
  document.body.removeChild(el);
});
