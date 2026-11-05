/**
 * Type — the faces a theme uses, the scale it sets, and the named styles.
 *
 * A token list answers "what is `font.size.lg` worth". A type surface has to
 *
 *   **What does each face look like, and what is it for?** `body`, `heading`,
 *   `serif`, `mono` — each a live specimen, the stack it resolves to, and
 *   the place the family is loaded from. A stack string is the value; the
 *   face is the thing.
 *
 *   **Does the scale read as a scale?** Nine sizes in a list are nine
 *   numbers; nine sizes in a ramp are a decision. The ramp is rendered at
 *   size, largest first, with the token and the computed value beside it.
 *
 *   **Which style does each element read?** That is the theme's answer, and
 *   this page edits it. `font.style.<name>` is a complete tuple the theme
 *   declares; the Styles section below is where the set is trimmed or
 *   extended. (TYPE-c: per-field per-element overrides are gone — re-point
 *   the element's style or declare a new one.)
 *
 * The specimens are the studio's own neutral copy, the same in every
 * project, so two themes are compared on the same reading rather than on
 * whoever wrote the sample.
 */

import {
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { FamilyField, firstFamily } from "../components/FamilyField.tsx";
import {
  elementStyleDefault,
  elementStyleElements,
  resolveAliases,
  STYLE_REFERENCE_ROLES,
  treeInMode,
  type TokenTree,
} from "@spinjs/spin/theme";
import { tokenStatus } from "../lib/live-edit.ts";
import { activeMode, activeName, activeTree, noteRefusal, refusalFor, registry, setThemeText, themeText } from "../lib/store.ts";
import {
  attachedStyle,
  groupTokens,
  repointEdits,
  styleEdits,
  styleGroups,
  tokenRowAt,
  trimRefusal,
  trimStyle,
  type StyleGroup,
  type TokenRow,
  toPx,
} from "../lib/tokens.ts";
import {
  DISPLAY,
  HEADING,
  MONOSPACE,
  PARAGRAPH,
  QUOTE,
  SENTENCE,
} from "../lib/specimen-copy.ts";
import {
  createToken,
  editFontFamily,
  editToken,
  editTokens,
} from "../lib/editing.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";
import {
  Badge,
  ConcernPage,
  Frame,
  Section,
} from "../components/Concern.tsx";
import { inDrawer } from "../lib/host.ts";

/** `font.weight.bold` → `bold`, the step a row spends its token value at. */
function suffixOf(path: string): string {
  return path.split(".").slice(2).join("-");
}

/**
 * What each family slot is for.
 *
 * The slots are the theme's own names; the role is this page's word for what
 * the slot does. A slot the map has never heard of is still a face the theme
 * named, and it is filed as such rather than dropped.
 */
const ROLES: Record<string, string> = {
  heading: "display",
  body: "body",
  sans: "body",
  serif: "editorial",
  mono: "values",
  brand: "brand",
};
const HUMAN_FACE_NAMES: Record<string, string> = {
  sans: "Sans",
  heading: "Heading",
  body: "Body",
  serif: "Serif",
  mono: "Mono",
  brand: "Brand",
};

function humanFaceName(slot: string): string {
  return HUMAN_FACE_NAMES[slot] ??
    (slot.length > 0 ? `${slot[0]!.toUpperCase()}${slot.slice(1)}` : slot);
}

/** The specimen each role is judged on: the face doing its own job. */
const SPECIMENS: Record<string, string> = {
  display: DISPLAY,
  body: SENTENCE,
  editorial: QUOTE,
  values: MONOSPACE,
  brand: PARAGRAPH,
};

/** Concise specimen phrases for each HTML element in the attachment map. */
const ELEMENT_SPECIMENS: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  p: "Body paragraph copy",
  blockquote: "Quoted editorial passage",
  code: "const token = true",
  small: "Small caption label",
  strong: "Strong emphasis",
  a: "Interactive link",
  figcaption: "Figure caption",
};

