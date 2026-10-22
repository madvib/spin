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
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  elementTypeElements,
  elementTypeFields,
  FACE_CHAINS,
  resolveAliases,
  treeInMode,
} from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { analyzeTheme } from "../lib/theme.ts";
import { activeMode, themeText } from "../lib/store.ts";
import { groupTokens, type TokenRow, toPx } from "../lib/tokens.ts";
import {
  DISPLAY,
  HEADING,
  MONOSPACE,
  PARAGRAPH,
  QUOTE,
  SENTENCE,
} from "../lib/specimen-copy.ts";
import { editToken, upsertToken } from "../lib/editing.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";
import Page from "../components/Page";
import { inDrawer } from "../lib/host.ts";
import { type CatalogFont } from "../lib/fonts.ts";
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

/** The specimen each role is judged on: the face doing its own job. */
const SPECIMENS: Record<string, string> = {
  display: DISPLAY,
  body: SENTENCE,
  editorial: QUOTE,
  values: MONOSPACE,
  brand: PARAGRAPH,
};

/** What each element is for, in one line. */
const NOTES: Record<string, string> = {
  h1: "the document's one opening claim",
  h2: "a section",
  h3: "a sub-section",
  h4: "a group",
  h5: "a sub-group",
  h6: "a run of related items",
  p: "a paragraph",
  blockquote: "quoted editorial text",
  code: "inline code",
  small: "a small label",
  strong: "a strong run",
  a: "a link",
  figcaption: "the caption under a figure",
};

/**
 * The theme's document as it reads, with its aliases resolved.
 *
 * A theme says what a face IS by pointing at another slot — silk's heading
 * face is the sans — so a page that shows the raw document shows a reference
 * where the reader expects a family. The aliases are followed here, once,
 * and everything below reads the answer.
 */
function resolvedTree(): TokenTree | undefined {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return undefined;
  return resolveAliases(treeInMode(tree, activeMode())).tree;
}

