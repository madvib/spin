/**
 * The seat pill: what the studio is showing, as one joined object.
 *
 * Mode toggle, theme select, and the seat badge — the `join` primitive
 * merges them, so the seams collapse to one border. The pickers keep their
 * machines and binds; only their triggers live inside the pill. The badge
 * names the seat, and its hover card carries the facts the bar used to
 * narrate: counts, file state, scope, and design language.
 */
import { createEffect, createSignal, Show } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { hoverCard, modePicker, themePicker } from "@spinjs/components";
import {
  activeBrand,
  activeModes,
  activeName,
  activeTokenCount,
  divergedFromDisk,
  hasProjectFile,
  isDirty,
  modeChoice,
  registry,
  setActiveMode,
  setActiveName,
  systemMode,
} from "../lib/store.ts";
import { stateLabel } from "../lib/theme.ts";
import {
  paintThemeSwatches,
  themeOffered,
} from "./Settings.tsx";
import Checks from "./Checks.tsx";
/** The studio's words for what is true about the file. */
function fileStateText(dirty: boolean, diverged: boolean): string {
  const parts: string[] = [];
  if (dirty) parts.push(stateLabel("unsaved"));
  if (diverged) parts.push(stateLabel("changed"));
  if (parts.length === 0) parts.push(stateLabel("saved"));
  return parts.join(" · ");
}

export default function SeatPill() {
  const theme = () => activeName();
  const dirty = () => isDirty(theme());
  const diverged = () => divergedFromDisk(theme());
  const [modeEl, setModeEl] = createSignal<HTMLElement>();
  const modeCtl = createSpinComponent(modeEl, modePicker);
  const [themeEl, setThemeEl] = createSignal<HTMLElement>();
  const themeCtl = createSpinComponent(themeEl, themePicker);
  const [cardEl, setCardEl] = createSignal<HTMLElement>();
  const cardCtl = createSpinComponent(cardEl, hoverCard);
  createEffect(() => cardCtl.bind({}, {}));
  createEffect(() => paintThemeSwatches());
  createEffect(() =>
    modeCtl.bind(
      {
        value: modeChoice(),
        modes: [...activeModes()],
        hideWhenSingle: activeModes().length <= 1,
        systemMode: systemMode(),
        syncDocument: false,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          const next = event.detail.value;
          setActiveMode(next === "dark" || next === "system" ? next : "light");
        },
      },
    )
  );
  createEffect(() =>
    themeCtl.bind(
      {
        value: activeName(),
        themes: themeOffered(),
        syncDocument: false,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          setActiveName(event.detail.value);
        },
      },
    )
  );
  /** Where the theme is served from, when it is not the project's own file. */
  const scopeLine = (): string | undefined => {
    if (hasProjectFile(theme())) return undefined;
    const origin = registry()?.find((entry) => entry.name === theme())?.origin;
    if (origin === "brand") return "Read-only — served from the brand";
    if (origin === "verbatim") return "Read-only — served from verbatim themes";
    return undefined;
  };
  const badgeText = () => {
    const brand = activeBrand();
    // A theme backed by its own brand names it once: `probe · probe` says
    // nothing twice does not. The pair shows only when they differ.
    return brand === undefined || brand.name === theme()
      ? theme()
      : `${brand.name} · ${theme()}`;
  };
  const language = (): string | undefined => activeBrand()?.designLanguage;
  const counts = () => activeTokenCount();
  return (
    <div class="inline-flex min-w-0 items-center rounded-full border bg-surface">
      <studio-mode-pill
        ref={(el: HTMLElement) => setModeEl(el)}
        class="inline-flex items-center"
        prop:value={modeChoice()}
        prop:modes={[...activeModes()]}
        prop:hideWhenSingle={activeModes().length <= 1}
      />
      <span class="h-5 border-s" aria-hidden="true" />
      <studio-theme-picker
        ref={(el: HTMLElement) => setThemeEl(el)}
        class="inline-flex items-center"
        prop:value={activeName()}
        prop:themes={themeOffered()}
      />
      <span class="hidden h-5 border-s sm:inline-block" aria-hidden="true" />
      <studio-seat-card ref={(el: HTMLElement) => setCardEl(el)} class="hidden items-center sm:inline-flex">
        <span
          slot="badge"
          data-testid="seat-badge"
          aria-label={dirty() ? `${badgeText()} · unsaved changes` : badgeText()}
          title={scopeLine()}
          class="inline-flex items-center gap-1 type-caption text-muted"
        >
          <span class="visually-hidden">{badgeText()}</span>
          <Show when={dirty()}>
            <span class="inline-block h-2 w-2 rounded-full bg-primary text-on-primary" aria-hidden="true" />
          </Show>
          <Show
            when={scopeLine()}
            fallback={<span class="inline-block icon-sm i-lucide-info" aria-hidden="true" />}
          >
            <span class="inline-block icon-sm i-lucide-lock" aria-hidden="true" />
          </Show>
        </span>
        <div slot="card" class="flex flex-col gap-1 type-body">
          <p>
            Theme: {theme()}
            <Show when={activeBrand()}>
              {(brand) => <span class="text-muted"> · Brand: {brand().name}</span>}
            </Show>
          </p>
          <p>
            {counts().authored} authored · {counts().composed} composed
          </p>
          <p class="text-muted">{fileStateText(dirty(), diverged())}</p>
          <Show when={scopeLine()}>
            {(line) => <p class="text-muted">{line()}</p>}
          </Show>
          <Show when={language()}>
            {(name) => <p class="text-muted">{name()}</p>}
          </Show>
        </div>
      </studio-seat-card>
      <span class="h-5 border-s" aria-hidden="true" />
      <Checks />
    </div>
  );
}
