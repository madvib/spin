import { createMemo, createSignal, For, Show } from "solid-js";
import { generateScale } from "@spin/theme";
import { inDrawer } from "../lib/host.ts";
import { analyzeTheme } from "../lib/theme.ts";
import { activeMode, activeModes, themeText } from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";
import { type MeasuredFloor, measureFloors } from "../lib/floors.ts";
import {
  colorRoles,
  colorTargets,
  FAMILIES,
  FAMILY_NOTES,
  FAMILY_TITLES,
  neutralRamp,
  type Role,
  rolesOf,
  type RoleValue,
  type Target,
} from "../lib/colors.ts";
import Page from "../components/Page";
import Palette, { Hex } from "../components/Palette.tsx";
import { paletteChips } from "../lib/overview.ts";

/**
 * Colors — a theme's colours: the roles the interface paints with, what
 * each role is for, and which of them you set.
 *
 * A colour page is a palette first, and a palette is read as swatches. So
 * the page opens with the palette: the colours a theme picks, in the order a
 * palette reads, each swatch a control that opens the picker for that role.
 * The picker is where the value, the floor and the choices are, so copying a
 * colour and changing it are the same place.
 *
 * Under the palette the theme's roles are read as what they are: three
 * families — brand, neutral, status — and a row for each role, saying what
 * the role is for, what it is worth, and whether the value is set or
 * computed. The neutrals are the roles, not the ramp's numbers: "the page",
 * "the hairline", "the ink", because 50 and 900 are the ramp's own
 * spelling and not a thing a reader can act on. The ramp is still here,
 * under a disclosure, for the author who wants the steps.
 *
 * Both modes are on the page at once, because a preview stands in one mode
 * at a time and dark overrides are invisible until you switch into them.
 * Each slot writes where it sits: light the token's own `$value`, dark its
 * `$modes.dark` — and a dark slot saying what the light slot says is a slot
 * with nothing to say, so it reads as a fallback instead.
 */

/** Where a slot's commit lands: the token's own value, or the dark one. */
function commitSlot(slot: "light" | "dark"): "base" | "dark" {
  return slot === "dark" ? "dark" : "base";
}

export default function ColorsPage() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const mode = createMemo(() => activeMode());
  const servesDark = createMemo(() => activeModes().includes("dark"));
  const roles = createMemo(() => colorRoles(tree(), servesDark()));
  const palette = createMemo(() => paletteChips(themeText(), mode()));
  const floors = createMemo(() => measureFloors(themeText(), mode()));
  const targets = createMemo(() => colorTargets(tree(), mode()));
  const [editing, setEditing] = createSignal("");

  /** The role the picker holds: the one pressed, or the first the theme has. */
  const editingRole = createMemo(() => {
    const all = roles();
    return all.find((role) => role.path === editing()) ?? all[0];
  });

  let picker: HTMLDivElement | undefined;

  /**
   * Choose the role the picker holds.
   *
   * A swatch in the palette sits right above the picker, so choosing one
   * needs no movement. A swatch in a family row does not, and a reader who
   * pressed it would be left looking at a picker they cannot see — so the
   * page brings the picker into view.
   */
  function select(path: string): void {
    setEditing(path);
    if (palette().some((chip) => chip.path === path)) return;
    picker?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <Page
      title="Colors"
      note="A theme's colours: the roles the interface paints with, what each role is for, and which of them you set."
    >
      <p class="text-sm text-text-muted">
        A role is a job the interface has: the page, the ink on it, the hairline
        between things, the danger.
      </p>

      <section class="stack-sm mb-6" aria-label="Palette">
        <div class="split">
          <h2>Palette</h2>
          <span class="text-sm text-text-muted">{mode()}</span>
        </div>
        <p class="text-sm text-text-muted">
          The colours a theme picks, in the order a palette reads. Press a
          swatch to edit the role below it; press a hex to copy it.
        </p>
        <Show
          when={palette().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no palette roles yet.
            </p>
          }
        >
          <Palette chips={palette()} tall onPick={select} />
        </Show>
        <div ref={picker}>
          <RolePicker
            role={editingRole()}
            mode={mode()}
            floors={floors()}
            targets={targets()}
          />
        </div>
      </section>

      <For each={FAMILIES}>
        {(family) => (
          <section class="stack-sm mb-6" aria-label={FAMILY_TITLES[family]}>
            <h2>{FAMILY_TITLES[family]}</h2>
            <p class="text-sm text-text-muted">{FAMILY_NOTES[family]}</p>
            <For each={rolesOf(roles(), family)}>
              {(role) => (
                <RoleRow
                  role={role}
                  mode={mode()}
                  floors={floors()}
                  selected={role.path === editingRole()?.path}
                  onPick={select}
                />
              )}
            </For>
          </section>
        )}
      </For>

      <Ramp />
      <InUse />
    </Page>
  );
}