/** Every token under `font`, resolved: the families, the scale, the weights. */
function fontRows(): readonly TokenRow[] {
  const tree = resolvedTree();
  if (tree === undefined) return [];
  return groupTokens(tree, [["font"]], activeMode());
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

/** The first family in a stack, without its quotes. */
function firstFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

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
    <Page
      title="Type"
      note="The faces a theme uses, the scale it sets, and which element reads which. The map at the end is the theme's to change."
      wide
    >
      <section class="stack mt-8" aria-label="Faces">
        <h2 class="text-xl">Faces</h2>
        <p class="max-w-screen-md text-text-muted">
          The families the theme declares. Each card names the slot, the face it
          resolves to, the stack behind it, and whether the theme loads that
          family itself.
        </p>
        <Show
          when={declaredFaces().length > 0}
          fallback={
            <p class="text-sm text-text-muted">
              This theme declares no faces yet.
            </p>
          }
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <For each={declaredFaces()}>
              {(slot) => <FaceCard slot={slot} />}
            </For>
          </div>
        </Show>
      </section>

      <section class="stack mt-8" aria-label="Scale">
        <div class="row-sm justify-between gap-3">
          <h2 class="text-xl">Scale</h2>
          <LinkToggle group="font.size" />
        </div>
        <p class="max-w-screen-md text-text-muted">
          The steps, largest first. Each is drawn at its own size, so the ramp
          is the judgement.
        </p>
        <div class="flex flex-col">
          <For each={scaleOrder()}>
            {(step) => <ScaleRow step={step} family={sizes} />}
          </For>
        </div>
      </section>

      <section class="stack mt-8" aria-label="Weight">
        <h2 class="text-xl">Weight</h2>
        <p class="max-w-screen-md text-text-muted">
          The weights a face can take, edited at their named step, so an element
          can claim any of them and the specimens read the value.
        </p>
        <ul class="flow-list stack-sm">
          <For each={weightRows()}>
            {(row) => (
              <li class="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="row-sm flex-wrap">
                  <span class={`text-2xl ${`font-${suffixOf(row.path)}`}`}>
                    {HEADING}
                  </span>
                  <code class="text-xs text-text-muted">{row.path}</code>
                </div>
                <div class="row-sm flex-wrap shrink-0">
                  <code class="text-xs whitespace-nowrap">
                    {`font-${suffixOf(row.path)}`}
                  </code>
                  <ValueInput
                    value={row.value}
                    type={row.type}
                    onCommit={(value) => editToken(row.path.split("."), value)}
                    group={weightRows().map((r) => r.value)}
                    variable={row.variable}
                    label={row.path}
                  />
                </div>
              </li>
            )}
          </For>
        </ul>
        <Show when={weightRows().length === 0}>
          <p class="text-sm text-text-muted">
            This theme declares no weights yet.
          </p>
        </Show>
      </section>

      <section class="stack mt-8" aria-label="Tracking">
        <h2 class="text-xl">Tracking</h2>
        <p class="max-w-screen-md text-text-muted">
          The letter spacing at each named step, on a line of text read at
          display size, where the spacing is the judgement.
        </p>
        <ul class="flow-list stack-sm">
          <For each={trackingRows()}>
            {(row) => (
              <li class="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="row-sm flex-wrap">
                  <span
                    class="text-2xl"
                    style={{ "letter-spacing": `var(${row.variable})` }}
                  >
                    {HEADING}
                  </span>
                  <code class="text-xs text-text-muted">{row.path}</code>
                </div>
                <div class="row-sm flex-wrap shrink-0">
                  <code class="text-xs whitespace-nowrap">
                    {`tracking-${suffixOf(row.path)}`}
                  </code>
                  <ValueInput
                    value={row.value}
                    type={row.type}
                    onCommit={(value) => editToken(row.path.split("."), value)}
                    group={trackingRows().map((r) => r.value)}
                    variable={row.variable}
                    label={row.path}
                  />
                </div>
              </li>
            )}
          </For>
        </ul>
        <Show when={trackingRows().length === 0}>
          <p class="text-sm text-text-muted">
            This theme declares no tracking yet.
          </p>
        </Show>
      </section>

      <section class="stack mt-8" aria-label="Element map">
        <h2 class="text-xl">Element map</h2>
        <p class="max-w-screen-md text-text-muted">
          Which element reads which face, size and weight. A row the theme says
          nothing about reads the ladder; setting one writes a token under
          {" `font.element` "}for that element.
        </p>
        {
          /* Six columns and a specimen in each: wider than the drawer's
            floor, so the table scrolls inside its own rail rather than
            widening a frame the reader cannot widen. */
        }
        <div class="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Specimen</th>
                <th>Face</th>
                <th>Size</th>
                <th>Weight</th>
                <th>What it is for</th>
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
      </section>
    </Page>
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
  return (
    <card class="stack p-6">
      {
        /*
        In the drawer the token name and the role stack: a `split` at 340px
        squeezes the role into a sliver beside a name that cannot wrap, which
        is the cramming the drawer screenshot showed.
      */
      }
      <div classList={{ split: !inDrawer(), "stack-sm": inDrawer() }}>
        <code class="text-text-muted text-sm">
          {`font.family.${props.slot}`}
        </code>
        <span class="rounded-md bg-surface-sunken px-2 py-1 text-xs text-text-muted">
          {role()}
        </span>
      </div>
      {
        /* The face, drawn in itself. A name in a stack is a reference; this
           is the thing the reference points at. */
      }
      <p
        class="text-2xl leading-tight"
        style={{ "font-family": row()?.value ?? "inherit" }}
      >
        {family() || "—"}
      </p>
      {
        /* The specimen is the face doing the job the slot exists for, and the
           stack is the value the theme holds. */
      }
      <p
        class="text-text-muted"
        style={{ "font-family": row()?.value ?? "inherit" }}
      >
        {SPECIMENS[role()] ?? SENTENCE}
      </p>
      <div class="border-border stack-sm border-t pt-4">
        <FamilyField
          value={row()?.value ?? ""}
          label={`font.family.${props.slot}`}
          onCommit={(stack) => editToken([`font.family.${props.slot}`], stack)}
        />
        <p class="text-xs text-text-muted">
          {loaded().includes(family())
            ? `The theme loads ${family()}.`
            : `The theme does not load ${
              family() || "this family"
            }, so the browser uses the next name in the stack.`}
        </p>
      </div>
    </card>
  );
}

/** One step of the scale, drawn at its own size. */
function ScaleRow(props: { step: string; family: Lockstep }) {
  const rows = () => props.family.rows();
  const row = () => sizeOf(rows(), props.step);
  return (
    <div class="split flex-wrap border-border border-b py-6 last:border-b-0">
      <p class={`text-${props.step}`}>
        {HEADING}
      </p>
      <div class="stack-sm shrink-0 items-end text-right">
        <code class="text-text-muted text-xs">{`font.size.${props.step}`}</code>
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
            />
          )}
        </Show>
      </div>
    </div>
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

  return (
    <tr>
      <td>
        <code>{`<${props.element}>`}</code>
      </td>
      <td>
        <Dynamic
          component={props.element}
          class="m-0"
          style={specimen()}
        >
          Aa
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
      <td class="text-text-muted">{NOTES[props.element] ?? ""}</td>
    </tr>
  );
}

