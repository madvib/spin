/**
 * CSS & Edges: the six places Spin behaves differently from utility CSS.
 *
 * The narrative lives in `../../content/css-edges.md`. This file keeps the
 * two live tables Markdown cannot carry: every shipped shortcut and its
 * expansion, and every global animation utility with the motion tokens it
 * spends.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { spinShortcuts } from "@spin/preset";
import { animationContract } from "@spin/animation";
import { Chip, Code, Section } from "../../bits.tsx";
import { Markdown } from "../../markdown.tsx";
import cssMd from "../../content/css-edges.md?raw";

/** One shortcut and the utilities it expands to. */
function ShortcutRow(props: { name: string; expansion: string }): JSX.Element {
  return (
    <tr>
      <td>
        <Chip>{props.name}</Chip>
      </td>
      <td>
        <code>{props.expansion}</code>
      </td>
    </tr>
  );
}

export default function Css(): JSX.Element {
  const shortcuts = Object.entries(spinShortcuts as Record<string, string>)
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-16">
      <Markdown text={cssMd} />

      <Section id="shortcuts" title="Shipped shortcuts, live">
        <p>
          Every entry in{" "}
          <code>spinShortcuts</code>, read out of the preset itself — not a
          copy. A shortcut composes utilities and other shortcuts; it cannot
          compose a primitive rule.
        </p>
        <div class="my-3 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th class="text-left">Shortcut</th>
                <th class="text-left">Expands to</th>
              </tr>
            </thead>
            <tbody>
              <For each={shortcuts}>
                {([name, expansion]) => (
                  <ShortcutRow name={name} expansion={expansion} />
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="animation" title="Global animation utilities, live">
        <p>
          Every <code>animate-*</code> utility from{" "}
          <code>@spin/animation</code>, and the motion tokens each one spends.
          Add a keyframe anywhere else and it silently wins over — or loses to —
          this file's, which is why the namespace has one home.
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={animationContract.variants}>
            {(variant) => <Chip>{variant}</Chip>}
          </For>
        </div>
        <Code
          class="mt-3"
          code={animationContract.reads.map((token) => `motion: ${token}`).join(
            "\n",
          )}
        />
      </Section>
    </main>
  );
}