/**
 * The theme's document as it reads, with its aliases resolved.
 *
 * A theme says what a face IS by pointing at another slot — silk's heading
 * face is the sans — so a page that shows the raw document shows a reference
 * where the reader expects a family. The aliases are followed here, once,
 * and everything below reads the answer.
 */
function resolvedTree(): TokenTree {
  return resolveAliases(treeInMode(activeTree(), activeMode())).tree;
}
/** Every token under `font`, resolved: the families, the scale, the weights. */
function fontRows(): readonly TokenRow[] {
  return groupTokens(resolvedTree(), [["font"]], activeMode());
}

/** The rows of one group under `font`, by its path prefix. */
function rowsUnder(prefix: string): readonly TokenRow[] {
  return fontRows().filter((row) => row.path.startsWith(`${prefix}.`));
}

/** The family and scale tokens the active theme declares, resolved live. */
function familyRows(): readonly TokenRow[] {
  return rowsUnder("font.family");
}

function scaleRows(): readonly TokenRow[] {
  return rowsUnder("font.size");
}

function weightRows(): readonly TokenRow[] {
  return rowsUnder("font.weight");
}


function tokenFor(
  families: readonly TokenRow[],
  slot: string,
): TokenRow | undefined {
  return families.find((row) => row.path === `font.family.${slot}`);
}

function sizeOf(
  sizes: readonly TokenRow[],
  step: string,
): TokenRow | undefined {
  return sizes.find((row) => row.path === `font.size.${step}`);
}

/** The face names the theme actually declares. */
function declaredFaces(): readonly string[] {
  return familyRows().map((row) => row.path.split(".").pop()!);
}

/**
 * The families the theme loads.
 *
 * A name in a stack is not a family on the machine: the theme says which
 * families it loads under `$extensions.spin.fonts`, and a stack that names
 * one the theme does not load falls through to the next name in the stack.
 */
function loadedFamilies(): readonly string[] {
  try {
    const doc = JSON.parse(themeText()) as Record<string, unknown>;
    const extensions = (doc["$extensions"] ?? {}) as Record<string, unknown>;
    const spin = (extensions["spin"] ?? {}) as Record<string, unknown>;
    const fonts = spin["fonts"];
    if (!Array.isArray(fonts)) return [];
    return fonts
      .map((entry) => (entry as { family?: unknown }).family)
      .filter((family): family is string => typeof family === "string");
  } catch {
    return [];
  }
}

/** Re-exported with the shared family field. */
export { firstFamily };

/**
 * The scale the active theme declares, largest first.
 *
 * Read from the theme rather than from a list written here: a theme may add a
 * step — the poster's `display` — and a page that knows a fixed set of steps
 * quietly drops the new one, so the ramp on screen is not the ramp in the
 * document. Order comes from the values themselves, so a theme that re-steps
 * its scale gets the ramp in the order it actually reads.
 */
function scaleOrder(): readonly string[] {
  return scaleRows()
    .map((row) => ({
      step: row.path.split(".").pop() ?? "",
      px: toPx(row.value) ?? 0,
    }))
    .sort((a, b) => b.px - a.px)
    .map((entry) => entry.step);
}