/**
 * One step of the theme's own scale, chosen from a list.
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
  let select: HTMLSelectElement | undefined;
  // The value is set on the element rather than on the attribute: a select's
  // value means nothing until its options exist, and the options are created
  // after the element is.
  createEffect(() => {
    const value = props.value;
    if (select === undefined) return;
    if (select.value !== value) select.value = value;
  });
  const known = () => props.steps.some((step) => step.value === props.value);
  return (
    <select
      ref={(element) => {
        select = element;
      }}
      aria-label={props.label}
      class="border-border rounded-md border bg-surface px-2 py-1 text-sm"
      onChange={(event) => {
        const step = props.steps.find((entry) =>
          entry.value === event.currentTarget.value
        );
        if (step === undefined) return;
        props.onCommit(`{${props.group}.${step.name}}`);
      }}
    >
      <Show when={!known()}>
        <option value={props.value}>{props.value || "—"}</option>
      </Show>
      <For each={props.steps}>
        {(step) => <option value={step.value}>{step.name}</option>}
      </For>
    </select>
  );
}

/**
 * A family stack, typed as text.
 *
 * The theme's value is a stack — `Inter, ui-sans-serif, system-ui, sans-serif`
 * — and a stack is what the field takes. The swatch beside it says which
 * family the stack names, and the list below filters the catalogue as the
 * field is typed, so the families that exist are a filter rather than a list
 * to scroll.
 */
function FamilyField(props: {
  value: string;
  label: string;
  onCommit: (stack: string) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal(props.value);
  // The families that match what has been typed, asked of the catalogue the
  // host keeps. The studio does not hold the catalogue: the host has the
  // whole of it, and the endpoint answers a name rather than a list.
  //
  // A signal, not a resource: a resource read during the render is tracked
  // by the shell's Suspense, and a refetch would take the page's content
  // down for a moment — the scroll with it, so the field the reader just
  // focused would jump out of sight.
  const [matches, setMatches] = createSignal<readonly CatalogFont[]>([]);
  let asked = "";
  createEffect(() => {
    const query = firstFamily(draft());
    if (query === asked) return;
    asked = query;
    void searchFonts(query).then((listed) => {
      // A slower answer for an older question must not land over a newer one.
      if (asked === query) setMatches(listed);
    });
  });

  // The document's answer lands in the field once it is written; until then
  // the author is typing into it, and a re-render must not swallow the word
  // being written.
  createEffect(on(() => props.value, (value) => setDraft(value)));

  const family = () => firstFamily(draft());
  return (
    <div class="stack-sm">
      <div class="row-sm">
        <span
          class="rounded-md bg-surface-sunken px-2 py-1 text-sm"
          style={{ "font-family": `"${family()}"` }}
        >
          {family() || "—"}
        </span>
        <input
          type="text"
          aria-label={props.label}
          class="w-64 max-w-full rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs"
          placeholder="Inter, ui-sans-serif, system-ui, sans-serif"
          value={draft()}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            props.onCommit(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            // Enter commits, so a stack the author typed is not held until
            // the field loses the pointer.
            if (event.key === "Enter") {
              props.onCommit(event.currentTarget.value);
            }
          }}
        />
      </div>
      <Show when={open() && matches().length > 0}>
        <ul class="stack-sm m-0 w-64 max-w-full list-none p-0">
          <For each={matches()}>
            {(font) => (
              <li class="m-0">
                <button
                  type="button"
                  class="bare w-full rounded-md border border-border bg-surface-raised px-2 py-1 text-left text-sm hover:border-primary"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const stack = stackFor(font);
                    setDraft(stack);
                    setOpen(false);
                    props.onCommit(stack);
                  }}
                >
                  <span style={{ "font-family": `"${font.family}"` }}>
                    {font.family}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

/** The stack a catalogue family resolves to. */
function stackFor(font: CatalogFont): string {
  const fallback = font.category.includes("serif")
    ? "Georgia, serif"
    : font.category.includes("mono")
    ? "ui-monospace, monospace"
    : "ui-sans-serif, system-ui, sans-serif";
  return `"${font.family}", ${fallback}`;
}

/**
 * The families that match a name, asked of the host's catalogue.
 *
 * Two thousand families is a filter, not a list: the field asks the host for
 * the families that match what has been typed, and the host answers from the
 * whole of its catalogue rather than from the forty it would send unasked.
 */
let client: ReturnType<typeof spinClient> | undefined;

function searchFonts(query: string): Promise<readonly CatalogFont[]> {
  client ??= spinClient();
  return client
    .then((ready) => ready.fonts.catalog({ query }))
    .then((listed) => listed as readonly CatalogFont[]);
}
