/**
 * Page bits the docs share: sections, code blocks, and the two-column mode
 * probe used by the threads page.
 *
 * The probe is the honest demo of the whole product: a subtree that re-declares
 * `data-theme` and `data-mode` carries that deck and mode's variables, so the
 * same `bg-primary` utility resolves to ink inside it and paper outside it.
 * Nothing is styled by hand; nothing needs JS to resolve a color.
 */
import type { JSX } from "solid-js";
import { starterThemes } from "@spin/theme/themes";
import { mode, theme } from "../shell.tsx";

export interface DeckDocument {
  color?: Record<string, unknown>;
  [key: string]: unknown;
}

export function Section(props: {
  title: string;
  id?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <section class="mb-10 scroll-mt-20" id={props.id}>
      <h2 class="mb-2 flex items-center gap-2">
        <span class="block h-1 w-4 rounded-full bg-primary" />
        {props.title}
      </h2>
      <div class="text-text-muted">
        {props.children}
      </div>
    </section>
  );
}

export function Eyebrow(props: { children: JSX.Element }): JSX.Element {
  return (
    <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
      {props.children}
    </p>
  );
}

export function Code(props: {
  code: string;
  class?: string;
}): JSX.Element {
  return (
    <pre
      class={`font-mono text-sm bg-surface-raised border border-border rounded-md p-4 overflow-x-auto text-text ${
        props.class ?? ""
      }`}
    >
      <code>{props.code}</code>
    </pre>
  );
}

export function Chip(props: { children: JSX.Element }): JSX.Element {
  return (
    <span class="font-mono text-xs border border-border bg-surface-raised rounded-sm px-2 py-1 text-text-muted">
      {props.children}
    </span>
  );
}

/**
 * The document of the deck the site currently wears. Reading `theme()` twice
 * — once to invalidate, once to fetch — is what makes callers re-resolve on
 * a deck switch.
 */
export function deckOf(): DeckDocument {
  return starterThemes[
    theme() as keyof typeof starterThemes
  ] as DeckDocument;
}

/** The value a color token states for the paper (base) rendering. */
export function colorValue(doc: DeckDocument, name: string): string {
  const leaf = (doc.color?.[name] ?? {}) as Record<string, unknown>;
  const value = leaf["$value"];
  return typeof value === "string" ? value : "";
}

/** The value a color token restates for ink mode, when it does. */
export function colorInk(doc: DeckDocument, name: string): string {
  const leaf = (doc.color?.[name] ?? {}) as Record<string, unknown>;
  const modes = (leaf["modes"] ?? {}) as Record<string, unknown> | undefined;
  const dark = modes?.["dark"];
  return typeof dark === "string" ? dark : "";
}

/**
 * One deck, both modes, side by side.
 *
 * The subtree re-declares the deck and the OTHER mode of it, so the theme
 * utilities the children use resolve against that rendering. Single-mode
 * decks (console) show one column and say so.
 */
export function Probe(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="flex items-center gap-2"
      data-theme={theme()}
      data-mode={mode() === "dark" ? "light" : "dark"}
    >
      {props.children}
    </div>
  );
}