export default function TypePage() {
  const sizes = createLockstep(scaleRows, "font.size");

  return (
    <ConcernPage title="Type">
      <Section
        title="Faces"
        fact={`${declaredFaces().length} faces`}
        info="Webfonts load from $extensions.spin.fonts; system stacks resolve locally."
      >
        <Show
          when={declaredFaces().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no faces yet.
            </p>
          }
        >
          <div class="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <For each={declaredFaces()}>
              {(slot) => <FaceCard slot={slot} />}
            </For>
          </div>
        </Show>
      </Section>

      <Section
        title="Scale"
        fact={`${scaleOrder().length} steps`}
        aside={<LinkToggle group="font.size" ratio={sizes.activeRatio()} />}
      >
        <Frame>
          <div class="flex flex-col">
            <For each={scaleOrder()}>
              {(step) => <ScaleRow step={step} family={sizes} />}
            </For>
          </div>
        </Frame>
      </Section>

      <Section
        title="Weight"
        fact={`${weightRows().length} steps`}
        class="min-w-0"
      >
        <Show
          when={weightRows().length > 0}
          fallback={
            <p class="text-text-muted">
              This theme declares no weights yet.
            </p>
          }
        >
          <Frame>
            <ul>
              <For each={weightRows()}>
                {(row) => (
                  <TypeStepItem
                    row={row}
                    step={suffixOf(row.path)}
                    specimenStyle={{ "font-weight": `var(${row.variable})` }}
                    group={weightRows().map((r) => r.value)}
                  />
                )}
              </For>
            </ul>
          </Frame>
        </Show>
      </Section>

      <Section
        title="Styles"
        fact={`${styleGroups(activeTree()).length} styles`}
        info="Named type styles: the theme's complete tuples, spent with type-<name>. The floor is the contract's — trim a custom style, never a floor name. Elements read their default style (see the attachment map below)."
      >
        <ul class="stack-sm">
          <For each={styleGroups(activeTree())}>
            {(group) => <StyleCard group={group} />}
          </For>
        </ul>
        <AddStyle />
      </Section>

      <Section
        title="Attachment"
        fact={`${elementStyleElements().length} elements`}
        info="Which style each element reads. Re-pointing writes the style's own tuple as aliases at the new style, so the element follows it live — never per-field overrides."
      >
        <div class="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Specimen</th>
                <th>Reads</th>
              </tr>
            </thead>
            <tbody>
              <For each={elementStyleElements()}>
                {(element) => <AttachmentRow element={element} />}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="References"
        fact={`${STYLE_REFERENCE_ROLES.length} references`}
        info="The style names components read: button.type for every button, button.<variant>.type for one variant. A name that is no declared style is a theme error, said here."
      >
        <ul class="stack-sm">
          <For each={STYLE_REFERENCE_ROLES}>
            {(role) => <ReferenceRow path={role.path} />}
          </For>
        </ul>
      </Section>

    </ConcernPage>
  );
}

/**
 * One family slot: the face it names, the role it plays, and where the
 * family comes from.
 */
function FaceCard(props: { slot: string }) {
  const rows = createMemo(familyRows);
  const row = () => tokenFor(rows(), props.slot);
  const role = () => ROLES[props.slot] ?? "the theme's own";
  const family = () => firstFamily(row()?.value ?? "");
  const loaded = () => loadedFamilies();
  const status = createMemo(() =>
    tokenStatus(
      themeText(),
      registry()?.find((t) => t.name === activeName())?.text,
      `font.family.${props.slot}`,
      activeMode(),
    )
  );
  return (
    <card data-studio-specimen="" class="stack p-5">
      <div
        data-studio-chrome=""
        classList={{ split: !inDrawer(), "stack-sm": inDrawer() }}
      >
        <div class="row-sm flex-wrap">
          <span class="type-body-strong">
            {humanFaceName(props.slot)}
          </span>
          <span class="rounded-md bg-surface-sunken px-2 py-0 type-caption text-text-muted">
            {role()}
          </span>
          <Show when={status().aliasOf}>
            {(target) => (
              <span class="inline-flex items-center">
                <span
                  tabIndex={0}
                  class="type-code text-text-muted"
                >
                  → {humanFaceName(target().split(".").pop() ?? target())}
                </span>
                <tooltip class="start-0 translate-none">
                  Points at {target()}
                </tooltip>
              </span>
            )}
          </Show>
        </div>
        <div class="row-sm">
          <code class="text-text-muted">{`font.family.${props.slot}`}</code>
          <Badge tone={loaded().includes(family()) ? "primary" : "info"}>
            {loaded().includes(family()) ? "webfont" : "system stack"}
          </Badge>
        </div>
      </div>
      <div
        class="rounded-md border border-border bg-surface p-3"
        style={{ "font-family": row()?.value ?? "inherit" }}
      >
        <div class="split items-baseline">
          <span class="type-display">Aa</span>
          <span class="truncate type-body-strong">
            {family() || "—"}
          </span>
        </div>
        <p class="m-0 mt-1">
          {SPECIMENS[role()] ?? SENTENCE}
        </p>
      </div>
      <div data-studio-chrome="" class="stack-xs">
        <FamilyField
          value={row()?.value ?? ""}
          label={`font.family.${props.slot}`}
          onCommit={(stack, font) =>
            editFontFamily(["font", "family", props.slot], stack, font)}
        />
        <code
          class="block truncate text-text-muted"
          title={row()?.value ?? ""}
        >
          {row()?.value ?? "—"}
        </code>
      </div>
    </card>
  );
}

