import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";

// The shim installs its own globals. Declaring them here, rather than in the
// package, is what keeps linkedom's `Window` out of the shared program.
import { attrParsers, define } from "./element.ts";
import { effect, signal } from "../core/signal.ts";

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

test("twenty connect and disconnect cycles leave nothing live", () => {
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
  }

  deepStrictEqual(runs, 20);

  // The source outlives every element, so this write is the only thing that can
  // tell a cascade from twenty independent leaks.
  source(1);

  deepStrictEqual(runs, 20);
});

test("reconnecting an element rebuilds it and leaves the first build dead", () => {
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

  deepStrictEqual(runs, 2);

  // Two live connections would make this three.
  source(1);
  deepStrictEqual(runs, 3);
  deepStrictEqual(el.textContent, "1");
});

test("each connection gets its own scope", () => {
  const scopes: object[] = [];

  define("spin-scope", {
    build({ scope }) {
      scopes.push(scope);
    },
  });

  const el = document.createElement("spin-scope");
  document.body.appendChild(el);
  document.body.removeChild(el);
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
