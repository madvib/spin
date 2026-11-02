/**
 * Type — the faces a theme uses, the scale it sets, and the element map.
 *
 * A token list answers "what is `font-size-lg` worth". A type surface has to
 * answer the questions a theme author actually has:
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
 *   **Which face does each element read?** That is the theme's answer, and
 *   this page edits it. `font.element.<tag>.<field>` is a decision a theme
 *   may make about ONE element — its face, its size, its weight — and the
 *   map at the end is where that decision is made. A row the theme says
 *   nothing about reads the ladder.
 *
 * The specimens are the studio's own neutral copy, the same in every
 * project, so two themes are compared on the same reading rather than on
 * whoever wrote the sample.
 */

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { FamilyField, firstFamily } from "../components/FamilyField.tsx";
import { Dynamic } from "solid-js/web";
import {
  elementTypeElements,
  elementTypeFields,
  FACE_CHAINS,
  resolveAliases,
  treeInMode,
  type TokenTree,
} from "@spinjs/spin/theme";
import { tokenStatus } from "../lib/live-edit.ts";
import { activeMode, activeName, activeTree, registry, themeText } from "../lib/store.ts";
import { groupTokens, parseComposite, type TokenRow, toPx } from "../lib/tokens.ts";
import {
  DISPLAY,
  HEADING,
  MONOSPACE,
  PARAGRAPH,
  QUOTE,
  SENTENCE,
} from "../lib/specimen-copy.ts";
import {
  editFontFamily,
  editToken,
  removeToken,
  upsertToken,
} from "../lib/editing.ts";
import { StepPicker } from "../components/demos/CompositeEditor.tsx";
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
import {
  type CatalogFont,
  fontDeclarationFor,
  type SpinFontDeclaration,
} from "../lib/fonts.ts";
import { spinClient } from "../lib/client.ts";

/** `font.weight.bold` → `bold`, the suffix the matching utility spends. */
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

/** Concise specimen phrases for each HTML element in the element map. */
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

/** The per-element decisions the theme states, if it states any. */
function elementRows(): readonly TokenRow[] {
  return rowsUnder("font.element");
}

/**
 * The type the theme states in one token.
 *
 * A typography token is a family, a size, a weight and a tracking in one
 * value — the four decisions the scales above hold separately — so it gets
 * a row of its own and an editor that takes the four apart. A theme that
 * declares none has no such row, and the section says so.
 *
 * The theme decides where it keeps them: a composite is a *type*, and a
 * type may be declared in any group — `typography.body` beside the other
 * groups, or `font.body` inside the font one. So the page asks the theme
 * which tokens are typography, wherever the theme put them.
 */
function compositeRows(): readonly TokenRow[] {
  return groupTokens(resolvedTree(), [[]], activeMode()).filter(
    (row) => row.type === "typography",
  );
}

