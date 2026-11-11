import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { colorPicker } from "@spinjs/components/color-picker";
import { themeModes, toHex } from "@spinjs/theme";
import { registry, refetchThemes, note } from "../lib/store.ts";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { createFacet, problemText } from "../lib/themes.ts";
import { ThemePreview } from "./ThemePreview.tsx";
import { seedTokens } from "../lib/overview.ts";


const TITLES = ["Source", "Palette", "Name"];

function defaultSource(): string {
  const all = registry() ?? [];
  for (const theme of all) {
    try {
      if (themeModes(JSON.parse(theme.text)).length > 1) return theme.name;
    } catch {
      continue;
    }
  }
  return all[0]?.name ?? "";
}

export function GenerateTheme(props: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = createSignal(0);
  const [sourceName, setSourceName] = createSignal<string>(defaultSource());

  const sourceText = createMemo<string>(() => {
    const found = (registry() ?? []).find((t) => t.name === sourceName());
    return found?.text ?? "";
  });

  const seeds = createMemo(() => seedTokens(sourceText()));

  const [primary, setPrimary] = createSignal<string>(seeds().primary);
  const [secondary, setSecondary] = createSignal<string>(seeds().secondary);
  const [accent, setAccent] = createSignal<string>(seeds().accent);

  createEffect(() => {
    setPrimary(seeds().primary);
    setSecondary(seeds().secondary);
    setAccent(seeds().accent);
  });
  const [name, setName] = createSignal<string>("");
  const [problem, setProblem] = createSignal<string | null>(null);

  const previewName = createMemo(() => (name().trim() === "" ? "Untitled" : name().trim()));

  async function create(): Promise<void> {
    const next = name().trim();
    if (next === "" || sourceName() === "") return;
    setProblem(null);
    try {
      const tokens: Record<string, unknown> = {
        color: {
          $type: "color",
          primary: { $value: primary() },
          secondary: { $value: secondary() },
          accent: { $value: accent() },
        },
      };
      const created = await createFacet(sourceName(), next, "palette", tokens);
      if (created.error !== null) {
        setProblem(created.error);
        return;
      }
      refetchThemes();
      refetchProjectThemes();
      props.onDone();
      note(`${next}.palette created.`);
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
                class="bare flex min-w-0 flex-1 items-center gap-2 rounded-md border p-2 text-left"
                classList={{ "border-primary border-2": role() === r }}
                aria-pressed={role() === r}
                onClick={() => setRole(r)}
              >
                <span
                  class="h-8 w-8 shrink-0 rounded-md border"
                  style={{ background: toHex(shownFor(r)) ?? shownFor(r) }}
                />
                <span class="min-w-0">
                  <span class="block truncate type-label">
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

  return (
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="stack min-w-0 gap-6">
        <ol class="flex flex-wrap items-center gap-2" aria-label="New palette steps">
          <For each={TITLES}>
            {(title, index) => (
              <li class="flex flex-none items-center gap-2">
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-solid type-body-emphasized"
                  classList={{
                    "border-primary bg-primary text-on-primary": index() <= step(),
                    "border bg-surface-raised text-muted": index() > step(),
                  }}
                  aria-current={index() === step() ? "step" : undefined}
                >
                  {index() + 1}
                </span>
                <span class="whitespace-nowrap type-caption-emphasized">{title}</span>
              </li>
            )}
          </For>
        </ol>

        <div class="min-w-0">
          <Show when={step() === 0}>
            <div class="grid min-w-0 grid-cols-2 gap-2" role="group" aria-label="Source">
              <For each={registry() ?? []}>
                {(theme) => (
                  <button
                    type="button"
                    class="bare min-w-0 overflow-hidden rounded-md border p-1 text-left"
                    classList={{ "border-primary border-2": sourceName() === theme.name }}
                    aria-pressed={sourceName() === theme.name}
                    onClick={() => setSourceName(theme.name)}
                  >
                    <ThemePreview text={theme.text} name={theme.name} static />
                  </button>
                )}
              </For>
              <Show when={(registry() ?? []).length === 0}>
                <span class="block type-caption">No themes yet — save one first, then start from it.</span>
              </Show>
            </div>
          </Show>

          <Show when={step() === 1}>
            <PaletteStep />
          </Show>

          <Show when={step() === 2}>
            <div class="stack gap-4 pt-2">
              <input
                type="text"
                placeholder="Name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
              <Show when={problem() !== null}>
                <p class="text-semantic-error" role="alert">
                  {problem()}
                </p>
              </Show>
            </div>
          </Show>
        </div>

        <div class="flex items-center justify-between gap-4 border-t pt-4">
          <button
            type="button"
            class="secondary disabled:opacity-50"
            disabled={step() === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <div class="flex items-center gap-2">
            <Show when={step() < 2}>
              <button
                type="button"
                class="disabled:opacity-50"
                onClick={() => setStep((s) => Math.min(2, s + 1))}
              >
                Next
              </button>
            </Show>
            <Show when={step() === 2}>
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
        <ThemePreview text={sourceText()} name={previewName()} />
      </div>
    </div>
  );
}

export default GenerateTheme;
