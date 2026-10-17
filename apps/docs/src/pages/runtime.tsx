/**
 * The runtime story — told honestly.
 *
 * v0.1 is the styling layer, and this page explains what lands after it
 * without inventing docs for software that has not merged. What exists
 * today is real: the dashboard's daemon, the studio's live loop, the
 * overlay — the runtime is the part of the repo this site deliberately
 * does not depend on.
 */
import type { JSX } from "solid-js";
import { Chip, Code, Section } from "./bits.tsx";

const PAINT = `<button>reel out</button>   <!-- the tag is only ever paint -->
<button aria-expanded={open()}>reel out</button>  <!-- your state, your expando -->`;

export function Runtime(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-lg px-4 py-10 md:py-14">
      <h1 class="flex items-center gap-3 text-2xl tracking-tight">
        The runtime
        <span class="font-mono text-xs border border-border bg-surface-raised text-text-muted rounded-sm px-2 py-0.5">
          merges after v0.1
        </span>
      </h1>
      <p class="text-text-muted max-w-prose mt-1">
        Two halves, one system: the styling layer — running today — and the
        component stack that lands on it after v0.1. Here is the honest map.
      </p>

      <Section id="now" title="What runs today">
        <div class="grid gap-1.5 max-w-screen-md">
          {[
            "The theme pipeline: parse, validate, emit — the deck, its modes, its faces",
            "The preset: scale utilities plus every primitive's paint, wired by one plugin",
            "The lint plugin: authored UI stays inside the vocabulary, mechanically",
            "Oracles: visual and layout checks that render real pages and assert on them",
            "The three surfaces: this site, the reference, the studio",
          ].map((line) => (
            <div class="flex items-start gap-2">
              <span class="mt-2 block h-1 w-3 rounded-full bg-primary shrink-0" />
              <p class="m-0">{line}</p>
            </div>
          ))}
        </div>
        <p class="mt-4">
          The paint is complete and stateless, and that is a feature: your app
          keeps its state, spin keeps its styling. A bare tag is styled — IDs
          and handlers stay yours:
        </p>
        <Code code={PAINT} />
      </Section>

      <Section id="after" title="What merges after">
        <p>
          The component stack is a real endeavor, and it has been built — it
          merges after 0.1 so each half can be promised, shipped, and verified
          on its own:
        </p>
        <div class="grid gap-3 sm:grid-cols-3 mt-4">
          {[
            [
              "Claimed elements",
              "Elements opt in beyond paint: focus state, disclosure geometry, selection, form wiring — with the studio able to name them.",
            ],
            [
              "Behaviors",
              "The parts every product rebuilds — dialog focus-trapping, popover positioning with their stacking scopes, list keyboard flows.",
            ],
            [
              "The daemon",
              "The API over a running app: the studio edits a live stylesheet through RPC, the overlay reconciles it, and the app never reboots.",
            ],
          ].map(([title, body]) => (
            <div class="border-l-4 border-primary bg-surface-raised rounded-md p-4">
              <p class="m-0 font-semibold text-text">{title}</p>
              <p class="m-0 mt-1.5 text-sm">{body}</p>
            </div>
          ))}
        </div>
        <p class="mt-4">
          The rule that keeps it honest: the runtime grows the{" "}
          <em>vocabulary</em>{" "}
          — it never adds a second way to style. An app that ships only the
          styling layer today upgrades the same markup tomorrow; paint is the
          runtime's skin, not a separate truth.
        </p>
      </Section>

      <Section id="studio" title="The studio, meanwhile">
        <p>
          The studio is already real: it opens over any spin app, reads the
          project's theme documents, edits them against a legibility floor — and
          writes them back. This site's decks are ordinary documents; put a
          studio next to a repo and the blueprints of everything you just saw
          are one panel away.
        </p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <Chip>data-theme</Chip>
          <Chip>data-mode</Chip>
          <Chip>legibility floor</Chip>
          <Chip>overlay</Chip>
          <Chip>RPC</Chip>
        </div>
      </Section>
    </main>
  );
}