/** The letter-spacing tokens the theme declares, for the tracking family. */
function trackingRows(): readonly TokenRow[] {
  return rowsUnder("font.letter-spacing");
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

/**
 * The face a role reads, following the contract's chain.
 *
 * The display face falls back to the heading family and the body to the sans,
 * so a theme that names no display voice still has a face for its headings.
 */
function faceFor(
  families: readonly TokenRow[],
  path: string,
): TokenRow | undefined {
  const chain = [
    path,
    ...(FACE_CHAINS[path as keyof typeof FACE_CHAINS] ?? []),
  ];
  for (const step of chain) {
    const found = families.find((row) => row.path === step);
    if (found !== undefined) return found;
  }
  return undefined;
}

export default function TypePage() {
  const sizes = createLockstep(scaleRows, "font.size");
  const families = createMemo(familyRows);
  const elements = createMemo(elementRows);

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
            <p class="text-sm text-text-muted">
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

      <div
        class={inDrawer()
          ? "stack-lg"
          : "grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0"}
      >
        <Section
          title="Weight"
          fact={`${weightRows().length} steps`}
        >
          <Show
            when={weightRows().length > 0}
            fallback={
              <p class="text-sm text-text-muted">
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
                      utility={`font-${suffixOf(row.path)}`}
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
          title="Tracking"
          fact={`${trackingRows().length} steps`}
        >
          <Show
            when={trackingRows().length > 0}
            fallback={
              <p class="text-sm text-text-muted">
                This theme declares no tracking yet.
              </p>
            }
          >
            <Frame>
              <ul>
                <For each={trackingRows()}>
                  {(row) => (
                    <TypeStepItem
                      row={row}
                      step={suffixOf(row.path)}
                      utility={`tracking-${suffixOf(row.path)}`}
                      specimenStyle={{ "letter-spacing": `var(${row.variable})` }}
                      group={trackingRows().map((r) => r.value)}
                    />
                  )}
                </For>
              </ul>
            </Frame>
          </Show>
        </Section>
      </div>

      <Show when={compositeRows().length > 0}>
        <Section
          title="Type in one token"
          fact={`${compositeRows().length} tokens`}
          info="DTCG $type: typography composite tokens that bundle family, size, weight, and tracking into one preset."
        >
          <ul class="stack-sm">
            <For each={compositeRows()}>
              {(row) => {
                const parsed = () => parseComposite("typography", row.value);
                const specimenStyle = (): Record<string, string | undefined> => {
                  const p = parsed();
                  if (p?.type !== "typography") return {};
                  return {
                    "font-family": p.family || undefined,
                    "font-size": p.size || undefined,
                    "font-weight": p.weight || undefined,
                    "letter-spacing": p.tracking || undefined,
                  };
                };
                return (
                  <li class="stack-sm rounded-md border border-border bg-surface-raised p-4">
                    <div class="row-sm flex-wrap items-center gap-2">
                      <code>{row.path}</code>
                      <code>{row.value}</code>
                    </div>
                    <div
                      data-studio-specimen=""
                      class="rounded-md border border-border bg-surface p-3"
                    >
                      <p class="m-0 truncate text-text" style={specimenStyle()}>
                        {SENTENCE}
                      </p>
                    </div>
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => editToken(row.path.split("."), value)}
                      variable={row.variable}
                      label={row.path}
                    />
                  </li>
                );
              }}
            </For>
          </ul>
        </Section>
      </Show>

      <Section
        title="Element map"
        fact={`${elementTypeElements().length} elements`}
        info="Elements inherit from the scale unless overridden under font.element."
      >
        <div class="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Specimen</th>
                <th>Face</th>
                <th>Size</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              <For each={elementTypeElements()}>
                {(element) => (
                  <ElementRow
                    element={element}
                    families={families()}
                    elements={elements()}
                  />
                )}
              </For>
            </tbody>
          </table>
        </div>
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
          <span class="text-base font-semibold text-text">
            {humanFaceName(props.slot)}
          </span>
          <span class="rounded-md bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
            {role()}
          </span>
          <Show when={status().aliasOf}>
            {(target) => (
              <span class="inline-flex items-center">
                <span
                  tabIndex={0}
                  class="font-mono text-xs text-text-muted"
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
          <code class="text-xs text-text-muted">{`font.family.${props.slot}`}</code>
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
          <span class="text-3xl font-bold text-text">Aa</span>
          <span class="truncate text-base font-semibold text-text">
            {family() || "—"}
          </span>
        </div>
        <p class="m-0 mt-1 text-sm text-text">
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
          class="block truncate text-xs text-text-muted"
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
      <div data-studio-chrome="" class="w-28 shrink-0 stack-xs">
        <span class="text-sm font-semibold text-text">{props.step}</span>
        <code class="text-xs text-text-muted">{`font.size.${props.step}`}</code>
      </div>
      <div
        data-studio-specimen=""
        class="min-w-0 flex-1 overflow-hidden"
      >
        <p
          class={`m-0 truncate text-${props.step}`}
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
  utility: string;
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
          <span class="text-sm font-semibold text-text">{props.step}</span>
          <span class="inline-flex items-center">
            <code tabIndex={0} class="text-xs text-text-muted">
              {props.utility}
            </code>
            <tooltip class="start-0 translate-none">{props.row.path}</tooltip>
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
        <p class="m-0 truncate text-base text-text" style={props.specimenStyle}>
          {HEADING}
        </p>
      </div>
    </li>
  );
}

/**
 * One element of the map: the specimen it draws, and the three decisions the
 * theme may make about it.
 *
 * The specimen is the element itself, set in the theme's answer, so a row
 * shows what the element reads rather than what the row says it reads.
 */
function ElementRow(props: {
  element: string;
  families: readonly TokenRow[];
  elements: readonly TokenRow[];
}) {
  const fields = createMemo(() => elementTypeFields(props.element));

  /** What the theme states for one of the three decisions. */
  const stated = (
    field: "family" | "size" | "weight",
  ): TokenRow | undefined => {
    const path = fields()[field]?.path;
    if (path === undefined) return undefined;
    return props.elements.find((row) => row.path === path);
  };

  /** What the element reads when the theme says nothing: the ladder's answer. */
  const inherited = (
    field: "family" | "size" | "weight",
  ): TokenRow | undefined => {
    const fallback = fields()[field]?.fallback;
    if (fallback === undefined) return undefined;
    // A face falls back through the contract's chain; a size and a weight
    // name their step outright.
    if (field === "family") return faceFor(props.families, fallback);
    return fontRows().find((row) => row.path === fallback);
  };

  const family = () =>
    stated("family")?.value ?? inherited("family")?.value ?? "";
  const size = () => stated("size")?.value ?? inherited("size")?.value ?? "";
  const weight = () =>
    stated("weight")?.value ?? inherited("weight")?.value ?? "";

  const commit = (
    field: "family" | "size" | "weight",
    value: string,
  ): void => {
    const role = fields()[field];
    if (role === undefined) return;
    upsertToken(role.path.split("."), role.type, value);
  };

  const specimen = (): Record<string, string> => {
    const out: Record<string, string> = {};
    if (family() !== "") out["font-family"] = family();
    if (size() !== "") out["font-size"] = size();
    if (weight() !== "") out["font-weight"] = weight();
    return out;
  };

  const hasOverride = () =>
    stated("family") !== undefined ||
    stated("size") !== undefined ||
    stated("weight") !== undefined;

  const resetElement = (): void => {
    for (const field of ["family", "size", "weight"] as const) {
      const path = fields()[field]?.path;
      if (path !== undefined) removeToken(path.split("."));
    }
  };

  return (
    <tr>
      <td>
        <div class="row-sm">
          <code>{`<${props.element}>`}</code>
          <Show when={hasOverride()}>
            <button
              type="button"
              class="bare text-xs font-medium text-primary"
              title={`Reset <${props.element}> to the ladder`}
              aria-label={`Reset ${props.element} to the ladder`}
              onClick={resetElement}
            >
              reset
            </button>
          </Show>
        </div>
      </td>
      <td>
        <Dynamic
          component={props.element}
          class="m-0 truncate"
          style={specimen()}
        >
          {ELEMENT_SPECIMENS[props.element] ?? props.element}
        </Dynamic>
      </td>
      <td>
        <FamilyField
          value={family()}
          label={`font.element.${props.element}.family`}
          onCommit={(stack) => commit("family", stack)}
        />
      </td>
      <td>
        <StepChoice
          value={size()}
          group="font.size"
          steps={scaleRows().map((row) => ({
            name: row.path.split(".").pop() ?? "",
            value: row.value,
          }))}
          label={`font.element.${props.element}.size`}
          onCommit={(value) => commit("size", value)}
        />
      </td>
      <td>
        <StepChoice
          value={weight()}
          group="font.weight"
          steps={weightRows().map((row) => ({
            name: row.path.split(".").pop() ?? "",
            value: row.value,
          }))}
          label={`font.element.${props.element}.weight`}
          onCommit={(value) => commit("weight", value)}
        />
      </td>
    </tr>
  );
}

/**
 * One step of the theme's own scale, chosen from a panel of the theme's
 * ladder rather than a native `<select>`.
 *
 * The value written is the ALIAS — `{font.size.3xl}` — so the element keeps
 * reading the ladder's step rather than a copy of it: move the step and the
 * element moves with it.
 */
function StepChoice(props: {
  value: string;
  /** The group the steps live in: `font.size` or `font.weight`. */
  group: string;
  steps: readonly { name: string; value: string }[];
  label: string;
  onCommit: (value: string) => void;
}) {
  return (
    <StepPicker
      label={props.label}
      value={props.value}
      steps={props.steps.map((s) => ({ ...s, path: `${props.group}.${s.name}` }))}
      onPick={(step) => props.onCommit(`{${props.group}.${step.name}}`)}
    />
  );
}

/** The shared family field carries the catalog search, stacks, and preview injector. */
