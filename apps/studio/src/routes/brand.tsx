/**
 * Brand management: identity, parent design language ($extends), authored layers
 * (tokens.json, reference.json, elements.json, primitives/*.json), and runtime
 * facets (*.palette.json, *.spacing.json).
 */
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { A } from "@solidjs/router";
import { createSpinComponent } from "@spinjs/components/solid";
import { menu } from "@spinjs/components/menu";
import { starterThemes } from "@spinjs/theme/themes";
import {
  activeBrand,
  activeName,
  note,
  noteDiscarded,
  project,
  refetchBrand,
  refetchConfig,
  refetchProject,
  refetchThemes,
  reloadFromDisk,
  revertToSaved,
  seed,
  setActiveName,
  setThemeTextFor,
  themeSummaries,
  themeText,
  type ThemeSummary,
} from "../lib/store.ts";
import { refetchProjectThemes } from "../components/Settings.tsx";
import {
  copyTheme,
  initProject,
  listFacets,
  listProjectThemes,
  problemText,
  removeTheme,
  renameBrand,
} from "../lib/themes.ts";
import { addMode, authoredLeafCount, declaredModes, removeMode } from "../lib/theme.ts";
import { seedToken, themeCardMenuItems } from "../lib/overview.ts";
import { ensureDraftFontStyles, facesOf } from "../components/ThemePreview.tsx";
import { Badge, ConcernPage, Frame, Section } from "../components/Concern.tsx";
import { GenerateTheme } from "../components/GenerateTheme.tsx";

function ThemeCardMenu(props: {
  summary: ThemeSummary;
  onReload: () => void;
  onToggleMode: (mode: "light" | "dark", add: boolean) => void;
  onDuplicate: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  confirmingName: string | null;
}) {
  const [el, setEl] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(el, menu);
  createEffect(() => {
    const text = seed(props.summary.name) ?? "";
    ensureDraftFontStyles(facesOf(text));
  });
  createEffect(() =>
    ctl.bind(
      {
        items: themeCardMenuItems(
          props.summary,
          seed(props.summary.name) ?? "",
          activeName(),
          props.confirmingName,
        ),
      },
      {
        select: (event: CustomEvent<{ value: string }>) => {
          const value = event.detail.value;
          if (value === "reload") props.onReload();
          else if (value === "add-light") props.onToggleMode("light", true);
          else if (value === "remove-light") props.onToggleMode("light", false);
          else if (value === "add-dark") props.onToggleMode("dark", true);
          else if (value === "remove-dark") props.onToggleMode("dark", false);
          else if (value === "duplicate") props.onDuplicate();
          else if (value === "discard") props.onDiscard();
          else if (value === "delete") props.onDelete();
        },
      },
    ),
  );
  return <studio-theme-menu ref={setEl} />;
}
const LANGUAGE_CAPTIONS: Readonly<Record<string, string>> = {
  minimal: "Quiet surfaces, hairlines, nothing to prove.",
  material: "Tonal steps and ink that means it.",
  neobrutalist: "Hard offsets, loud borders, no apologies.",
  editorial: "Serif authority and column rhythm.",
  neumorphic: "Soft extrusion, one surface.",
  glassmorphic: "Translucent planes over depth.",
};

const LAYER_GUIDE: readonly {
  readonly file: string;
  readonly role: string;
  readonly description: string;
  readonly href: string;
  readonly linkLabel: string;
}[] = [
  {
    file: "tokens.json",
    role: "Brand identity",
    description:
      "Parent design language ($extends), font faces, 13 named font.style.* tuples, semantic color roles with light/dark modes, and shape.",
    href: "/tokens/colors",
    linkLabel: "Edit in Tokens →",
  },
  {
    file: "reference.json",
    role: "Reference scales",
    description:
      "Optional raw color ramps (color.neutral.50–900) and spatial or typographic scale steps that semantic tokens alias.",
    href: "/tokens/spacing",
    linkLabel: "Edit scales →",
  },
  {
    file: "elements.json",
    role: "HTML element type",
    description:
      "Optional layer mapping intrinsic HTML elements (element.h1.type, element.p.type, element.code.type) to named type styles.",
    href: "/tokens/type/styles",
    linkLabel: "Edit in Type →",
  },
  {
    file: "primitives/*.json",
    role: "Component slots",
    description:
      "Optional per-primitive overrides (primitives/button.json, primitives/card.json) for geometry, paint, and slot typography.",
    href: "/components?kind=primitive",
    linkLabel: "Edit in Primitives →",
  },
];

