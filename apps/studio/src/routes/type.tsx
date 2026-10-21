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
import { activeMode, themeText } from "../lib/store.ts";
import FontPicker from "../components/FontPicker.tsx";
import { groupTokens, type TokenRow, toPx } from "../lib/tokens.ts";
import { DISPLAY, HEADING } from "../lib/specimen-copy.ts";
import { editToken } from "../lib/editing.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import LinkToggle from "../components/demos/LinkToggle.tsx";
import { createLockstep, type Lockstep } from "../lib/lockstep.ts";
import Page from "../components/Page";
import { inDrawer } from "../app.tsx";

/** `font.weight.bold` → `bold`, the suffix the matching utility spends. */
function suffixOf(path: string): string {
  return path.split(".").slice(2).join("-");
}
/**
 * Which step of the ladder each element reads.
 *
 * The FACE is not here: it is read from the theme's own families — a heading
 * reads the display face, a quotation the editorial one, the code family the
 * mono one — so a theme that names no display face is shown reading the one
 * it does name. The steps and the weights are the system's ladder, and they
 * are stated once, here.
 */
const TAG_MAP = [
  {
    tag: "h1",
    size: "3xl",
    weight: "bold",
    note: "the document's one opening claim",
  },
  {
    tag: "h2",
    size: "2xl",
    weight: "semibold",
    note: "a section",
  },
  {
    tag: "h3",
    size: "xl",
    weight: "semibold",
    note: "a sub-section",
  },
  {
    tag: "h4",
    size: "lg",
    weight: "semibold",
    note: "a group",
  },
  {
    tag: "h5",
    size: "md",
    weight: "semibold",
    note: "a sub-group",
  },
  {
    tag: "h6",
    size: "sm",
    weight: "semibold",
    note: "a run of related items",
  },
  { tag: "p", size: "md", note: "a paragraph" },
  {
    tag: "blockquote",
    size: "md",
    note: "quoted editorial text",
  },
  { tag: "code", size: "sm", note: "inline code" },
  { tag: "pre", size: "sm", note: "a block of code" },
  { tag: "kbd", size: "sm", note: "a key the reader presses" },
] as const;

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

/** The face names the theme actually declares. */
function declaredFaces(): readonly string[] {
  return familyRows().map((row) => row.path.split(".").pop()!);
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
          The steps, largest first. Each is drawn at its own size, so the ramp
          is the judgement.
        </p>
        <div class="flex flex-col">
          <For each={scaleOrder()}>
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
          {"The map of what each element reads. A heading reads the theme's display face and the ladder's steps, a quotation reads the editorial face, the code family reads the mono one, and everything else reads the body's. The map is the system's, not the theme's: the faces it names are edited above, and so is the scale. In a template literal, not as JSX: the compiler reads a bare <h1> in prose as an element and says so."}
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
                <th>Reads</th>
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
                      <code>{faceFor(entry.tag)}</code>
                    </td>
                    <td>
                      <code>{entry.size}</code>
                    </td>
                    <td>
                      <code>{tagWeight(entry.tag) || "—"}</code>
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

/**
 * The face an element claims: the slot the system spends for it.
 *
 * The map is the system's, so the face is READ, not written: the theme's
 * families are edited in the Faces section above, and the element map says
 * which of them each element reads.
 */
function faceFor(tag: string): string {
  return defaultFaceFor(tag, declaredFaces());
}

/** The scale weight a heading level states. */
function tagWeight(tag: string): string {
  const row = TAG_MAP.find((entry) => entry.tag === tag);
  return row && "weight" in row ? String(row.weight) : "";
}

/** The scale size an element states. */
function tagSize(tag: string): string {
  const row = TAG_MAP.find((entry) => entry.tag === tag);
  return row ? row.size : "";
}

/**
 * A step's custom property, so a preview renders at the theme's own size.
 *
 * The naming is the system's: a step named `2xs` is `--font-size-2xs`, and a
 * step a theme invents (`display`) follows the same rule — which is why this
 * is derived rather than listed.
 */
function sizeVar(step: string): string {
  return `--font-size-${step}`;
}

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
 * The scale step the element sits on, read as the custom property the theme
 * declared. A preview rendering at a fixed size is a label, and this whole
 * page exists to judge size.
 */
function previewStyle(tag: string): Record<string, string> {
  const style: Record<string, string> = {};
  const size = sizeVar(tagSize(tag) ?? "lg");
  style["font-size"] = size.startsWith("--") ? `var(${size})` : size;
  const weight = WEIGHT_VAR[tagWeight(tag)] ?? "";
  if (weight !== "") style["font-weight"] = `var(${weight})`;
  return style;
}

/** The class that renders the preview in the face its row names. */
function previewClass(tag: string): string {
  const slot = faceFor(tag);
  return `font-${slot.replace(/[^a-z]/g, "")}`;
}
