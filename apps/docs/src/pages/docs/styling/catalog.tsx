/**
 * Tokens & Catalog: every utility the active starter spends, grouped by
 * intent, plus the dual-mode token probe.
 */
import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { parseTokens } from "@spinjs/spin/theme";
import type { TokenTree } from "@spinjs/spin/theme";
import { starterThemes } from "@spinjs/spin/theme/themes";
import {
  describeCatalog,
  SECTIONS,
  spinShortcuts,
  utilitiesFor,
} from "@spinjs/preset";
import { animationContract } from "@spinjs/animation";
import { mode, starterList, theme } from "@spinjs/kit";
import { Chip, Probe, Section, starterDoc } from "../../../bits.tsx";
import { PageHeader } from "../../../ui/index.ts";

type Cell = Record<string, unknown>;
const leaf = (root: unknown, path: string): unknown => {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Cell)[part];
  }
  return cur;
};

const stated = (doc: unknown, path: string): string => {
  const v = leaf(doc, `${path}.$value`);
  return v === undefined || v === null ? "—" : String(v);
};

function colorRoles(doc: unknown): string[] {
  const color = leaf(doc, "color") as Cell | undefined;
  if (color === undefined) return [];
  const out: string[] = [];
  for (const [name, value] of Object.entries(color)) {
    if (name.startsWith("$")) continue;
    if (value === null || typeof value !== "object") continue;
    if ("$value" in (value as Cell)) out.push(name);
  }
  return out;
}

const otherMode = () => (mode() === "dark" ? "light" : "dark");

function activeTree(): TokenTree {
  const doc = starterThemes[theme() as keyof typeof starterThemes] as unknown;
  const parsed = parseTokens(doc as Parameters<typeof parseTokens>[0]);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tree;
}

function SwatchToken(props: { name: string; doc: unknown }): JSX.Element {
  const d = props.doc as Cell;
  const color = (d["color"] ?? {}) as Cell;
  const token = (color[props.name] ?? {}) as Cell;
  const base = String(token["$value"] ?? "—");
  const dark = String(
    (token["$modes"] as Cell | undefined)?.["dark"] ?? "",
  );
  const value = dark ? `${base} · dark ${dark}` : base;
  return (
    <div class="flex items-center gap-3">
      <div
        class={`h-7 w-12 shrink-0 rounded-sm border border-border-strong bg-${props.name}`}
      />
      <div class="min-w-0 text-sm">
        <span class="font-mono text-xs text-text">{props.name}</span>
        <span class="ml-2 font-mono text-xs text-text-muted break-all">
          {value}
        </span>
      </div>
    </div>
  );
}

const CHARACTER_ROWS: readonly {
  label: string;
  read: (doc: unknown) => string;
}[] = [
  { label: "button case", read: (d) => stated(d, "button.case") },
  { label: "button tracking", read: (d) => stated(d, "button.tracking") },
  { label: "badge pill", read: (d) => stated(d, "badge.pill") },
  { label: "checkbox depth", read: (d) => stated(d, "checkbox.depth") },
  { label: "radius md", read: (d) => stated(d, "radius.md") },
  { label: "motion base", read: (d) => stated(d, "motion.duration.base") },
  { label: "motion loop", read: (d) => stated(d, "motion.duration.loop") },
  { label: "heading face", read: (d) => stated(d, "font.family.heading") },
  { label: "brand face", read: (d) => stated(d, "font.family.brand") },
];

export default function Catalog(): JSX.Element {
  const doc = createMemo(() => starterDoc());
  const catalog = createMemo(() => describeCatalog(activeTree()));
  const [query, setQuery] = createSignal("");
  const matches = (name: string): boolean => {
    const q = query().trim().toLowerCase();
    return q === "" || name.toLowerCase().includes(q);
  };
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Tokens & Catalog"
        lede="Every utility class the active starter generates, grouped by intent. Switch the starter theme in the top bar and the catalog re-derives live."
      />

      <Section id="palette" title="The palette, live">
        <div class="mt-4 grid gap-6 md:grid-cols-2">
          <div class="rounded-lg border border-border bg-surface-raised p-4">
            <p class="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
              Active mode ({mode()})
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              <For each={colorRoles(doc())}>
                {(name) => <SwatchToken name={name} doc={doc()} />}
              </For>
            </div>
          </div>
          <div class="rounded-lg border border-border bg-surface-raised p-4">
            <p class="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
              Opposite mode ({otherMode()})
            </p>
            <Probe>
              <div class="grid gap-2 sm:grid-cols-2">
                <For each={colorRoles(doc())}>
                  {(name) => <SwatchToken name={name} doc={doc()} />}
                </For>
              </div>
            </Probe>
          </div>
        </div>
      </Section>

      <Section id="character" title="Where the starters disagree">
        <div class="mt-3 overflow-x-auto rounded-lg border border-border">
          <table class="w-full border-collapse wrap">
            <thead>
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-4">decision</th>
                <For each={starterList}>
                  {(name) => <th class="py-2 pr-4 font-mono">{name}</th>}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={CHARACTER_ROWS}>
                {(row) => (
                  <tr class="border-b border-border">
                    <td class="text-text-muted">{row.label}</td>
                    <For each={starterList}>
                      {(name) => (
                        <td class="font-mono text-xs break-all">
                          {row.read(
                            starterThemes[
                              name as keyof typeof starterThemes
                            ] as unknown as Record<string, unknown>,
                          )}
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="catalog" title="The catalog, by intent">
        <p class="max-w-prose">
          Type to filter. Each section lists the utilities the active starter
          produces for that intent, in scale order.
        </p>
        <div class="mt-3">
          <input
            type="search"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="Filter utilities — e.g. text-, p-, rounded-"
            aria-label="Filter utilities"
            class="w-full max-w-screen-sm"
          />
        </div>
        <For each={SECTIONS}>
          {(section) => (
            <Show
              when={utilitiesFor(section, catalog()).filter(matches).length > 0}
            >
              <div class="mt-6">
                <h3 class="text-text">
                  {section.title}{" "}
                  <span class="font-mono text-xs text-text-muted">
                    {utilitiesFor(section, catalog()).filter(matches).length}
                  </span>
                </h3>
                <p class="text-sm text-text-muted">{section.blurb}</p>
                <div class="mt-2 flex flex-wrap gap-1">
                  <For each={utilitiesFor(section, catalog()).filter(matches)}>
                    {(name) => <Chip>{name}</Chip>}
                  </For>
                </div>
              </div>
            </Show>
          )}
        </For>
      </Section>

      <Section id="shortcuts" title="Shortcuts & animation">
        <p class="max-w-prose">
          The shipped shortcuts compose utilities under one name; the{" "}
          <code>animate-*</code> utilities come from{" "}
          <code>@spinjs/spin/animation</code> and spend the theme's motion
          tokens.
        </p>
        <div class="mt-3 flex flex-wrap gap-1">
          <For
            each={Object.keys(spinShortcuts as Record<string, string>)
              .filter(matches)
              .sort()}
          >
            {(name) => <Chip>{name}</Chip>}
          </For>
          <For each={animationContract.variants.filter(matches)}>
            {(name) => <Chip>{name}</Chip>}
          </For>
        </div>
      </Section>
    </main>
  );
}
