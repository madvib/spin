/**
 * Page bits the docs share: sections, code blocks, and the two-column mode
 * probe used by the tokens page.
 *
 * The probe is the honest demo of the whole product: a subtree that
 * re-declares `data-theme` and `data-mode` carries that theme and mode's
 * variables, so the same `bg-primary` utility resolves to dark inside it
 * and light outside it. Nothing is styled by hand; nothing needs JS to
 * resolve a color
 */
import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { starterThemes } from "@spin/theme/themes";
import { mode, theme } from "@spin/kit";
import { CodeBlock, Section as SharedSection } from "@spin/kit";

/**
 * Scroll-in for the blocks below the fold: a plain opacity fade, skipped
 * for reduced motion and when the observer is unavailable.
 */
export function Reveal(props: { children: JSX.Element }): JSX.Element {
  let el: HTMLDivElement | undefined;
  const [shown, setShown] = createSignal(false);
  onMount(() => {
    const reduced = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    if (reduced || !("IntersectionObserver" in globalThis)) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el!);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div
      ref={el}
      class={`transition-opacity duration-slow ${
        shown() ? "opacity-100" : "opacity-0"
      }`}
    >
      {props.children}
    </div>
  );
}

export interface ThemeDocument {
  color?: Record<string, unknown>;
  [key: string]: unknown;
}

export function Section(props: {
  title: string;
  id?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <SharedSection
      title={props.title}
      id={props.id}
      class="mb-10 scroll-mt-20"
      muted
    >
      {props.children}
    </SharedSection>
  );
}

export function Eyebrow(props: { children: JSX.Element }): JSX.Element {
  return (
    <p class="overline">
      {props.children}
    </p>
  );
}

export function Code(props: {
  code: string;
  class?: string;
  lang?: "html" | "json" | "ts" | "bash";
}): JSX.Element {
  return (
    <CodeBlock
      code={props.code}
      class={props.class ?? "text-xs"}
      lang={props.lang}
    />
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
 * The document of the active starter. Reading `theme()` twice — once to
 * invalidate, once to fetch — is what makes callers re-resolve when the
 * theme changes.
 */
export function starterDoc(): ThemeDocument {
  return starterThemes[
    theme() as keyof typeof starterThemes
  ] as ThemeDocument;
}

/**
 * One theme, both modes, side by side.
 *
 * The subtree re-declares the theme and the OTHER mode of it, and paints
 * its own surface — a slab of the other rendering, so the utilities the
 * children use resolve against it. Single-mode themes (console) show one
 * column and say so.
 */
export function Probe(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class="rounded-sm bg-surface p-3 text-text"
      data-theme={theme()}
      data-mode={mode() === "dark" ? "light" : "dark"}
    >
      {props.children}
    </div>
  );
}
