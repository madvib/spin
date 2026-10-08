import { For } from "solid-js";
import {
  BUTTON_EXAMPLES,
  buttonFixtureNote,
} from "@spin/preset/rules/primitives/button.examples.ts";

/**
 * The button primitive rendered from its own examples — the package data,
 * not pre-rendered HTML. Uno scans this module's sources, so the classes
 * reach the sheet from real markup.
 */
export default function ButtonPage() {
  return (
    <main>
      <header>
        <h2>Button</h2>
        <div>rule</div>
        <p>{buttonFixtureNote}</p>
      </header>
      <For each={[...BUTTON_EXAMPLES]}>
        {(example) => (
          <section>
            <h3>{example.name}</h3>
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <div innerHTML={example.html} />
            <pre>{example.html.trim()}</pre>
          </section>
        )}
      </For>
    </main>
  );
}
