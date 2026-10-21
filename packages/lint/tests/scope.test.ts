import { assertEquals } from "@std/assert";
import { parseFile } from "../src/cli.ts";
import { ancestorsOf } from "../src/scope.ts";
import { walk } from "../src/walk.ts";

/**
 * The chain of elements above the one being read.
 *
 * The scope of a primitive is a place, and a place is a chain: an element is
 * inside a document column only if the column is above it. The chain is read
 * off the tree, and the tree is the same tree every front end walks.
 */

const SOURCE = `export function App() {
  return (
    <prose class="column">
      <section class="body">
        <p class="leaf">text</p>
      </section>
    </prose>
  );
}
`;

/**
 * The chain above every class attribute in the fixture.
 *
 * Collected without an order: the three front ends walk the tree in their
 * own order, and what the chain holds does not depend on which way they go.
 */
function chains(): { ancestors: string[]; classes: string[] }[] {
  const ast = parseFile(SOURCE, "app.tsx");
  const out: { ancestors: string[]; classes: string[] }[] = [];
  walk(ast, (node) => {
    if (node.type !== "JSXAttribute") return;
    const name = node.name?.name;
    if (name !== "class" && name !== "className") return;
    const chain = ancestorsOf(node);
    out.push({
      ancestors: chain.map((ancestor) => ancestor.tag ?? "?"),
      classes: chain.map((ancestor) => ancestor.classes.join(" ")),
    });
  });
  return out;
}

Deno.test("the chain holds the elements above, nearest first", () => {
  const found = chains().map((entry) => entry.ancestors.join(" > ")).sort();
  assertEquals(found, ["", "prose", "section > prose"]);
});

Deno.test("the chain holds the classes of each element above", () => {
  // The scope of a primitive is named by a class as often as by a tag: the
  // same primitive in its classless form claims `<card>` and in its class
  // form claims `.card`.
  const found = chains().map((entry) => entry.classes.join(" > ")).sort();
  assertEquals(found, ["", "body > column", "column"]);
});
