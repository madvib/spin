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
 * Both are controls the studio draws now, and both are POPOVERS: a small
 * affordance in the bar, and a panel that floats over the page.
 *
 * The theme's affordance is a SWATCH — a small square of the theme's own
 * acting colour. The bar is a strip of controls, and a chip carrying a
 * theme's name was neither small enough to be a status nor big enough to be
 * a picker: the NAME is what the panel is for, and the COLOUR is what the
 * reader is actually looking for. So the button is a picture of the theme
 * and the panel is the picker — and the panel can be as large as a picker
 * needs, because it does not have to fit in the bar.
 *
 * A popover here is an OVERLAY. It is positioned out of the flow, so opening
 * it moves nothing and resizes nothing: the bar is the width of the window
 * and the height of one line, and a panel that pushed on it would make the
 * whole studio jump under the reader. The panels open DOWNWARD, because the
 * bar is along the TOP of the window and a panel that opened up would leave
 * the viewport.
 *
 * The runtime's menu is the right answer for both — a menu that filters as
 * it opens, with the roving focus and the typeahead a real menu has. The
 * runtime's menu is not in this tree yet, so what is here is the panel built
 * from the primitives that are: the theme's own button, the theme's own
 * surface, the theme's own swatches.
 */

import {
  createMemo,
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
 * What the studio knows about a theme, for the picker to draw.
 *
 * The colour is DATA rather than a utility's paint: a chip's utility paints
 * the ACTIVE theme's token, and the picker shows every theme at once — so
 * the colour beside a name is that theme's own resolved value, drawn from
 * the value and not from the studio's tokens. It is the same answer the
 * overview's cards give, read the same way.
 */
interface ThemeFacts {
  /** The colour the theme acts with, in the mode being shown. */
  readonly color: string | undefined;
  /** How many modes the theme serves. */
  readonly modes: number;
}

/**
 * A theme's acting colour and its mode count, read from its own document.
 *
 * The palette is ordered by how hard a theme leans on a colour, and the
 * first one it declares is the one it acts with. The mode count is what the
 * theme claims: a theme that declares its modes says how many, and a theme
 * that declares none serves the base alone — which is one mode, because the
 * studio's word for the base is light.
 *
 * A document that does not parse claims nothing: an empty answer, because
 * the picker keeps rendering while an author is half-way through typing.
 */
function facts(text: string | undefined, mode: string): ThemeFacts {
  if (text === undefined) return { color: undefined, modes: 0 };
  const groups = summarySwatches(text);
  const group = groups.find((entry) => entry.mode === mode) ?? groups[0];
  return { color: group?.chips[0]?.value, modes: groups.length };
}

/**
 * A theme's own colour, as a small square.
 *
 * The square is DATA, so it cannot be a utility: a utility paints the
 * active theme's token, and this one sits beside every theme at once.
 *
 * The square is 18px — a swatch, not a chip — and it wears the theme's
 * resolved value or the control's OWN ink. The fallback is `currentColor`
 * rather than a painted fill, so a theme that declares no colour still
 * reads as a swatch (a patch of the control's ink) instead of as a hole in
 * the bar, and so the swatch is never a colour the studio chose.
 */
function Swatch(props: { color: string | undefined }) {
  return (
    <span
      class="h-[18px] w-[18px] shrink-0 rounded-sm border border-border"
      style={{ background: props.color ?? "currentColor" }}
      aria-hidden="true"
    />
  );
}

/**
 * A row of a panel.
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
const ROW =
  "flex min-h-0 w-full items-center justify-start gap-2 rounded-md border border-transparent bg-transparent px-2 py-1 text-left text-sm font-regular text-text-muted hover:bg-surface-sunken hover:text-text aria-selected:bg-surface-sunken aria-selected:text-text aria-current:bg-surface-sunken aria-current:text-text";

/**
 * The affordance of a popover: a glyph in a box, in the bar's own language.
 *
 * One size, one ink, one hover — so the controls in the strip are a row of
 * equals. A control that is a word wide beside controls that are a glyph
 * wide reads as a different kind of thing, and the row stops being a strip
 * and becomes a list.
 */
const TRIGGER =
  "bare flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text";

/**
 * The panel's own frame.
 *
 * It is out of the flow — absolutely positioned below the affordance — so
 * opening it moves nothing. The bounds keep it honest at either edge: it
 * cannot grow past the width of the window, and it cannot grow taller than
 * the space the bar has below it, so a long list scrolls inside the panel
 * rather than leaving the viewport.
 *
 * It opens DOWNWARD: the bar is along the top of the window, so a panel
 * that opened upward would have nothing to open into.
 */
const PANEL =
  "absolute top-full start-0 z-dropdown mt-1 w-max max-w-[80vw] max-h-[60vh] overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-lg";

/**
 * Which popover in the bar is open.
 *
 * At most one: two panels over one another is a stack of furniture, and the
 * reader cannot tell which of them they are looking at.
 */
type PopoverName = "theme" | "mode";

const [openPopover, setOpenPopover] = createSignal<PopoverName | undefined>(
  undefined,
);

/**
 * A popover: a small affordance, and the panel that floats over the page.
 *
 * The panel is always in the document and hidden rather than unmounted: a
 * control the reader cannot see is still a control the studio has, and the
 * panel's rows are the studio's own answer to "what could I pick".
 * `hidden` keeps the panel out of the way and out of the tab order.
 *
 * The dismissal is the platform's own: a click anywhere else, or Escape,
 * closes it — the two things a reader reaches for when a panel is in the way.
 */
function Popover(props: {
  /** Which popover this is, so two of them do not open at once. */
  readonly name: PopoverName;
  /** What the control is called, for the reader and for the pointer. */
  readonly label: string;
  /** What the control opens: a list to pick from, or a list of choices. */
  readonly popup: "listbox" | "menu";
  /** The affordance's own test surface. */
  readonly testid: string;
  /** The panel's own test surface. */
  readonly panelTestid: string;
  /** The trigger's own face. */
  readonly trigger: JSX.Element;
  /**
   * The trigger's own hover, when the shared one does not fit.
   *
   * A glyph answers the pointer by changing its ink; a colour chip has no
   * ink to change, so it answers with the surface behind it.
   */
  readonly triggerClass?: string;
  /** The panel: what the popover offers, and the way to close it. */
  readonly children: (close: () => void) => JSX.Element;
}) {
  const open = () => openPopover() === props.name;
  const close = () => setOpenPopover(undefined);
  let root: HTMLDivElement | undefined;

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
    <div class="relative shrink-0" ref={root}>
      <button
        type="button"
        data-testid={props.testid}
        class={`${TRIGGER} ${props.triggerClass ?? ""}`}
        // The panel is the studio's own, so the control says what it opens.
        aria-haspopup={props.popup}
        aria-expanded={open()}
        aria-label={props.label}
        title={props.label}
        onClick={() => setOpenPopover(open() ? undefined : props.name)}
      >
        {props.trigger}
      </button>
      <div
        hidden={!open()}
        role={props.popup}
        data-testid={props.panelTestid}
        aria-label={props.label}
        class={PANEL}
      >
        {props.children(close)}
      </div>
    </div>
  );
}

