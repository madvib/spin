/**
 * The studio's own controls: the theme under edit, the mode it is shown in,
 * and the edge the host's drawer takes.
 *
 * The theme picker was a native `<select>` and the mode was a pair of text
 * buttons, and neither wore the studio's theme. A native select is drawn by
 * the browser, so it wore the browser's idea of a field — the one control in
 * the chrome that no theme can dress, sitting in the middle of a strip the
 * studio drew. The mode's two words were the loudest things on that strip,
 * where everything else is a glyph.
 *
 * Both are controls the studio draws now: a chip that carries the theme's
 * swatch and its name, and a single button that carries the mode as a glyph
 * and opens the list of modes behind it.
 *
 * The runtime's menu is the right answer for both — a menu that filters as
 * it opens, with the roving focus and the typeahead a real menu has. The
 * runtime's menu is not in this tree yet, so what is here is the panel built
 * from the primitives that are: the theme's own button, the theme's own
 * surface, the theme's own swatches.
 */

import {
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js";
import type { JSX } from "solid-js";
import {
  activeMode,
  activeModes,
  activeName,
  dockSide,
  modeChoice,
  setActiveMode,
  setActiveName,
  setDockSide,
  systemMode,
  themeText,
} from "../lib/store.ts";
import type { ModeChoice } from "../lib/store.ts";
import { listProjectThemes } from "../lib/themes.ts";
import { summarySwatches } from "../lib/overview.ts";
import type { Chip } from "../lib/overview.ts";

/**
 * The project's themes, fetched once per session. Module scope so the
 * settings section and anywhere else that names a theme share one fetch.
 *
 * The one write that changes this list is the registry's own create/delete,
 * which asks for a refetch — a picker still offering yesterday's names is a
 * picker that edits a theme the project no longer has.
 */
const [projectThemes, { refetch: refetchProjectThemes }] = createResource(
  listProjectThemes,
);

export { refetchProjectThemes };

/**
 * A theme's own palette, as the colours it declares.
 *
 * The strip is DATA rather than a utility's paint: a chip's utility paints
 * the ACTIVE theme's token, and the picker shows every theme at once — so
 * the colour beside a name is that theme's own resolved value, drawn from
 * the value and not from the studio's tokens. It is the same answer the
 * overview's cards give, read the same way.
 */
function palette(text: string | undefined, mode: string): readonly Chip[] {
  if (text === undefined) return [];
  const groups = summarySwatches(text);
  const group = groups.find((entry) => entry.mode === mode) ?? groups[0];
  return group?.chips ?? [];
}

/**
 * A theme's palette, drawn as a strip of its own colours.
 *
 * The strip is the theme's own ink, so it cannot be a utility: a utility
 * paints the active theme's token, and this strip sits beside every theme
 * at once.
 */
function Swatch(props: { chips: readonly Chip[] }) {
  return (
    <span
      class="flex h-4 w-10 shrink-0 overflow-hidden rounded-sm border border-border"
      aria-hidden="true"
    >
      <For each={props.chips}>
        {(chip) => (
          <span
            class="flex-1"
            // The theme's OWN colour, resolved: the value IS the paint.
            style={{ background: chip.value }}
            title={chip.label}
          />
        )}
      </For>
    </span>
  );
}

/**
 * A row of a menu.
 *
 * A plain button rather than a `bare` one: `bare` opts out of the control's
 * paint AND out of its hover, so a bare row cannot show the reader where
 * the pointer is. This row states what it wants — no fill, no edge, the
 * page's ink — over the button's own paint, and the theme's focus ring
 * still comes from the primitive.
 *
 * The row that is current says so twice: `aria-current` for the reader, and
 * the surface for the eye.
 */
const MENU_ROW =
  "flex min-h-0 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-transparent px-2 py-1 text-left text-sm font-normal text-text-muted hover:bg-surface-sunken hover:text-text data-[current]:bg-surface-sunken data-[current]:text-text data-[current]:font-medium";

/**
 * A menu that opens from a trigger.
 *
 * The panel is always in the document and hidden rather than unmounted: a
 * control the reader cannot see is still a control the studio has, and the
 * studio's own tests seat a theme by writing to the picker the way a
 * `<select>` is written to. `hidden` keeps the panel out of the way and out
 * of the tab order.
 *
 * The dismissal is the platform's own: a click anywhere else, or Escape,
 * closes it — the two things a reader reaches for when a menu is in the way.
 */
function Menu(props: {
  /** What the control is called, for the reader and for the pointer. */
  readonly label: string;
  /** The trigger's own face: the glyph, or the name and the swatch. */
  readonly trigger: JSX.Element;
  /** The panel: what the menu offers, and the way to close it. */
  readonly children: (close: () => void) => JSX.Element;
  /** The id the studio's own tests read the control by. */
  readonly id?: string;
  /** The control itself, for the studio's own tests to write to. */
  readonly control?: (element: HTMLButtonElement) => void;
}) {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const close = () => setOpen(false);

  const onPointer = (event: MouseEvent) => {
    if (open() && !root?.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  onMount(() => {
    document.addEventListener("click", onPointer, true);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("click", onPointer, true);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <div class="relative" ref={root}>
      <button
        type="button"
        id={props.id}
        ref={props.control}
        class="flex h-8 min-h-0 items-center gap-2 rounded-md border border-border bg-surface px-2 text-sm text-text hover:bg-surface-sunken"
        // The panel is the studio's own, so the control says what it opens:
        // a menu, not a dialog and not a disclosure.
        aria-haspopup="menu"
        aria-label={props.label}
        title={props.label}
        onClick={() => setOpen(!open())}
      >
        {props.trigger}
      </button>
      <div
        hidden={!open()}
        class="absolute bottom-full end-0 z-dropdown mb-1 w-max rounded-md border border-border bg-surface-raised p-1 shadow-lg"
      >
        {props.children(close)}
      </div>
    </div>
  );
}

/**
 * The project theme picker.
 *
 * Lists the themes the project serves — the shipped starters, forked by its
 * own files — not the studio's own chrome. The selected theme drives the
 * preview surface only.
 *
 * It lives in the bar along the bottom of the window, on every route: the
 * theme under edit is a fact about the whole studio, not about one page, and
 * a control that only some pages carry is a control the reader has to hunt
 * for.
 *
 * The chip carries the theme's SWATCH as well as its name: a list of names
 * is a list the reader has to know, and the colour is the thing they are
 * actually looking for.
 */
export function ThemePicker(props: { compact?: boolean }) {
  const id = props.compact === true ? "theme-picker-compact" : "theme-picker";

  /** The document behind a theme: the editor's own, or the registry's. */
  const source = (name: string): string | undefined =>
    name === activeName()
      ? themeText()
      : (projectThemes() ?? []).find((theme) => theme.name === name)?.text;

  let control: HTMLButtonElement | undefined;

  /**
   * The picker, as the studio's own end-to-end tests read it.
   *
   * They seat a theme by writing the picker's `value` and firing a `change`,
   * and they ask what the picker offers by reading its `options` — the
   * vocabulary of a `<select>`. The picker is not a `<select>` any more, so
   * that vocabulary is stated here: the same two properties, on the control
   * that draws the themes, with the same meaning. The tests keep reading the
   * picker the way they always did, and the picker is a control the studio's
   * own theme can dress.
   */
  onMount(() => {
    if (control === undefined) return;
    Object.defineProperty(control, "options", {
      configurable: true,
      get: () =>
        (projectThemes() ?? []).map((theme) => ({
          value: theme.name,
          label: theme.name,
        })),
    });
    Object.defineProperty(control, "value", {
      configurable: true,
      get: () => activeName(),
      set: (next: string) => {
        setActiveName(next);
        control?.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });
  });

  return (
    <Menu
      id={id}
      label={`Theme: ${activeName()}`}
      control={(element) => {
        control = element;
      }}
      trigger={
        <>
          <Swatch chips={palette(source(activeName()), activeMode())} />
          <span class="max-w-20 truncate">{activeName()}</span>
          <span
            class="i-lucide-chevron-down icon-sm shrink-0 text-text-muted"
            aria-hidden="true"
          />
        </>
      }
    >
      {(close) => (
        <ul class="flow-list flex flex-col">
          <For each={projectThemes()}>
            {(theme) => (
              <li>
                <button
                  type="button"
                  class={MENU_ROW}
                  data-current={theme.name === activeName() ? "" : undefined}
                  aria-current={theme.name === activeName()
                    ? "true"
                    : undefined}
                  onClick={() => {
                    setActiveName(theme.name);
                    close();
                  }}
                >
                  <Swatch chips={palette(theme.text, activeMode())} />
                  <span class="truncate">{theme.name}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      )}
    </Menu>
  );
}

/**
 * The mode control.
 *
 * ONE button, carrying the mode as a glyph, and the list of modes behind
 * it. It was two text buttons side by side, which is a pair of choices
 * rather than a control: the bar is a strip of glyphs, and two words in the
 * middle of it were the loudest things on it.
 *
 * The list has a third answer — SYSTEM, which follows the operating system.
 * The studio is a tool that shows a document under two lights, and the
 * machine already knows which light its owner is working in: a control that
 * cannot say "whatever the machine says" makes the author answer a question
 * the machine has already answered.
 *
 * The theme owns its modes, so a mode it does not declare disables rather
 * than letting the press lie: the store clamps the editor on the way in,
 * and the control explains itself on the way out.
 */
const MODES: readonly {
  readonly choice: ModeChoice;
  readonly label: string;
  readonly icon: string;
}[] = [
  { choice: "light", label: "Light", icon: "i-lucide-sun" },
  { choice: "dark", label: "Dark", icon: "i-lucide-moon" },
  { choice: "system", label: "System", icon: "i-lucide-monitor" },
];

export function ModePicker() {
  /** The glyph the current answer wears. */
  const glyph = () =>
    MODES.find((mode) => mode.choice === modeChoice())?.icon ??
      "i-lucide-monitor";

  /** The current answer, in words. */
  const said = () =>
    MODES.find((mode) => mode.choice === modeChoice())?.label ?? "System";

  return (
    <Menu
      label={`Color mode: ${said()}`}
      trigger={
        <span
          class={`${glyph()} icon-md shrink-0`}
          aria-hidden="true"
        />
      }
    >
      {(close) => (
        <ul class="flow-list flex flex-col">
          <For each={MODES}>
            {(mode) => (
              <li>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={modeChoice() === mode.choice}
                  class={MENU_ROW}
                  // A theme that serves one mode cannot be shown in the
                  // other, so the answer it does not serve is refused —
                  // and it says why, rather than sitting there dead.
                  disabled={mode.choice === "system"
                    ? false
                    : !activeModes().includes(mode.choice)}
                  title={mode.choice === "system"
                    ? `Follow the operating system — it asks for ${systemMode()}`
                    : activeModes().includes(mode.choice)
                    ? undefined
                    : `The theme declares no ${mode.label.toLowerCase()} mode`}
                  onClick={() => {
                    setActiveMode(mode.choice);
                    close();
                  }}
                >
                  <span
                    class={`${mode.icon} icon-sm shrink-0`}
                    aria-hidden="true"
                  />
                  <span>{mode.label}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      )}
    </Menu>
  );
}

/**
 * Which edge the host's drawer takes.
 *
 * The studio does not know where the host will put it, so it asks: the host
 * answers with a message and the layout re-branches in place. A handedness
 * choice rather than a session one, so it is remembered.
 */
export function DrawerEdge() {
  return (
    <div class="row-sm" role="group" aria-label="Drawer edge">
      <span>Drawer</span>
      <button
        type="button"
        class="bare row-sm whitespace-nowrap text-text"
        aria-pressed={dockSide() === "left"}
        onClick={() => {
          setDockSide("left");
          globalThis.parent.postMessage("spin:side-left", "*");
        }}
      >
        <span
          class="inline-block icon-md i-lucide-panel-left"
          aria-hidden="true"
        />
        <span>Left</span>
      </button>
      <button
        type="button"
        class="bare row-sm whitespace-nowrap text-text"
        aria-pressed={dockSide() === "right"}
        onClick={() => {
          setDockSide("right");
          globalThis.parent.postMessage("spin:side-right", "*");
        }}
      >
        <span
          class="inline-block icon-md i-lucide-panel-right"
          aria-hidden="true"
        />
        <span>Right</span>
      </button>
    </div>
  );
}
