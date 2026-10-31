import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { colorPicker } from "@spinjs/components/color-picker";
import { scaffoldTheme, themeModes, toHex, treeToJson } from "@spinjs/theme";
import { registry, refetchThemes, setActiveName, note } from "../lib/store.ts";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { saveTheme, problemText, listProjectThemes } from "../lib/themes.ts";
import type { SpinFontDeclaration } from "../lib/fonts.ts";
import { composeDraft } from "../lib/generate.ts";
import { ThemePreview } from "./ThemePreview.tsx";
import { FamilyField } from "./FamilyField.tsx";
import { seedTokens } from "../lib/overview.ts";


const TITLES = ["Template", "Palette", "Fonts", "Name"];

function defaultStarter(): string {
  const all = registry() ?? [];
  if (all.some((t) => t.name === "silk")) return "silk";
  for (const theme of all) {
    try {
      if (themeModes(JSON.parse(theme.text)).length > 1) return theme.name;
    } catch {
      continue;
    }
  }
  return all[0]?.name ?? "Blank";
}

export function GenerateTheme(props: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = createSignal(0);
  const [starterName, setStarterName] = createSignal<string>(defaultStarter());

  const starterText = createMemo<string>(() => {
    if (starterName() === "Blank") return treeToJson(scaffoldTheme());
    const found = (registry() ?? []).find((t) => t.name === starterName());
    return found?.text ?? treeToJson(scaffoldTheme());
  });

  const seeds = createMemo(() => seedTokens(starterText()));

  const [primary, setPrimary] = createSignal<string>(seeds().primary);
  const [secondary, setSecondary] = createSignal<string>(seeds().secondary);
  const [accent, setAccent] = createSignal<string>(seeds().accent);
  const [bodyFont, setBodyFont] = createSignal<string>(seeds().bodyFont);
  const [bodyFace, setBodyFace] = createSignal<SpinFontDeclaration | undefined>();
  const [headingFont, setHeadingFont] = createSignal<string>(seeds().headingFont);
  const [headingFace, setHeadingFace] = createSignal<SpinFontDeclaration | undefined>();

  createEffect(() => {
    setPrimary(seeds().primary);
    setSecondary(seeds().secondary);
    setAccent(seeds().accent);
    setBodyFont(seeds().bodyFont);
    setBodyFace(undefined);
    setHeadingFont(seeds().headingFont);
    setHeadingFace(undefined);
  });
  const [name, setName] = createSignal<string>("");
  const [problem, setProblem] = createSignal<string | null>(null);

  const [lastGoodText, setLastGoodText] = createSignal<string>(starterText());

  const choices = createMemo(() => ({
    primary: primary(),
    secondary: secondary(),
    accent: accent(),
    bodyFont: bodyFont(),
    headingFont: headingFont(),
    faces: [bodyFace(), headingFace()].filter(
      (face): face is SpinFontDeclaration => face !== undefined,
    ),
    starter: starterName() === "Blank" ? null : starterName(),
    name: name(),
  }));

  const [draftErr, setDraftErr] = createSignal<string | null>(null);
  const draftText = createMemo<string>(() => {
    try {
      const t = composeDraft(starterText(), choices());
      setLastGoodText(t);
      setDraftErr(null);
      return t;
    } catch (err) {
      setDraftErr(problemText(err));
      return lastGoodText();
    }
  });

  const previewName = createMemo(() => (name().trim() === "" ? "Untitled" : name().trim()));

  async function create(): Promise<void> {
    const next = name().trim();
    if (next === "") return;
    setProblem(null);
    try {
      const listed = await listProjectThemes();
      if (listed.some((t) => t.name === next)) {
        setProblem(`a theme named ${next} already exists`);
        return;
      }
      const written = await saveTheme(next, draftText());
      if (written.error !== null) {
        setProblem(written.error);
        return;
      }
      refetchThemes();
      refetchProjectThemes();
      setActiveName(next);
      props.onDone();
      note(`${next} created.`);
    } catch (err) {
      setProblem(problemText(err));
    }
  }

  type Role = "primary" | "secondary" | "accent";
  const [role, setRole] = createSignal<Role>("primary");
  const roleValue = (r: Role): string =>
    r === "primary" ? primary() : r === "secondary" ? secondary() : accent();
  const setRoleValue = (r: Role, v: string): void => {
    if (r === "primary") setPrimary(v);
    else if (r === "secondary") setSecondary(v);
    else setAccent(v);
  };

  function PaletteStep() {
    const [el, setEl] = createSignal<HTMLElement>();
    const picker = createSpinComponent(el, colorPicker);
    const shown = createMemo(() => roleValue(role()));
    const seed = createMemo(() => toHex(shown()) ?? shown());
    createEffect(() => {
      picker.bind({ value: seed(), format: "hex", inline: true }, {
        "value-change-end": (e: CustomEvent<{ value: string }>) =>
          setRoleValue(role(), e.detail.value),
      });
    });
    const roles: readonly Role[] = ["primary", "secondary", "accent"];
    const labelOf = (r: Role): string =>
      r === "primary" ? "Primary" : r === "secondary" ? "Secondary" : "Accent";
    return (
      <div class="stack gap-4 pt-2">
        <div class="flex items-center gap-2" role="group" aria-label="Roles">
          <For each={roles}>
            {(r) => (
              <button
                type="button"
                class="bare flex min-w-0 flex-1 items-center gap-2 rounded-md border border-solid border-border p-2 text-left"
                classList={{ "border-primary border-2": role() === r }}
                aria-pressed={role() === r}
                onClick={() => setRole(r)}
              >
                <span
                  class="h-8 w-8 shrink-0 rounded-md border border-solid border-border"
                  style={{ background: toHex(shownFor(r)) ?? shownFor(r) }}
                />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-text">
                    {labelOf(r)}
                  </span>
                </span>
              </button>
            )}
          </For>
        </div>
        <div class="stack-sm">
          <studio-color-picker-inline
            ref={(e: HTMLElement) => setEl(e)}
          >
            <span slot="label">{labelOf(role())}</span>
          </studio-color-picker-inline>
        </div>
      </div>
    );
  }

  function shownFor(r: "primary" | "secondary" | "accent"): string {
    return roleValue(r);
  }

  function FontSlot(p: {
    label: string;
    value: () => string;
    onCommit: (stack: string, font?: SpinFontDeclaration) => void;
  }) {
    return (
      <div class="stack-sm">
        <span class="text-sm font-medium text-text">{p.label}</span>
        <FamilyField
          value={p.value()}
          label={p.label}
          onCommit={p.onCommit}
        />
      </div>
    );
  }

  return (
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="stack min-w-0 gap-6">
        <ol class="flex items-center gap-2" aria-label="New theme steps">
          <For each={TITLES}>
            {(title, index) => (
              <li class="flex min-w-0 flex-1 items-center gap-2">
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-solid text-sm font-semibold"
                  classList={{
                    "border-primary bg-primary text-on-primary": index() <= step(),
                    "border-border bg-surface-raised text-text-muted": index() > step(),
                  }}
                  aria-current={index() === step() ? "step" : undefined}
                >
                  {index() + 1}
                </span>
                <span class="truncate text-xs font-medium text-text">{title}</span>
              </li>
            )}
          </For>
        </ol>

        <div class="min-w-0">
          <Show when={step() === 0}>
            <div class="grid min-w-0 grid-cols-2 gap-2" role="group" aria-label="Template">
              <For each={registry() ?? []}>
                {(theme) => (
                  <button
                    type="button"
                    class="bare min-w-0 overflow-hidden rounded-md border border-solid border-border p-1 text-left"
                    classList={{ "border-primary border-2": starterName() === theme.name }}
                    aria-pressed={starterName() === theme.name}
                    onClick={() => setStarterName(theme.name)}
                  >
                    <ThemePreview text={theme.text} name={theme.name} static />
                  </button>
                )}
              </For>
              <button
                type="button"
                class="bare min-w-0 overflow-hidden rounded-md border border-solid border-border p-1 text-left"
                classList={{ "border-primary border-2": starterName() === "Blank" }}
                aria-pressed={starterName() === "Blank"}
                onClick={() => setStarterName("Blank")}
              >
                <ThemePreview text={treeToJson(scaffoldTheme())} name="Blank" static />
              </button>
            </div>
          </Show>

          <Show when={step() === 1}>
            <PaletteStep />
          </Show>

          <Show when={step() === 2}>
            <div class="stack gap-6 pt-2">
              <FontSlot
                label="Body"
                value={bodyFont}
                onCommit={(stack, font) => { setBodyFont(stack); setBodyFace(font); }}
              />
              <FontSlot
                label="Heading"
                value={headingFont}
                onCommit={(stack, font) => { setHeadingFont(stack); setHeadingFace(font); }}
              />
            </div>
          </Show>

          <Show when={step() === 3}>
            <div class="stack gap-4 pt-2">
              <input
                type="text"
                placeholder="Name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
              <Show when={problem() !== null || draftErr() !== null}>
                <p class="text-sm text-semantic-error" role="alert">
                  {problem() ?? draftErr()}
                </p>
              </Show>
            </div>
          </Show>
        </div>

        <div class="flex items-center justify-between gap-4 border-t border-border pt-4">
          <button
            type="button"
            class="secondary disabled:opacity-50"
            disabled={step() === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <div class="flex items-center gap-2">
            <Show when={step() < 3}>
              <button
                type="button"
                class="disabled:opacity-50"
                onClick={() => setStep((s) => Math.min(3, s + 1))}
              >
                Next
              </button>
            </Show>
            <Show when={step() === 3}>
              <button type="button" onClick={create}>
                Create
              </button>
            </Show>
            <button type="button" class="secondary" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="sticky top-0 min-w-0">
        <ThemePreview text={draftText()} name={previewName()} />
      </div>
    </div>
  );
}

export default GenerateTheme;
