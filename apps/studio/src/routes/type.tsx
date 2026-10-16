/**
 * Type — the first surface in the studio designed as a product rather than
 * assembled from token rows.
 *
 * A token list answers "what is `font-size-lg` worth". A type surface has to
 * answer the questions a theme author actually has:
 *
 *   **What does each face look like, and which slot claims it?** `body`,
 *   `heading`, `serif`, `mono` — each a live specimen, not a CSS stack in a
 *   text field. A stack string is the value, not the thing.
 *
 *   **Does the scale read as a scale?** Nine sizes in a list are nine
 *   numbers; nine sizes in a ramp are a decision. The ramp is rendered at
 *   size, largest first, with the token and the computed value beside it.
 *
 *   **Which face does each element claim?** `<h1>`–`<h6>` claiming `heading`
 *   and `<p>` claiming `body` is a mapping, and it should be legible at a
 *   glance rather than inferred from which specimens happened to be on screen.
 *
 * The specimens are the studio's own neutral copy, the same in every
 * project, so two themes are compared on the same reading rather than on
 * whoever wrote the sample.
 */

import { createMemo, For, Show } from "solid-js";
import { analyzeTheme } from "../lib/theme.ts";
import { defaultFaceFor } from "../lib/faces.ts";
import { elementOverrides, overrideWrites } from "../lib/elements.ts";
import { activeMode, themeText } from "../lib/store.ts";
import FontPicker from "../components/FontPicker.tsx";
import { groupTokens, type TokenRow } from "../lib/tokens.ts";
import { DISPLAY, HEADING } from "../lib/specimen-copy.ts";
import { editToken, upsertToken } from "../lib/editing.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";
import Page from "../components/Page";
import { inDrawer } from "../app.tsx";

/** `font.weight.bold` → `bold`, the suffix the matching utility spends. */
function suffixOf(path: string): string {
  return path.split(".").slice(2).join("-");
}
/** Which face each element claims. The assignment is the design decision. */
const TAG_MAP = [
  {
    tag: "h1",
    face: "heading",
    size: "3xl",
    weight: "bold",
    note: "the document's one opening claim",
  },
  {
    tag: "h2",
    face: "heading",
    size: "2xl",
    weight: "semibold",
    note: "a section",
  },
  {
    tag: "h3",
    face: "heading",
    size: "xl",
    weight: "semibold",
    note: "a sub-section",
  },
  {
    tag: "h4",
    face: "heading",
    size: "lg",
    weight: "semibold",
    note: "a group",
  },
  {
    tag: "h5",
    face: "heading",
    size: "md",
    weight: "semibold",
    note: "a sub-group",
  },
  {
    tag: "h6",
    face: "heading",
    size: "sm",
    weight: "semibold",
    note: "a run of related items",
  },
  { tag: "p", face: "body", size: "md", note: "a paragraph" },
  {
    tag: "blockquote",
    face: "serif",
    size: "md",
    note: "quoted editorial text",
  },
  { tag: "code", face: "mono", size: "sm", note: "inline code" },
  { tag: "pre", face: "mono", size: "sm", note: "a block of code" },
  { tag: "kbd", face: "mono", size: "sm", note: "a key the reader presses" },
] as const;

/** The scale, largest first, so it reads as a decision rather than a list. */
const SCALE = ["3xl", "2xl", "xl", "lg", "md", "sm", "xs", "2xs"] as const;

/**
 * The family and scale tokens the active theme declares, resolved live.
 *
 * Read from the editor's own document rather than from the shipped theme:
 * what this page draws is what a token edit produces, which is the whole
 * point of a studio. `valuesInMode` inside `groupTokens` keeps dark mode
 * honest — it used to edit the base value while writing the override.
 */
function familyRows(): readonly TokenRow[] {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return [];
  return groupTokens(tree, [["font", "family"]], activeMode());
}

