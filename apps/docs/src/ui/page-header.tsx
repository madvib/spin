/**
 * Standard header for `/docs/*` pages: subgroup eyebrow, h1, lede, and
 * Markdown-for-Agents controls (`Copy Markdown` and `View .md`).
 */
import { A, useLocation } from "@solidjs/router";
import { createSignal, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { docsPageContext } from "../nav.ts";
import { mode, Section as SharedSection, theme } from "@spinjs/kit";
import { starterThemes } from "@spinjs/spin/theme";

export function serializeMainToMarkdown(
  main: HTMLElement,
  meta: { title: string; description?: string; path: string },
): string {
  const lines: string[] = [
    "---",
    `title: ${JSON.stringify(meta.title)}`,
  ];
  if (meta.description) {
    lines.push(`description: ${JSON.stringify(meta.description)}`);
  }
  lines.push(`url: ${JSON.stringify(meta.path)}`, "---", "");

  const walk = (root: Element) => {
    for (const child of Array.from(root.children)) {
      const tag = child.tagName.toLowerCase();
      if (child.getAttribute("data-md-ignore") === "true") continue;
      if (tag === "h1") {
        lines.push(`# ${(child.textContent ?? "").trim()}`, "");
      } else if (tag === "h2") {
        lines.push(`## ${(child.textContent ?? "").trim()}`, "");
      } else if (tag === "h3") {
        lines.push(`### ${(child.textContent ?? "").trim()}`, "");
      } else if (tag === "p") {
        const text = (child.textContent ?? "").trim();
        if (text) lines.push(text, "");
      } else if (tag === "pre") {
        const code = (child.textContent ?? "").trim();
        if (code) lines.push("```", code, "```", "");
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(child.querySelectorAll(":scope > li"));
        items.forEach((li, idx) => {
          const prefix = tag === "ol" ? `${idx + 1}. ` : "- ";
          lines.push(`${prefix}${(li.textContent ?? "").trim()}`);
        });
        if (items.length > 0) lines.push("");
      } else {
        walk(child);
      }
    }
  };
  walk(main);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function PageHeader(props: {
  readonly title: string;
  readonly lede?: JSX.Element | string;
  readonly group?: string;
  readonly playgroundExample?: string;
}): JSX.Element {
  const location = useLocation();
  const [copiedMd, setCopiedMd] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const ctx = () => docsPageContext(location.pathname);
  const groupLabel = () => props.group ?? ctx().current?.groupLabel ?? "Docs";
  const mdHref = () => `${location.pathname.replace(/\/$/, "")}.md`;

  const onCopyMarkdown = async () => {
    try {
      const res = await fetch(mdHref(), {
        headers: { Accept: "text/markdown" },
      });
      if (res.ok && res.headers.get("content-type")?.includes("markdown")) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
      } else {
        const main = document.querySelector<HTMLElement>("main");
        if (main) {
          const md = serializeMainToMarkdown(main, {
            title: props.title,
            description: ctx().current?.summary,
            path: location.pathname,
          });
          await navigator.clipboard.writeText(md);
        }
      }
      setCopiedMd(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopiedMd(false), 1400);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <header class="mb-8 flex flex-col gap-3 border-b border-border pb-6">
      <div
        data-md-ignore="true"
        class="flex flex-wrap items-center justify-between gap-2"
      >
        <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
          {groupLabel()}
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <Show when={props.playgroundExample}>
            {(ex) => (
              <A
                href={`/playground?example=${ex()}`}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text no-underline transition-colors duration-fast hover:border-primary hover:text-primary"
              >
                <span class="i-lucide-play icon-sm" aria-hidden="true" />
                <span>Playground</span>
              </A>
            )}
          </Show>
          <button
            type="button"
            onClick={onCopyMarkdown}
            class="bare inline-flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted transition-colors duration-fast hover:border-border-strong hover:text-text"
          >
            <span
              class={
                copiedMd()
                  ? "i-lucide-check icon-sm text-primary"
                  : "i-lucide-file-text icon-sm"
              }
              aria-hidden="true"
            />
            <span>{copiedMd() ? "Copied .md" : "Copy Markdown"}</span>
          </button>
          <a
            href={mdHref()}
            target="_blank"
            rel="noreferrer"
            class="font-mono text-xs"
          >
            View .md
          </a>
        </div>
      </div>
      <h1 class="text-text">{props.title}</h1>
      <Show when={props.lede}>
        <p class="max-w-prose text-text-muted">{props.lede}</p>
      </Show>
    </header>
  );
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

export function Chip(props: { children: JSX.Element }): JSX.Element {
  return (
    <span class="rounded-sm border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text-muted">
      {props.children}
    </span>
  );
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

export interface ThemeDocument {
  color?: Record<string, unknown>;
  [key: string]: unknown;
}

export function starterDoc(): ThemeDocument {
  return starterThemes[
    theme() as keyof typeof starterThemes
  ] as ThemeDocument;
}
