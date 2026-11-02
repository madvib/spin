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
import { spinShortcuts } from "@spinjs/preset";
import { animationContract } from "@spinjs/animation";
import { Chip, Code, Section, starterDoc } from "../../bits.tsx";
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
  const spacing = (): readonly string[] =>
    Object.keys(
      (starterDoc().spacing ?? {}) as Readonly<Record<string, unknown>>,
    )
      .filter((step) => !step.startsWith("$"))
      .sort((a, b) => {
        const left = Number(a);
        const right = Number(b);
        return Number.isFinite(left) && Number.isFinite(right)
          ? left - right
          : a.localeCompare(b);
      });
  return (
    <>
      <Markdown text={cssMd} />

      <Section id="spacing" title="Spacing scale, live">
        <p>
          The active theme's spacing steps, read from its document. A step not
          listed here has no <code>p-*</code>, <code>gap-*</code>, or{" "}
          <code>space-*</code> utility in this theme.
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={spacing()}>{(step) => <Chip>{step}</Chip>}</For>
        </div>
      </Section>

      <Section id="shortcuts" title="Shipped shortcuts, live">
        <p>
          Every entry in{" "}
          <code>spinShortcuts</code>, read out of the preset itself — not a
          copy. A shortcut composes utilities and other shortcuts; it cannot
          compose a primitive rule.
        </p>
        <div class="my-3 overflow-x-auto">
          <table class="wrap">
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
          <code>@spinjs/spin/animation</code>, and the motion tokens each one
          spends — one home for the namespace, so no keyframe silently wins
          over or loses to another.
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={animationContract.variants}>
            {(variant) => <Chip>{variant}</Chip>}
          </For>
        </div>
        <Code
          class="mt-3"
          code={animationContract.reads.map((token: string) => `motion: ${token}`).join(
            "\n",
          )}
        />
      </Section>
    </>
  );
}