function scaleRows(): readonly TokenRow[] {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return [];
  return groupTokens(tree, [["font", "size"]], activeMode());
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

/** The font-weight tokens the theme declares, so the controls edit real rows. */
function weightRows(): TokenRow[] {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return [];
  return groupTokens(tree, [["font", "weight"]], activeMode());
}

/** The letter-spacing tokens the theme declares, for the tracking family. */
function trackingRows(): TokenRow[] {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return [];
  return groupTokens(tree, [["font", "letter-spacing"]], activeMode());
}

/** The element overrides a theme has spelt. */
function elementTokenRows(): TokenRow[] {
  const tree = analyzeTheme(themeText()).tree;
  if (tree === undefined) return [];
  return groupTokens(tree, [["font", "element"]], activeMode());
}

/** The face names the theme actually declares. */
function declaredFaces(): readonly string[] {
  return familyRows().map((row) => row.path.split(".").pop()!);
}

/** Options for the face select — the theme's own families, else the usual ones. */
function faceOptions(): readonly string[] {
  const declared = declaredFaces();
  return declared.length > 0 ? declared : (["sans", "serif", "mono"] as const);
}

/** Options for the weight select — the theme's declared scales. */
function weightOptions(): readonly string[] {
  const declared = weightRows().map((row) => row.path.split(".").pop()!);
  return declared.length > 0
    ? declared
    : (["400", "500", "600", "700", "800"] as const);
}

export default function TypePage() {
  const sizes = createLockstep(scaleRows, "font.size");
  return (
    <Page
      title="Type"
      note="Four faces and one scale, and a map of which element claims which."
      wide
    >
      <section class="stack mt-8 px-8">
        <h2 class="text-xl">Faces</h2>
        <div class="flex flex-col gap-4">
          <For each={declaredFaces()}>
            {(slot) => (
              <FamilyCard
                slot={slot}
                sample={DISPLAY}
              />
            )}
          </For>
          <Show when={declaredFaces().length === 0}>
            <p class="text-sm text-text-muted">
              This theme declares no faces yet.
            </p>
          </Show>
        </div>
      </section>

      <section class="stack mt-12 px-8">
        <div class="row-sm justify-between gap-3">
          <h2 class="text-xl">Scale</h2>
          <LinkToggle group="font.size" />
        </div>
        <p class="max-w-screen-md text-text-muted">
          The nine steps, largest first. Each is drawn at its own size, so the
          ramp is the judgement.
        </p>
        <div class="flex flex-col">
          <For each={SCALE}>
            {(step) => <ScaleRow step={step} family={sizes} />}
          </For>
        </div>
      </section>

      <section class="stack mt-12 px-8">
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

      <section class="stack mt-12 px-8">
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

      <section class="stack mt-12 mb-16 px-8">
        <p class="max-w-screen-md text-text-muted">
          {"Every element reads a face, and any of them can read a different one from its siblings. <h1> claiming the display face while <h2> and <h3> take the body face is a decision this table makes. In a template literal, not as JSX: the compiler reads a bare <h1> in prose as an element and says so."}
        </p>
        {
          /* Six columns and a face specimen in each: wider than the drawer's
            floor, so the table scrolls inside its own rail rather than
            widening a frame the reader cannot widen. */
        }
        <div class="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Element</th>
                <th>Set at</th>
                <th>Face</th>
                <th>Size</th>
                <th>Weight</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <For each={TAG_MAP}>
                {(entry) => (
                  <tr>
                    <td>
                      <code>{`<${entry.tag}>`}</code>
                    </td>
                    {
                      /* The preview is the row's own specimen: the element, empty,
                      so it takes whatever this row decides and nothing from the
                      copy beside it. */
                    }
                    <td>
                      <span
                        class={previewClass(entry.tag)}
                        style={previewStyle(entry.tag)}
                      >
                        {entry.tag === "p" ? "Aa Bb Cc" : "Aa"}
                      </span>
                    </td>
                    <td>
                      <select
                        value={faceFor(entry.tag) ?? ""}
                        onChange={(event) =>
                          setType(entry.tag, {
                            face: event.currentTarget.value,
                          })}
                      >
                        <For each={faceOptions()}>
                          {(face) => <option value={face}>{face}</option>}
                        </For>
                      </select>
                    </td>
                    {
                      /* Size and weight are per-element, so they are overrides
                      rather than tokens: minting a token for one element's size
                      would be a theme file per heading. They land in the same
                      `font.element.<tag>` group the face already uses. */
                    }
                    <td>
                      <select
                        value={sizeFor(entry.tag) ?? ""}
                        onChange={(event) =>
                          setType(entry.tag, {
                            size: event.currentTarget.value || undefined,
                          })}
                      >
                        <option value="">scale</option>
                        <For each={SIZE_STEPS}>
                          {(step) => <option value={step}>{step}</option>}
                        </For>
                      </select>
                    </td>
                    <td>
                      <select
                        value={weightFor(entry.tag) ?? (tagWeight(entry.tag) ??
                          "")}
                        onChange={(event) =>
                          setType(entry.tag, {
                            weight: event.currentTarget.value || undefined,
                          })}
                      >
                        <option value="">scale</option>
                        <For each={weightOptions()}>
                          {(weight) => <option value={weight}>{weight}</option>}
                        </For>
                      </select>
                    </td>
                    <td class="text-text-muted">{entry.note}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}

/** One family slot: the face drawn in itself, and the stack that names it. */
function FamilyCard(props: { slot: string; sample: string }) {
  const rows = createMemo(familyRows);
  const row = () => tokenFor(rows(), props.slot);
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
      </div>
      <p class={`font-${props.slot} text-2xl leading-tight`}>{props.sample}</p>
      {
        /* The stack is output. Under it, the decision: which family this slot
           spends, chosen from the catalogue rather than typed as a comma
           separated list. */
      }
      <div class="border-border border-t pt-4">
        <code class="text-text-muted text-xs">{row()?.value ?? "—"}</code>
        <FontPicker
          slot={props.slot}
          value={row()?.value ?? ""}
          onPick={(stack) =>
            editToken(
              (row()?.path ?? `font.family.${props.slot}`).split("."),
              stack,
            )}
        />
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

/** The face an element claims: its own token if set, else its default. */
function faceFor(tag: string): string {
  const own = elementOverrides(elementTokenRows(), tag).face;
  if (own) return own;
  return defaultFaceFor(tag, declaredFaces());
}

/** What one element may override about its type. Mirrors the preset's own. */
interface ElementType {
  face?: string;
  size?: string;
  weight?: string;
}

/** The size an element claims for itself, as the theme stores it. */
function sizeFor(tag: string): string | undefined {
  return elementTypeFor(tag).size;
}

/** The weight an element claims for itself. */
function weightFor(tag: string): string | undefined {
  return elementTypeFor(tag).weight;
}

/** The whole override one element carries, whatever shape it was written in. */
function elementTypeFor(tag: string): ElementType {
  return elementOverrides(elementTokenRows(), tag);
}

/**
 * Write one element's override.
 *
 * `font.element.<tag>` holds the leaves per property, so a face change keeps
 * the size the user already set — a write per property would drop the others.
 * A leaf the element has never specified gets minted along the way, and the
 * group keeps what it had when this field is left unset.
 */
function setType(tag: string, change: Partial<ElementType>): void {
  const existing = elementTokenRows();
  for (const write of overrideWrites(existing, tag, change)) {
    if (write.exists) {
      editToken([...write.path], write.value);
    } else {
      upsertToken([...write.path], write.type, write.value);
    }
  }
}

/** The scale weight a heading level states, for the field's placeholder. */
function tagWeight(tag: string): string {
  const row = TAG_MAP.find((entry) => entry.tag === tag);
  return row && "weight" in row ? String(row.weight) : "";
}

/** The scale size an element states, for its placeholder. */
function tagSize(tag: string): string {
  const row = TAG_MAP.find((entry) => entry.tag === tag);
  return row ? row.size : "";
}

/** The size scale a theme declares, as steps rather than freeform text. */
const SIZE_STEPS = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"] as const;

/** A step's custom property, so a preview renders at the theme's own size. */
const SIZE_VAR: Record<string, string> = {
  "2xs": "--font-size-2xs",
  xs: "--font-size-xs",
  sm: "--font-size-sm",
  md: "--font-size-md",
  lg: "--font-size-lg",
  xl: "--font-size-xl",
  "2xl": "--font-size-2xl",
  "3xl": "--font-size-3xl",
};

/** A step's weight custom property. */
const WEIGHT_VAR: Record<string, string> = {
  regular: "--font-weight-regular",
  medium: "--font-weight-medium",
  semibold: "--font-weight-semibold",
  bold: "--font-weight-bold",
};

/**
 * The style a row's preview renders at.
 *
 * The element's own override wins, else the scale step it sits on, read as
 * the custom property the theme declared. A preview rendering at a fixed
 * size is a label, and this whole page exists to judge size.
 */
function previewStyle(tag: string): Record<string, string> {
  const own = elementTypeFor(tag);
  const style: Record<string, string> = {};
  let size = SIZE_VAR[tagSize(tag) ?? ""] ?? SIZE_VAR.lg;
  if (own.size !== undefined) size = SIZE_VAR[own.size] ?? own.size;
  style["font-size"] = size.startsWith("--") ? `var(${size})` : size;
  const ownWeight = own.weight;
  let weightDecl = "";
  if (ownWeight !== undefined) {
    weightDecl = /^\d+$/.test(ownWeight)
      ? ownWeight
      : `var(--font-weight-${ownWeight})`;
  } else {
    const w = WEIGHT_VAR[tagWeight(tag) ?? ""] ?? "";
    if (w !== "") weightDecl = `var(${w})`;
  }
  if (weightDecl !== "") {
    style["font-weight"] = weightDecl;
  }
  return style;
}

/** The class that renders the preview in the face its row names. */
function previewClass(tag: string): string {
  const slot = faceFor(tag);
  return `font-${slot.replace(/[^a-z]/g, "")}`;
}