/** One step of the scale, drawn at its own size. */
function ScaleRow(props: { step: string; family: Lockstep }) {
  const rows = () => props.family.rows();
  const row = () => sizeOf(rows(), props.step);
  return (
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div data-studio-chrome="" class="w-24 shrink-0 stack-xs">
        <span class="type-label">{props.step}</span>
        <code class="text-text-muted">{`font.size.${props.step}`}</code>
      </div>
      <div data-studio-specimen="" class="min-w-0 flex-1 overflow-hidden">
        <p
          class="m-0 truncate"
          style={{
            "font-size": row()
              ? props.family.shown(row()!.path, row()!.value)
              : undefined,
          }}
        >
          {HEADING}
        </p>
      </div>
      <div data-studio-chrome="" class="shrink-0">
        <Show when={row()}>
          {(current) => (
            <ValueInput
              value={current().value}
              type={current().type}
              onCommit={(value) => props.family.commit(current().path, value)}
              group={rows().map((size) => size.value)}
              variable={current().variable}
              label={current().path}
              onPreview={(value) => props.family.preview(current().path, value)}
              onCancel={props.family.abandon}
              proposed={props.family.shown(current().path, current().value)}
            />
          )}
        </Show>
      </div>
    </div>
  );
}

/** Two-line specimen row for weight and tracking scales. */
function TypeStepItem(props: {
  row: TokenRow;
  step: string;
  /** The utility the row spends, if the scale ships one. Weights arrive only inside named styles, so a weight row names none. */
  utility?: string;
  specimenStyle: Record<string, string>;
  group: readonly string[];
}) {
  return (
    <li
      data-studio-chrome=""
      class="stack-sm border-b border-border py-3 last:border-b-0"
    >
      <div class="split flex-wrap gap-2">
        <div class="row-sm min-w-0">
          <span class="type-label">{props.step}</span>
          <span class="inline-flex items-center">
            <code tabIndex={0} class="text-text-muted">
              {props.utility ?? props.row.path}
            </code>
            <Show when={props.utility !== undefined}>
              <tooltip class="start-0 translate-none">
                {props.row.path}
              </tooltip>
            </Show>
          </span>
        </div>
        <ValueInput
          value={props.row.value}
          type={props.row.type}
          onCommit={(value) => editToken(props.row.path.split("."), value)}
          group={props.group}
          variable={props.row.variable}
          label={props.row.path}
        />
      </div>
      <div data-studio-specimen="" class="min-w-0 overflow-hidden">
        <p class="m-0 truncate" style={props.specimenStyle}>
          {HEADING}
        </p>
      </div>
    </li>
  );
}

/** The shared family field carries the catalog search, stacks, and preview injector. */

/**
 * One named style: its specimen, its tuple leaves, and its trim.
 *
 * The specimen wears the style's own variables, so it reads what the theme
 * says rather than what the row claims. The trim refuses the floor in
 * words — a floor name is stable API, and trimming it fails completeness.
 */
