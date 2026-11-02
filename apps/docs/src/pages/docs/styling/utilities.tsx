/**
 * Utilities & Animations: closed-scale utility classes, cascade layers,
 * layout shortcuts, and theme-driven motion.
 */
import { For } from "solid-js";
import type { JSX } from "solid-js";
import { spinShortcuts } from "@spinjs/preset";
import { animationContract } from "@spinjs/animation";
import { Chip, Code, Section, starterDoc } from "../../../bits.tsx";
import { Markdown } from "../../../markdown.tsx";
import {
  PageHeader,
  PlaygroundEmbed,
  PropList,
  type PropEntry,
} from "../../../ui/index.ts";
import cssMd from "../../../content/css-edges.md?raw";

export default function StylingUtilities(): JSX.Element {
  const shortcutItems = (): readonly PropEntry[] =>
    Object.entries(spinShortcuts as Record<string, string>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, expansion]) => ({
        name,
        badge: "shortcut",
        description: (
          <>
            Expands to <code>{expansion}</code>
          </>
        ),
      }));

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
    <main class="flex flex-col">
      <PageHeader
        title="Utilities & Animations"
        lede="Utilities cover layout and the decisions elements leave open. Every utility spends a theme token; undeclared steps emit zero CSS."
        playgroundExample="utilities-layout"
      />
      <Markdown text={cssMd} />

      <Section id="spacing" title="Spacing scale, live">
        <p class="max-w-prose">
          The active theme's spacing steps, read directly from its document. A
          step not listed here has no <code>p-*</code>, <code>gap-*</code>, or{" "}
          <code>m-*</code> utility in this theme.
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={spacing()}>{(step) => <Chip>{step}</Chip>}</For>
        </div>
      </Section>

      <Section id="shortcuts" title="Shipped shortcuts, live">
        <p class="max-w-prose">
          Every entry in <code>spinShortcuts</code>, read out of the preset
          contract. A shortcut composes utilities and other shortcuts.
        </p>
        <div class="my-3">
          <PropList items={shortcutItems()} />
        </div>
      </Section>

      <Section id="animation" title="Global animation utilities, live">
        <p class="max-w-prose">
          Every <code>animate-*</code> utility from{" "}
          <code>@spinjs/spin/animation</code>, and the motion tokens each one
          spends:
        </p>
        <div class="my-3 flex flex-wrap gap-2">
          <For each={animationContract.variants}>
            {(variant) => <Chip>{variant}</Chip>}
          </For>
        </div>
        <Code
          class="mt-3"
          lang="ts"
          title="Motion token reads"
          code={animationContract.reads
            .map((token: string) => `motion: ${token}`)
            .join("\n")}
        />
      </Section>

      <Section id="playground" title="Try utilities live">
        <PlaygroundEmbed exampleId="utilities-layout" compact />
      </Section>
    </main>
  );
}