/**
 * The picker: the role being edited, in one place.
 *
 * The value, the floor it owes, the contrast it measures, and the ways to
 * set it — a literal colour, or a reference to another token. A role whose
 * value is a reference says so, and the reference is one of the choices, so
 * a computed role is as editable as a set one.
 */
function RolePicker(props: {
  role: Role | undefined;
  mode: string;
  floors: readonly MeasuredFloor[];
  targets: readonly Target[];
}) {
  const owed = createMemo(() =>
    props.floors.filter((floor) => floor.fg === props.role?.path)
  );
  const carried = createMemo(() =>
    props.floors.filter((floor) => floor.bg === props.role?.path)
  );
  /** The role's value in the mode being looked at: the summary at the top. */
  const current = createMemo(() => {
    const role = props.role;
    if (role === undefined) return null;
    return props.mode === "dark" && role.dark !== null ? role.dark : role.base;
  });
  return (
    <Show
      when={props.role}
      fallback={
        <p class="text-sm text-text-muted">
          This theme declares no colour roles yet.
        </p>
      }
    >
      {(role) => (
        <div class="stack rounded-md border border-border bg-surface-raised p-4">
          <div class="split">
            <h3>Editing {role().name}</h3>
            <Hex value={current()?.value ?? ""} />
          </div>
          <Show when={role().doc}>
            <p class="text-sm text-text-muted">{role().doc}</p>
          </Show>
          <div
            class="grid gap-3"
            classList={{ "sm:grid-cols-2": !inDrawer() }}
          >
            <SlotEditor
              role={role()}
              slot="light"
              value={role().base}
              targets={props.targets}
            />
            <Show when={role().dark}>
              {(dark) => (
                <SlotEditor
                  role={role()}
                  slot="dark"
                  value={dark()}
                  targets={props.targets}
                  restated={role().restated}
                />
              )}
            </Show>
          </div>
          <div class="stack-sm">
            <h4>Floors</h4>
            <Show when={owed().length > 0}>
              <For each={owed()}>
                {(floor) => (
                  <FloorReadout
                    floor={floor}
                    role={role()}
                    mode={props.mode}
                  />
                )}
              </For>
            </Show>
            <Show when={carried().length > 0}>
              <p class="text-xs text-text-muted">Read on it</p>
              <For each={carried()}>
                {(floor) => (
                  <FloorReadout
                    floor={floor}
                    role={role()}
                    mode={props.mode}
                  />
                )}
              </For>
            </Show>
            <Show when={owed().length === 0 && carried().length === 0}>
              <p class="text-sm text-text-muted">
                This role owes no floor and carries none: nothing is read on it,
                and nothing is read in it.
              </p>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}

/**
 * One slot of a role: the value, how to set it, and what it can point at.
 *
 * The swatch is the control: a press opens the browser's own colour
 * picker, and the commit writes the token. The field beside it takes the
 * value as the document spells it — a hex, an `oklch(…)`, a reference — so
 * a theme that writes its colours in a space the swatch cannot reach is
 * still editable here.
 */
function SlotEditor(props: {
  role: Role;
  slot: "light" | "dark";
  value: RoleValue;
  targets: readonly Target[];
  /** Whether the theme restates this role for the dark mode. */
  restated?: boolean;
}) {
  function commit(value: string): void {
    editToken(props.role.path.split("."), value, commitSlot(props.slot));
  }
  return (
    <div class="stack-sm rounded-md border border-border p-3">
      <div class="row-sm">
        <span class="w-10 shrink-0 text-xs text-text-muted">{props.slot}</span>
        <label
          class="relative block h-8 w-8 shrink-0 cursor-pointer rounded-sm border border-border"
          // The swatch wears the value the document resolves to: the studio
          // wears its own theme, so a utility here would paint the studio's
          // colour and call it the theme being edited.
          style={{ background: props.value.hex ?? "" }}
          title={`Pick a colour for ${props.role.path} in ${props.slot}`}
        >
          <span class="visually-hidden">
            {props.role.path} in {props.slot}
          </span>
          <input
            id={`token-${props.role.path}-${props.slot}`}
            type="color"
            class="visually-hidden"
            value={props.value.hex ?? "#000000"}
            onChange={(event) => commit(event.currentTarget.value)}
          />
        </label>
        <Hex value={props.value.value ?? ""} />
      </div>
      <p class="text-xs text-text-muted">
        {props.value.computed
          ? `computed — points at ${props.value.reference}`
          : props.restated === false
          ? "falls back to the base"
          : "set"}
      </p>
      <input
        type="text"
        class="w-full"
        value={props.value.raw}
        aria-label={`${props.role.path} value in ${props.slot}`}
        onChange={(event) => commit(event.currentTarget.value)}
      />
      <div class="stack-sm">
        <span class="text-xs text-text-muted">Point at another token</span>
        <div class="flex max-h-[8rem] flex-wrap gap-1 overflow-y-auto rounded-md border border-border p-2">
          <For each={props.targets}>
            {(target) => (
              <button
                type="button"
                class="bare cursor-pointer text-text"
                title={target.path}
                aria-current={target.path === props.value.reference
                  ? "true"
                  : undefined}
                onClick={() => commit(`{${target.path}}`)}
              >
                <span
                  class="row-sm rounded-sm border border-border px-1 text-xs"
                  classList={{
                    "border-primary": target.path === props.value.reference,
                  }}
                >
                  <span
                    class="h-3 w-3 shrink-0 rounded-sm border border-border"
                    style={{ background: target.hex ?? "" }}
                    aria-hidden="true"
                  />
                  <span class="truncate">{target.name}</span>
                </span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/**
 * One role, in its family: the swatch, the name and what it is for, the
 * value in each mode, and the floor it owes.
 *
 * The swatch is the way in: a press hands the role to the picker. The mode
 * column says what the role is worth in each mode, and whether the theme
 * restates it there or lets the base stand — a mode is a restatement, and a
 * role the dark mode does not restate falls back to its own base.
 */
function RoleRow(props: {
  role: Role;
  mode: string;
  floors: readonly MeasuredFloor[];
  selected: boolean;
  onPick: (path: string) => void;
}) {
  const owed = createMemo(() =>
    props.floors.filter((floor) => floor.fg === props.role.path)
  );
  const carried = createMemo(() =>
    props.floors.filter((floor) => floor.bg === props.role.path)
  );
  /**
   * The floors this row shows.
   *
   * The ones the role owes, when it owes any. A role that owes none but
   * carries some — a fill, or a surface — shows the tightest pair it
   * carries: the one with the least room over its floor, which is the pair
   * that would fail first.
   */
  const shown = createMemo(() => {
    const own = owed();
    if (own.length > 0) return own;
    const on = carried();
    if (on.length === 0) return [];
    return [
      on.reduce((tightest, floor) =>
        floor.ratio / floor.min < tightest.ratio / tightest.min
          ? floor
          : tightest
      ),
    ];
  });
  /** The role's value in the mode being looked at. */
  const current = createMemo(() =>
    props.mode === "dark" && props.role.dark !== null
      ? props.role.dark
      : props.role.base
  );
  const swatch = createMemo(() => current().hex);
  return (
    <div
      class="stack-sm rounded-md border border-border p-3"
      classList={{ "border-primary": props.selected }}
    >
      <div class="flex items-start gap-3">
        <button
          type="button"
          class="bare h-12 w-12 shrink-0 cursor-pointer"
          title={`Edit ${props.role.name}`}
          aria-label={`Edit ${props.role.name}`}
          aria-current={props.selected ? "true" : undefined}
          onClick={() => props.onPick(props.role.path)}
        >
          <span
            class="block h-12 w-12 rounded-md border border-border"
            style={{ background: swatch() ?? "" }}
          />
        </button>
        <div class="stack-sm min-w-0 flex-1">
          <div class="split">
            <span class="truncate">{props.role.name}</span>
            <Hex value={current().value ?? ""} />
          </div>
          <Show when={props.role.doc}>
            <p class="text-sm text-text-muted">{props.role.doc}</p>
          </Show>
          <div class="stack-sm text-xs">
            <SlotLine
              slot="light"
              value={props.role.base}
              hex={props.role.base.hex}
            />
            <Show when={props.role.dark}>
              {(dark) => (
                <SlotLine
                  slot="dark"
                  value={dark()}
                  hex={dark().hex}
                  fallback={!props.role.restated}
                />
              )}
            </Show>
          </div>
          <For each={shown()}>
            {(floor) => (
              <FloorReadout
                floor={floor}
                role={props.role}
                mode={props.mode}
                small
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/**
 * One mode's worth of a role: the colour, and whether the theme sets it
 * there or lets the base stand.
 */
function SlotLine(props: {
  slot: "light" | "dark";
  value: RoleValue;
  hex: string | null;
  /** Whether the theme leaves this mode to the base. */
  fallback?: boolean;
}) {
  return (
    <div class="row-sm">
      <span class="w-10 shrink-0 text-text-muted">{props.slot}</span>
      <span class="font-mono">{props.hex ?? props.value.raw}</span>
      <span class="truncate text-text-muted">
        {props.fallback === true
          ? "falls back to the base"
          : props.value.computed
          ? `computed · ${props.value.reference}`
          : "set"}
      </span>
    </div>
  );
}

/**
 * A floor, measured: the ratio the pair makes, the ratio it owes, and the
 * value that would clear it.
 *
 * The measurement is the theme module's and the remedy is the studio's, so
 * the number on the page is the number the checks panel will say — and the
 * value offered beside it is one that clears the floor when it is applied.
 *
 * The remedy is written to the token that FAILS, which is not always the
 * role being edited: a fill owes nothing itself, and the ink on it does.
 * So the floor says which pair it is, and the offer names the token it
 * would change.
 */
function FloorReadout(props: {
  floor: MeasuredFloor;
  role: Role;
  mode: string;
  small?: boolean;
}) {
  const holds = () => props.floor.ratio >= props.floor.min;
  /** The token the pair fails on: the ink, whichever side it is on. */
  const fails = () => props.floor.fg;
  const pair = () =>
    `${props.floor.fg.replace("color.", "")} on ${
      props.floor.bg.replace("color.", "")
    }`;
  return (
    <div class="row-sm text-xs">
      <span
        classList={{
          "text-semantic-error": !holds(),
          "text-text-muted": holds(),
        }}
      >
        {props.floor.ratio.toFixed(2)}:1
      </span>
      <span class="truncate text-text-muted">
        {pair()} · needs {props.floor.min}:1
      </span>
      <Show when={!holds() && props.floor.remedy !== null}>
        <button
          type="button"
          class="bare shrink-0 text-link"
          title={`Set ${fails()} to ${props.floor.remedy}`}
          onClick={() =>
            editToken(
              fails().split("."),
              props.floor.remedy as string,
              commitSlot(props.mode === "dark" ? "dark" : "light"),
            )}
        >
          use {props.floor.remedy}
        </button>
      </Show>
    </div>
  );
}

/**
 * The ramp: the greys the neutrals are cut from.
 *
 * The steps are the ramp's own spelling, so they live under a disclosure:
 * a reader who wants to know what "the page" is made of does not need
 * eleven numbers, and an author who wants them has them one press away.
 * The builder is the theme's own scale generator, so a ramp built here is
 * the same ramp the theme module builds.
 */
function Ramp() {
  const tree = createMemo(() => analyzeTheme(themeText()).tree);
  const steps = createMemo(() => neutralRamp(tree()));
  const [open, setOpen] = createSignal(false);
  const [base, setBase] = createSignal("#7c2d12");
  const scale = createMemo(() => {
    try {
      return generateScale(base(), 11);
    } catch {
      return [];
    }
  });
  return (
    <section class="stack-sm mb-6" aria-label="The ramp">
      <div class="split">
        <h2>The ramp</h2>
        <button
          type="button"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
        >
          {open() ? "Hide the steps" : "Show the steps"}
        </button>
      </div>
      <p class="text-sm text-text-muted">
        The greys the neutrals are cut from. The steps are the ramp's own
        spelling; the roles above are what the steps are for.
      </p>
      <Show when={open()}>
        <div class="stack-sm">
          <div class="flex gap-1">
            <For each={steps()}>
              {(step) => (
                <div class="stack-sm flex-1">
                  <div
                    class="h-8 rounded-sm border border-border"
                    style={{ background: step.light ?? "" }}
                    title={`${step.path} · ${step.light}`}
                  />
                  <div
                    class="h-8 rounded-sm border border-border"
                    style={{ background: step.dark ?? "" }}
                    title={`${step.path} · dark · ${step.dark ?? "the base"}`}
                  />
                  <span class="text-center text-xs text-text-muted">
                    {step.step}
                  </span>
                </div>
              )}
            </For>
          </div>
          <div class="row-sm">
            <label for="ramp-base">Base</label>
            <label
              class="relative block h-8 w-8 shrink-0 cursor-pointer rounded-sm border border-border"
              style={{ background: base() }}
              title="The hue the ramp is cut from"
            >
              <span class="visually-hidden">The ramp's base colour</span>
              <input
                id="ramp-base"
                type="color"
                class="visually-hidden"
                value={base()}
                onInput={(event) => setBase(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const names = [
                  "50",
                  "100",
                  "200",
                  "300",
                  "400",
                  "500",
                  "600",
                  "700",
                  "800",
                  "900",
                  "950",
                ];
                scale().forEach((hex, index) => {
                  const name = names[index];
                  if (name !== undefined) {
                    editToken(["color", "neutral", name], hex);
                  }
                });
              }}
            >
              Apply to neutral
            </button>
          </div>
          <div class="flex gap-1">
            <For each={scale()}>
              {(hex) => (
                <div
                  class="h-10 flex-1 rounded-sm border border-border"
                  style={{ background: hex }}
                  title={hex}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </section>
  );
}

/**
 * The palette in use: the roles on the elements they paint.
 *
 * A page of swatches is the theme's parts; this is the theme working. The
 * specimens wear the theme being edited, because the page is inside the
 * theme's own scope — the studio's chrome keeps its own colours, and what
 * the theme says is what these elements say.
 */
function InUse() {
  return (
    <section class="stack-sm mb-6" aria-label="Palette in use">
      <h2>Palette in use</h2>
      <p class="text-sm text-text-muted">
        The roles on the elements they paint, wearing the theme being edited.
      </p>
      <div class="row-sm flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-4">
        <button type="button">Primary</button>
        <button type="button" class="danger">Danger</button>
        <badge variant="success">Success</badge>
        <badge variant="warning">Warning</badge>
        <a href="#link">Link</a>
      </div>
    </section>
  );
}