export default function BrandPage() {
  const summaries = createMemo(() => themeSummaries());
  const localBrands = createMemo(() =>
    summaries().filter((summary) => summary.file !== null)
  );
  const brand = () => activeBrand();
  const [facets, { refetch: refetchFacets }] = createResource(listFacets);
  const layers = () => Object.entries(brand()?.layers ?? {});
  const [nextBrand, setNextBrand] = createSignal("");
  const [renameProblem, setRenameProblem] = createSignal<string | null>(null);
  const [facetModalOpen, setFacetModalOpen] = createSignal(false);
  const [confirming, setConfirming] = createSignal<string | null>(null);
  const [deleteProblems, setDeleteProblems] = createSignal<Record<string, string>>({});

  async function duplicate(theme: string): Promise<void> {
    try {
      const taken = new Set((await listProjectThemes()).map((item) => item.name));
      let next = `${theme}-copy`;
      for (let index = 2; taken.has(next); index++) {
        next = `${theme}-copy-${index}`;
      }
      const written = await copyTheme(theme, next);
      if (written.error !== null) {
        note(written.error);
        return;
      }
      refetchThemes();
      refetchProjectThemes();
      setActiveName(next);
      note(`${theme} duplicated to ${next}.`);
    } catch (err) {
      note(problemText(err));
    }
  }

  async function remove(theme: string): Promise<void> {
    if (confirming() !== theme) {
      setConfirming(theme);
      return;
    }
    try {
      const { error } = await removeTheme(theme);
      if (error !== null) {
        setDeleteProblems((prev) => ({ ...prev, [theme]: error }));
        setConfirming(null);
        return;
      }
      setDeleteProblems((prev) => {
        const next = { ...prev };
        delete next[theme];
        return next;
      });
      setConfirming(null);
      refetchThemes();
      refetchProjectThemes();
    } catch (err) {
      setDeleteProblems((prev) => ({ ...prev, [theme]: problemText(err) }));
      setConfirming(null);
    }
  }

  async function reload(theme: string): Promise<void> {
    try {
      const state = await reloadFromDisk(theme);
      refetchThemes();
      note(
        state === "changed"
          ? `${theme} changed on disk — the studio now shows the file.`
          : `${theme} reloaded from disk.`,
      );
    } catch (err) {
      note(problemText(err));
    }
  }
  const currentExtends = createMemo((): string | undefined => {
    const fromBrand = brand()?.designLanguage;
    if (fromBrand !== undefined) return fromBrand;
    try {
      const parsed = JSON.parse(themeText()) as Record<string, unknown>;
      return typeof parsed["$extends"] === "string"
        ? parsed["$extends"]
        : undefined;
    } catch {
      return undefined;
    }
  });

  function changeDesignLanguage(language: string): void {
    try {
      const parsed = JSON.parse(themeText()) as Record<string, unknown>;
      const next = JSON.stringify({ ...parsed, $extends: language }, null, 2) + "\n";
      if (setThemeTextFor(activeName(), next)) {
        note(`Design language set to ${language}. Save to persist.`);
      }
    } catch (err) {
      note(problemText(err));
    }
  }

  async function rename(): Promise<void> {
    const facts = brand();
    const root = project()?.root;
    const target = nextBrand().trim();
    if (facts === undefined || root === undefined || target === "") return;
    setRenameProblem(null);
    try {
      const renamed = await renameBrand(root, facts.name, target);
      if (renamed.error !== null) {
        setRenameProblem(renamed.error);
        return;
      }
      setNextBrand("");
      refetchProject();
      refetchThemes();
      refetchConfig();
      refetchBrand();
      setActiveName(target);
      note(`Brand renamed to ${target}.`);
    } catch (err) {
      setRenameProblem(problemText(err));
    }
  }

  async function quickScaffold(): Promise<void> {
    const report = project();
    if (report === undefined) return;
    try {
      const made = await initProject(report.root, "default", "minimal");
      if (made.error !== null) {
        note(made.error);
        return;
      }
      refetchProject();
      refetchThemes();
      refetchProjectThemes();
      refetchBrand();
      setActiveName("default");
    } catch (err) {
      note(problemText(err));
    }
  }

  return (
    <ConcernPage
      title="Brand"
      note="Manage your brand identity in spin/<brand>/, its parent design language, authored token layers, and runtime facets."
    >
      <Section
        title={brand()?.name ?? activeName()}
        fact={brand() !== undefined ? `spin/${brand()!.name}/` : "design language preview"}
        note="Your brand owns default light and dark modes directly and layers over a starting design language."
      >
        <Show
          when={brand() !== undefined || localBrands().length > 0}
          fallback={
            <Frame class="stack p-4">
              <div class="split flex-wrap">
                <div class="stack-xs">
                  <span class="type-body-emphasized">
                    No local brand directory in <code>spin/</code> yet
                  </span>
                  <p class="text-muted">
                    You are currently previewing the built-in{" "}
                    <code>{activeName()}</code> design language. Create a brand
                    to write <code>spin/&lt;brand&gt;/tokens.json</code>.
                  </p>
                </div>
                <div class="row-sm">
                  <A href="/init" role="button" class="primary">
                    Create your brand
                  </A>
                  <button
                    type="button"
                    class="secondary"
                    onClick={() => void quickScaffold()}
                  >
                    Scaffold default brand
                  </button>
                </div>
              </div>
            </Frame>
          }
        >
          <Frame class="stack p-4">
            <div class="split flex-wrap">
              <div class="stack-xs">
                <div class="row-sm">
                  <span class="type-title">{brand()?.name ?? activeName()}</span>
                  <Show when={currentExtends()}>
                    {(lang) => <Badge tone="primary">extends {lang()}</Badge>}
                  </Show>
                </div>
                <p class="text-muted">
                  Directory: <code>spin/{brand()?.name ?? activeName()}/</code>
                </p>
              </div>
              <div class="row-sm flex-wrap">
                <Show when={brand()}>
                  <label class="flex flex-row flex-nowrap items-center gap-2">
                    <span class="type-caption text-muted">Rename to</span>
                    <input
                      type="text"
                      class="w-36"
                      placeholder="new-name"
                      aria-label="New brand name"
                      value={nextBrand()}
                      onInput={(event) => {
                        setNextBrand(event.currentTarget.value);
                        setRenameProblem(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void rename();
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    class="secondary s-sm"
                    onClick={() => void rename()}
                  >
                    Rename
                  </button>
                </Show>
                <A href="/init" role="button" class="secondary s-sm">
                  Create another brand
                </A>
              </div>
            </div>
            <Show when={renameProblem()}>
              {(message) => (
                <p class="text-semantic-error" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <Show when={localBrands().length > 1}>
              <div class="stack-xs border-t pt-3">
                <span class="type-caption-emphasized text-muted">
                  Brands in this project
                </span>
                <div class="flex flex-wrap gap-2">
                  <For each={localBrands()}>
                    {(entry) => (
                      <button
                        type="button"
                        class={entry.name === activeName() ? "primary s-sm" : "secondary s-sm"}
                        onClick={() => setActiveName(entry.name)}
                      >
                        {entry.name}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </Frame>
        </Show>
      </Section>

      <Section
        title="Parent Design Language"
        fact={currentExtends() ?? "none"}
        note="The built-in starting physics ($extends) your brand layers over. Tokens omitted by your brand inherit from this design language."
      >
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={Object.keys(starterThemes)}>
            {(lang) => {
              const selected = () => currentExtends() === lang;
              return (
                <button
                  type="button"
                  aria-pressed={selected()}
                  onClick={() => changeDesignLanguage(lang)}
                  class="bare flex flex-col items-start gap-1 rounded-lg border bg-surface-raised p-3 text-left transition-colors hover:border-strong"
                  classList={{
                    "border-primary border-2": selected(),
                  }}
                >
                  <div class="split w-full">
                    <span class="type-label">{lang}</span>
                    <Show when={selected()}>
                      <Badge tone="primary">$extends</Badge>
                    </Show>
                  </div>
                  <span class="type-caption text-muted">
                    {LANGUAGE_CAPTIONS[lang] ?? ""}
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </Section>

      <div id="layers">
        <Section
          title="Brand Layers"
          fact={`${layers().length} ${layers().length === 1 ? "file" : "files"} on disk`}
          note="How spin/<brand>/ splits identity, reference scales, element typography, and per-primitive overrides."
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <For each={LAYER_GUIDE}>
              {(item) => {
                const matching = () =>
                  layers().filter(([file]) =>
                    item.file === "primitives/*.json"
                      ? file.startsWith("primitives/")
                      : file === item.file
                  );
                const authoredCount = () =>
                  matching().reduce(
                    (sum, [, doc]) => sum + authoredLeafCount(JSON.stringify(doc)),
                    0
                  );
                return (
                  <Frame class="stack-sm p-4">
                    <div class="split">
                      <code>{item.file}</code>
                      <Badge tone={matching().length > 0 ? "primary" : "info"}>
                        {matching().length > 0
                          ? `${authoredCount()} authored`
                          : "inherited"}
                      </Badge>
                    </div>
                    <p class="text-muted">{item.description}</p>
                    <div class="mt-auto pt-1">
                      <A href={item.href} class="type-caption">
                        {item.linkLabel}
                      </A>
                    </div>
                  </Frame>
                );
              }}
            </For>
          </div>
        </Section>
      </div>

      <div id="facets">
        <Section
          title="Runtime Facets"
          fact={`${facets()?.length ?? 0} ${(facets()?.length ?? 0) === 1 ? "facet" : "facets"}`}
          note="Optional *.palette.json (data-palette) and *.spacing.json (data-spacing) overlays in spin/<brand>/themes/ that swap ink or density without duplicating typography or shape."
        >
          <Frame class="stack p-4">
            <div class="split flex-wrap">
              <p class="max-w-prose text-muted">
                Add a palette facet when a section or user preference needs an
                alternative color scheme over your brand, or a spacing facet for
                compact/comfortable density.
              </p>
              <button
                type="button"
                class="secondary s-sm"
                onClick={() => setFacetModalOpen(true)}
              >
                New palette
              </button>
            </div>
            <Show
              when={(facets()?.length ?? 0) > 0}
              fallback={
                <p class="text-muted">
                  No facets declared in <code>spin/{brand()?.name ?? activeName()}/themes/</code> yet.
                </p>
              }
            >
              <div class="border-t pt-3">
                <ul class="flex flex-col gap-2">
                  <For each={facets() ?? []}>
                    {(facet) => (
                    <li class="split rounded-md border bg-surface px-3 py-2">
                      <div class="row-sm">
                        <span class="type-label">{facet.name}</span>
                        <code>
                          data-{facet.kind}="{facet.name}"
                        </code>
                      </div>
                      <Badge tone="info">{facet.kind}</Badge>
                    </li>
                  )}
                </For>
                </ul>
              </div>
            </Show>
          </Frame>
        </Section>
      </div>
      <Show when={summaries().length > 1}>
        <Section
          title="Served Themes"
          fact={`${summaries().length} themes`}
          note="Themes served by this project's configuration and spin/ directory."
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <For each={summaries()}>
              {(summary) => {
                const cardInk = (): string | undefined => {
                  const text = seed(summary.name) ?? "";
                  if (declaredModes(text).length !== 1) return undefined;
                  return seedToken(text, "color.text") || undefined;
                };
                const cardMuted = (): string | undefined => {
                  const text = seed(summary.name) ?? "";
                  if (declaredModes(text).length !== 1) return undefined;
                  return seedToken(text, "color.text-muted") || cardInk();
                };
                return (
                  <article
                    data-testid="theme-card"
                    class="flex min-h-40 flex-col gap-2 rounded-lg border bg-surface-raised p-3"
                    classList={{
                      "border-primary border-2": summary.name === activeName(),
                    }}
                    style={{
                      background:
                        declaredModes(seed(summary.name) ?? "").length === 1
                          ? seedToken(seed(summary.name) ?? "", "color.surface") || undefined
                          : undefined,
                      color: cardInk(),
                    }}
                  >
                    <div class="row-sm flex-wrap">
                      <button
                        type="button"
                        class="bare min-w-0 flex-1 justify-start text-left type-label"
                        style={{
                          "font-family": seedToken(
                            seed(summary.name) ?? "",
                            "font.family.heading",
                            "inherit",
                          ),
                          color: cardInk(),
                        }}
                        onClick={() => setActiveName(summary.name)}
                        aria-current={summary.name === activeName()}
                        title="Switch to this theme"
                      >
                        {summary.name}
                      </button>
                      <Show when={summary.dirty}>
                        <span class="shrink-0 type-caption text-semantic-warning">
                          unsaved
                        </span>
                      </Show>
                      <Show when={summary.state === "changed"}>
                        <span
                          class="shrink-0 type-caption text-semantic-warning"
                          title="The file on disk is not what the studio wrote"
                        >
                          changed on disk
                        </span>
                      </Show>
                      <Show when={!summary.valid}>
                        <span class="shrink-0 type-caption text-semantic-error">
                          {summary.issues.length === 1
                            ? "1 issue"
                            : `${summary.issues.length} issues`}
                        </span>
                      </Show>
                      <ThemeCardMenu
                        summary={summary}
                        onReload={() => void reload(summary.name)}
                        onToggleMode={(mode, add) => {
                          const text = seed(summary.name) ?? "";
                          try {
                            const next = add
                              ? addMode(text, mode)
                              : removeMode(text, mode);
                            if (setThemeTextFor(summary.name, next)) {
                              note(
                                add
                                  ? `${mode} mode added.`
                                  : `${mode} mode removed.`,
                              );
                            }
                          } catch (err) {
                            note(problemText(err));
                          }
                        }}
                        onDuplicate={() => void duplicate(summary.name)}
                        onDiscard={() => {
                          revertToSaved(summary.name);
                          noteDiscarded(summary.name);
                        }}
                        onDelete={() => void remove(summary.name)}
                        confirmingName={confirming()}
                      />
                    </div>
                    <Show when={deleteProblems()[summary.name]}>
                      {(message) => (
                        <p class="text-semantic-error" role="alert">
                          {message()}
                        </p>
                      )}
                    </Show>
                    <Show
                      when={summary.swatches.some((group) => group.chips.length > 0)}
                      fallback={<p class="text-muted">No palette declared yet.</p>}
                    >
                      <div class="stack-sm">
                        <For
                          each={summary.swatches.filter((group) => group.chips.length > 0)}
                        >
                          {(group) => (
                            <div class="flex items-center gap-2">
                              <span
                                class="w-10 shrink-0 type-code text-muted"
                                style={{ color: cardMuted() }}
                              >
                                {group.mode}
                              </span>
                              <div class="flex h-6 flex-1 overflow-hidden rounded-sm border">
                                <For each={group.chips}>
                                  {(chip) => (
                                    <span
                                      class="flex-1"
                                      style={{ background: chip.value }}
                                      title={`${chip.label} ${chip.value}`}
                                    />
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <span
                      class="mt-auto truncate type-caption text-muted"
                      style={{ color: cardMuted() }}
                    >
                      {summary.tokens} tokens · {summary.file ?? "the brand"}
                    </span>
                  </article>
                );
              }}
            </For>
          </div>
        </Section>
      </Show>


      <Show when={facetModalOpen()}>
        <dialog
          aria-label="New palette"
          class="stack panel w-[56rem] max-w-[calc(100vw-2rem)]"
          ref={(el: HTMLDialogElement) => {
            requestAnimationFrame(() => {
              if (el.isConnected && !el.open) el.showModal();
            });
          }}
          onClose={() => setFacetModalOpen(false)}
        >
          <GenerateTheme
            onDone={() => {
              setFacetModalOpen(false);
              void refetchFacets();
            }}
            onCancel={() => setFacetModalOpen(false)}
          />
        </dialog>
      </Show>
    </ConcernPage>
  );
}
