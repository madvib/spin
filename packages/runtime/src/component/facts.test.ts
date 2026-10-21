import { assertEquals } from "@std/assert";
import { factAttrs, type FactScope } from "./facts.ts";

interface Ctx {
  readonly dragging: boolean;
  readonly orientation: string;
}

const scope: FactScope<Ctx> = {
  props: { disabled: true },
  context: { dragging: false, orientation: "vertical" },
  state: "dragging",
  id: (part: string) => `slider-${part}`,
};

const facts = {
  disabled: (s: FactScope<Ctx>) => s.props["disabled"] === true,
  dragging: (s: FactScope<Ctx>) => s.context.dragging,
  orientation: (s: FactScope<Ctx>) => s.context.orientation,
  "machine-state": (s: FactScope<Ctx>) => s.state,
  absent: () => undefined,
  ownedby: (s: FactScope<Ctx>) => s.id("root"),
};

Deno.test("a fact that holds writes an empty attribute", () => {
  assertEquals(factAttrs(scope, facts, "disabled"), { "data-disabled": "" });
});

Deno.test("a fact that does not hold leaves the attribute off", () => {
  assertEquals(factAttrs(scope, facts, "dragging"), {});
});

Deno.test("a fact with a string writes it", () => {
  assertEquals(factAttrs(scope, facts, "orientation"), { "data-orientation": "vertical" });
});

Deno.test("a fact with no value leaves the attribute off", () => {
  assertEquals(factAttrs(scope, facts, "absent"), {});
});

Deno.test("a fact reads the machine's state", () => {
  assertEquals(factAttrs(scope, facts, "machine-state"), { "data-machine-state": "dragging" });
});

Deno.test("a fact reads the part ids", () => {
  assertEquals(factAttrs(scope, facts, "ownedby"), { "data-ownedby": "slider-root" });
});

Deno.test("a part carries only the facts it names", () => {
  assertEquals(factAttrs(scope, facts, "disabled", "orientation"), {
    "data-disabled": "",
    "data-orientation": "vertical",
  });
});