function StyleCard(props: { group: StyleGroup }) {
  const name = () => props.group.name;
  const specimen = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const row of props.group.fields) {
      if (row.path.endsWith(".family")) out["font-family"] = `var(${row.variable})`;
      if (row.path.endsWith(".size")) out["font-size"] = `var(${row.variable})`;
      if (row.path.endsWith(".weight")) out["font-weight"] = `var(${row.variable})`;
      if (row.path.endsWith(".tracking")) out["letter-spacing"] = `var(${row.variable})`;
      if (row.path.endsWith(".leading")) out["line-height"] = `var(${row.variable})`;
    }
    return out;
  };
  const trim = (): void => {
    const refusal = trimRefusal(themeText(), name());
    if (refusal !== undefined) {
      noteRefusal(refusal);
      return;
    }
    let next: string;
    try {
      next = trimStyle(themeText(), name());
    } catch (err) {
      noteRefusal(err instanceof Error ? err.message : String(err));
      return;
    }
    setThemeText(next, [`font.style.${name()}`]);
  };
  return (
    <li class="stack-sm rounded-md border border-border bg-surface-raised p-4">
      <div class="row-sm flex-wrap items-center gap-2">
        <span class="type-label">{name()}</span>
        <Show when={props.group.floor}>
          <span title="Floor styles stay: every theme keeps them, so there is nothing to trim.">
            <Badge tone="info">floor</Badge>
          </span>
        </Show>
        <code>type-{name()}</code>
        <code>font.style.{name()}</code>
        <Show when={!props.group.floor}>
          <button
            type="button"
            class="bare type-caption-strong text-primary"
            title={`Trim ${name()} from the theme`}
            aria-label={`Trim ${name()} from the theme`}
            onClick={trim}
          >
            trim
          </button>
        </Show>
      </div>
      <div data-studio-specimen="" class="rounded-md border border-border bg-surface p-3">
        <p class="truncate" style={specimen()}>
          {SENTENCE}
        </p>
      </div>
      <ul class="stack-xs">
        <For each={props.group.fields}>
          {(row) => (
            <li class="row-sm flex-wrap items-center gap-2">
              <code>{row.path}</code>
              <ValueInput
                value={row.value}
                type={row.type}
                onCommit={(value) => editToken(row.path.split("."), value)}
                variable={row.variable}
                label={row.path}
              />
            </li>
          )}
        </For>
      </ul>
      <Show when={refusalFor(`font.style.${name()}`)}>
        {(message) => (
          <p class="text-semantic-error" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </li>
  );
}

/**
 * A name and a tuple: the custom style the theme gains.
 *
 * The tuple starts as the body's — a new style reads like body until the
 * author edits it, so it is spendable the moment it lands. The name must be
 * new: an existing name is said, not written.
 */
function AddStyle() {
  const [name, setName] = createSignal("");
  const add = (): void => {
    const trimmed = name().trim();
    let next: string;
    try {
      next = styleEdits(themeText(), trimmed);
    } catch (err) {
      noteRefusal(err instanceof Error ? err.message : String(err));
      return;
    }
    if (setThemeText(next, [`font.style.${trimmed}`])) setName("");
  };
  return (
    <div data-studio-chrome="" class="row-sm flex-wrap gap-2">
      <label class="row-sm gap-2">
        New style
        <input
          type="text"
          class="w-36"
          placeholder="aside"
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          aria-label="New style name"
        />
      </label>
      <button type="button" class="secondary s-sm" onClick={add}>
        Add style
      </button>
    </div>
  );
}

/**
 * One element's attachment: the specimen it draws, and the style it reads.
 *
 * The specimen is the element itself, set in the attached style's
 * variables, so a row shows what the element reads rather than what the row
 * says it reads. The pick re-points the element — the default style's tuple
 * becomes aliases at the new style — and the gate judges the batch whole.
 */
function AttachmentRow(props: { element: string }) {
  const attached = () => attachedStyle(themeText(), props.element) ?? elementStyleDefault(props.element);
  const def = () => elementStyleDefault(props.element);
  const names = () => styleGroups(activeTree()).map((group) => group.name);
  const specimen = (): Record<string, string> => {
    const style = attached() ?? def() ?? "";
    return {
      "font-family": `var(--font-style-${style}-family)`,
      "font-size": `var(--font-style-${style}-size)`,
      "font-weight": `var(--font-style-${style}-weight)`,
    };
  };
  const repoint = (style: string): void => {
    let edits: readonly { path: readonly string[]; value: string }[];
    try {
      edits = repointEdits(themeText(), props.element, style);
    } catch (err) {
      noteRefusal(err instanceof Error ? err.message : String(err));
      return;
    }
    editTokens(
      edits.map((edit) => ({ path: [...edit.path], value: edit.value })),
      "base",
    );
  };
  return (
    <tr>
      <td>
        <div class="row-sm">
          <code>{`<${props.element}>`}</code>
          <Show when={attached() !== def()}>
            <Badge tone="primary">→ {attached()}</Badge>
          </Show>
        </div>
      </td>
      <td>
        <p class="truncate" style={specimen()}>
          {ELEMENT_SPECIMENS[props.element] ?? props.element}
        </p>
      </td>
      <td>
        <div data-studio-chrome="" class="row-sm flex-wrap gap-2">
          <select
            aria-label={`Style <${props.element}> reads`}
            value={attached() ?? ""}
            onChange={(event) => repoint(event.currentTarget.value)}
          >
            <For each={names()}>
              {(style) => (
                <option value={style}>
                  {style}{style === def() ? " (default)" : ""}
                </option>
              )}
            </For>
          </select>
          <code>type-{attached()}</code>
        </div>
      </td>
    </tr>
  );
}

/**
 * One style reference: the name a component's type answers to, and whether
 * it names a declared style.
 *
 * The value is a bare name, edited as text and judged against the declared
 * styles: a name no style wears is a theme error, said on the row rather
 * than left silent. An undeclared reference clears the gate's way — the
 * document keeps its other problems repairable — and the row keeps saying
 * it until the name lands.
 */
function ReferenceRow(props: { path: string }) {
  const row = () => tokenRowAt(activeTree(), props.path, activeMode());
  const names = () => styleGroups(activeTree()).map((group) => group.name);
  const dangling = () => {
    const value = row()?.value.trim() ?? "";
    return value.length > 0 && !names().includes(value)
      ? `"${value}" names no declared font.style`
      : undefined;
  };
  const commit = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      noteRefusal(`${props.path}: a style reference names a declared font.style — an empty name says nothing.`);
      return false;
    }
    if (row() === undefined) {
      return createToken(props.path.split("."), "typography", trimmed);
    }
    return editToken(props.path.split("."), trimmed, "base");
  };
  return (
    <li class="stack-sm rounded-md border border-border bg-surface-raised p-4">
      <div class="row-sm flex-wrap items-center gap-2">
        <code>{props.path}</code>
        <Show when={row() === undefined}>
          <Badge tone="info">inherits</Badge>
        </Show>
      </div>
      <div data-studio-chrome="" class="row-sm flex-wrap gap-2">
        <select
          aria-label={`Style ${props.path} names`}
          value={row()?.value.trim() ?? ""}
          onChange={(event) => {
            commit(event.currentTarget.value);
          }}
        >
          <Show when={row() === undefined}>
            <option value="">—</option>
          </Show>
          <For each={names()}>
            {(style) => <option value={style}>{style}</option>}
          </For>
        </select>
        <code>type-{row()?.value.trim() ?? "—"}</code>
      </div>
      <Show when={dangling() ?? refusalFor(props.path)}>
        {(message) => (
          <p class="text-semantic-error" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </li>
  );
}