/**
 * The project theme picker.
 *
 * A SWATCH in the bar and a panel over the page. The panel lists the themes
 * the project serves — the shipped starters, forked by its own files — not
 * the studio's own chrome. The selected theme drives the preview surface
 * only.
 *
 * It lives in the bar along the TOP of the window, on every route: the
 * theme under edit is a fact about the whole studio, not about one page, and
 * a control that only some pages carry is a control the reader has to hunt
 * for.
 *
 * Each row carries the theme's COLOUR as well as its name, and how many
 * modes the theme serves: a list of names is a list the reader has to know,
 * and the colour is the thing they are actually looking for.
 */
export function ThemePicker() {
  /** The document behind a theme: the editor's own, or the registry's. */
  const source = (name: string): string | undefined =>
    name === activeName()
      ? themeText()
      : (projectThemes() ?? []).find((theme) => theme.name === name)?.text;

  /** Every theme the project serves, with what the panel draws of it. */
  const offered = createMemo(() =>
    (projectThemes() ?? []).map((theme) => ({
      name: theme.name,
      ...facts(theme.text, activeMode()),
    }))
  );

  /** The theme under edit, with what the swatch draws of it. */
  const current = createMemo(() => facts(source(activeName()), activeMode()));

  return (
    <Popover
      name="theme"
      label={`Theme: ${activeName()}`}
      popup="listbox"
      testid="theme-picker"
      panelTestid="theme-list"
      trigger={<Swatch color={current().color} />}
      triggerClass="hover:bg-surface-sunken"
    >
      {(close) => (
        <For each={offered()}>
          {(theme) => (
            <button
              type="button"
              role="option"
              data-theme={theme.name}
              aria-selected={theme.name === activeName()}
              /*
                The row's NAME is the theme's name, and nothing else: the
                reader picks a theme by the name it is known by, and a row
                that announced its mode count too would make the name harder
                to match. The count is decoration, and says so.
              */
              aria-label={theme.name}
              class={ROW}
              onClick={() => {
                setActiveName(theme.name);
                close();
              }}
            >
              <Swatch color={theme.color} />
              <span class="truncate">{theme.name}</span>
              {
                /*
                  The mode count is decoration: the row is about the theme,
                  and the reader picks it by its name. It is hidden from the
                  reader so that the row's own name is the theme's name and
                  nothing else.
                */
              }
              <span
                aria-hidden="true"
                class="ms-auto shrink-0 text-xs text-text-muted"
              >
                {" "}
                {theme.modes} {theme.modes === 1 ? "mode" : "modes"}
              </span>
            </button>
          )}
        </For>
      )}
    </Popover>
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
    <Popover
      name="mode"
      label={`Color mode: ${said()}`}
      popup="menu"
      testid="mode-button"
      panelTestid="mode-menu"
      trigger={
        <span
          class={`${glyph()} icon-md shrink-0`}
          aria-hidden="true"
        />
      }
    >
      {(close) => (
        <For each={MODES}>
          {(mode) => (
            <button
              type="button"
              role="menuitem"
              data-mode={mode.choice}
              aria-current={modeChoice() === mode.choice ? "true" : undefined}
              class={ROW}
              // A theme that serves one mode cannot be shown in the other,
              // so the answer it does not serve is refused — and it says
              // why, rather than sitting there dead.
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
          )}
        </For>
      )}
    </Popover>
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
