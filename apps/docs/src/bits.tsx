/**
 * Shared documentation building blocks: sections, code frames, chips, dual-mode
 * probes, and the `<docs-bundler-tabs>` bundler configuration switcher.
 */
import type { JSX } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { starterThemes } from "@spinjs/spin/theme";
import { mode, Section as SharedSection, theme } from "@spinjs/kit";
import { createSpinComponent } from "@spinjs/components/solid";
import { tabs } from "@spinjs/components/tabs";
import { CodeFrame } from "./ui/code-frame.tsx";
import { GETTING_STARTED_SNIPPETS } from "./pages/docs/getting-started/getting-started.snippets.ts";

export function Reveal(props: { children: JSX.Element }): JSX.Element {
  let el: HTMLDivElement | undefined;
  const [shown, setShown] = createSignal(false);
  onMount(() => {
    const reduced =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
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
  fact?: string;
  note?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <SharedSection
      title={props.title}
      id={props.id}
      fact={props.fact}
      note={props.note}
      class="mb-10 w-full scroll-mt-20"
      muted
    >
      {props.children}
    </SharedSection>
  );
}

export function Eyebrow(props: { children: JSX.Element }): JSX.Element {
  return <p class="overline">{props.children}</p>;
}

export function Code(props: {
  code: string;
  class?: string;
  lang?: "html" | "json" | "ts" | "bash";
  title?: string;
}): JSX.Element {
  return (
    <CodeFrame
      code={props.code}
      class={props.class}
      lang={props.lang}
      title={props.title}
    />
  );
}

export function Chip(props: { children: JSX.Element }): JSX.Element {
  return (
    <span class="rounded-sm border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
      {props.children}
    </span>
  );
}

export function starterDoc(): ThemeDocument {
  return starterThemes[
    theme() as keyof typeof starterThemes
  ] as ThemeDocument;
}

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

const BUNDLER_TABS: Readonly<
  Record<
    string,
    {
      readonly name: string;
      readonly file: string;
      readonly code: string;
      readonly note: string;
    }
  >
> = {
  vite: {
    name: "Vite",
    file: "vite.config.ts",
    code: GETTING_STARTED_SNIPPETS.vite,
    note: "Compiles uno.css, transforms lib/components/*.html, and mounts the Studio on your dev server.",
  },
  rspack: {
    name: "Rspack",
    file: "rspack.config.ts",
    code: GETTING_STARTED_SNIPPETS.rspack,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  webpack: {
    name: "webpack",
    file: "webpack.config.mjs",
    code: GETTING_STARTED_SNIPPETS.webpack,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  rollup: {
    name: "Rollup",
    file: "rollup.config.mjs",
    code: GETTING_STARTED_SNIPPETS.rollup,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  rolldown: {
    name: "Rolldown",
    file: "rolldown.config.ts",
    code: GETTING_STARTED_SNIPPETS.rolldown,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  esbuild: {
    name: "esbuild",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.esbuild,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  bun: {
    name: "Bun",
    file: "spin.config.ts",
    code: GETTING_STARTED_SNIPPETS.bun,
    note: "Compiles uno.css and lib/components/*.html; run `npx spin studio` alongside the dev server.",
  },
  unocss: {
    name: "UnoCSS",
    file: "uno.config.ts",
    code: GETTING_STARTED_SNIPPETS.unocss,
    note: "Stylesheet only: `spinPreset` in an existing UnoCSS app, with explicit theme documents.",
  },
};

export function BundlerPicker(): JSX.Element {
  const [tabsEl, setTabsEl] = createSignal<HTMLElement>();
  const tabsCtl = createSpinComponent(tabsEl, tabs);
  const [selected, setSelected] = createSignal("vite");

  createEffect(() => {
    tabsCtl.bind(
      { value: selected() },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          if (event.detail.value in BUNDLER_TABS) {
            setSelected(event.detail.value);
          }
        },
      },
    );
  });

  const current = () => BUNDLER_TABS[selected()] ?? BUNDLER_TABS.vite!;

  return (
    <div class="flex flex-col gap-3">
      <docs-bundler-tabs ref={setTabsEl} />
      <CodeFrame
        code={current().code}
        lang="ts"
        title={current().file}
      />
      <p class="text-xs text-text-muted">{current().note}</p>
    </div>
  );
}
