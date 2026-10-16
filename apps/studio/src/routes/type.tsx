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
import { activeMode, themeText } from "../lib/store.ts";
import FontPicker from "../components/FontPicker.tsx";
import { groupTokens, type TokenRow } from "../lib/tokens.ts";
import { DISPLAY, HEADING, PARAGRAPH } from "../lib/specimen-copy.ts";
import { editToken } from "../lib/editing.ts";
import { inDrawer } from "../app.tsx";

/** The four family slots, and the sentence that shows each one off. */
const FAMILY_SLOTS = [
  {
    slot: "heading",
    role: "Headings, and anything that leads",
    sample: DISPLAY,
  },
  {
    slot: "body",
    role: "Paragraphs, and UI copy",
    sample: PARAGRAPH,
  },
  {
    slot: "serif",
    role: "Long-form editorial text",
    sample: "The shop has cupped every Tuesday for eleven years.",
  },
  {
    slot: "mono",
    role: "Code, identifiers, tabular figures",
    sample: "color.primary = #7c2d12",
  },
] as const;

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

/** The weights a user can set an element to, as the theme's scale names them. */
const WEIGHTS = ["400", "500", "600", "700", "800"] as const;

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

export default function TypePage() {
  return (
    <div class="drawer-scroll min-h-0 min-w-0 flex-1 overflow-y-auto">
      <header class="stack px-8 pt-8">
        <h1 class="text-3xl">Type</h1>
        <p class="max-w-screen-md text-text-muted">
          Four faces and one scale, and a map of which element claims which. A
          theme moves its type by moving these tokens, and every element that
          reads them follows.
        </p>
      </header>

      <section class="stack mt-8 px-8">
        <h2 class="text-xl">Faces</h2>
        <div class="flex flex-col gap-4">
          <For each={FAMILY_SLOTS}>
            {(slot) => (
              <FamilyCard
                slot={slot.slot}
                role={slot.role}
                sample={slot.sample}
              />
            )}
          </For>
        </div>
      </section>

      <section class="stack mt-12 px-8">
        <h2 class="text-xl">Scale</h2>
        <p class="max-w-screen-md text-text-muted">
          The nine steps, largest first. Each is drawn at its own size, so the
          ramp is the judgement.
        </p>
        <div class="flex flex-col">
          <For each={SCALE}>
            {(step) => <ScaleRow step={step} />}
          </For>
        </div>
      </section>

      <section class="stack mt-12 mb-16 px-8">
        <h2 class="text-xl">Which face each element claims</h2>
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
                        value={faceFor(entry.tag, entry.face)}
                        onChange={(event) =>
                          setType(entry.tag, {
                            face: event.currentTarget.value,
                          })}
                      >
                        <For each={FACES}>
                          {(face) => (
                            <option value={face.slot}>{face.slot}</option>
                          )}
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
                        value={weightFor(entry.tag) ?? (tagWeight(entry.tag)) ??
                          ""}
                        onChange={(event) =>
                          setType(entry.tag, {
                            weight: event.currentTarget.value || undefined,
                          })}
                      >
                        <option value="">scale</option>
                        <For each={WEIGHTS}>
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
    </div>
  );
}

/** One family slot: the face drawn in itself, and the stack that names it. */
function FamilyCard(props: { slot: string; role: string; sample: string }) {
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
        <span class="text-text-muted text-sm">{props.role}</span>
      </div>
      <p class={`font-${props.slot} text-2xl leading-tight`}>
        {props.sample}
      </p>
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
function ScaleRow(props: { step: string }) {
  const rows = createMemo(scaleRows);
  const row = () => sizeOf(rows(), props.step);
  return (
    <div class="split border-border border-b py-6 last:border-b-0">
      <p class={`text-${props.step}`}>
        {HEADING}
      </p>
      <div class="stack-sm shrink-0 items-end text-right">
        <code class="text-text-muted text-xs">{`font.size.${props.step}`}</code>
        <code class="text-sm">{row()?.value ?? "—"}</code>
      </div>
    </div>
  );
}

/** The faces a theme can assign, and the sentence that shows each off. */
const FACES = [
  { slot: "heading" },
  { slot: "body" },
  { slot: "serif" },
  { slot: "mono" },
] as const;

/** The face an element claims: its own token if set, else its default. */
function faceFor(tag: string, fallback: string): string {
  const rows = familyRows();
  const own = rows.find((row) => row.path === `font.element.${tag}`);
  return own?.value ?? fallback;
}

/**
 * Write the face an element claims.
 *
 * `font.element.<tag>` names a slot in `font.family`, and the rule prefers
 * it — so `<h1>` can claim a face while the other headings keep theirs.
 */
function setFace(tag: string, slot: string): void {
  editToken(["font", "element", tag], slot);
}

/** What one element may override about its type. Mirrors the preset's own. */
interface ElementType {
  face?: string;
  size?: string;
  weight?: string;
  lineHeight?: string;
  tracking?: string;
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
  const rows = familyRows();
  const own = rows.find((row) => row.path === `font.element.${tag}`);
  if (own === undefined) return {};
  try {
    const parsed = JSON.parse(own.value) as ElementType & { face: string };
    return parsed;
  } catch {
    // The earlier shape: a bare slot name.
    return { face: own.value };
  }
}

/**
 * Write one element's override.
 *
 * `font.element.<tag>` holds the whole thing, so a face change keeps the
 * size the user already set — a write per property would drop the others.
 */
function setType(tag: string, change: Partial<ElementType>): void {
  const next: ElementType = { ...elementTypeFor(tag), ...change };
  const own = familyRows().find((row) => row.path === `font.element.${tag}`);
  const fields: Record<string, string> = {};
  if (next.face !== undefined) fields.face = next.face;
  if (next.size !== undefined) fields.size = next.size;
  if (next.weight !== undefined) fields.weight = String(next.weight);
  editToken(["font", "element", tag], JSON.stringify(fields));
  void own;
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

/** The weight scale, read the same way. */
const WEIGHT_STEPS = ["regular", "medium", "semibold", "bold"] as const;

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
  const size = own.size ?? SIZE_VAR[tagSize(tag) ?? ""] ?? SIZE_VAR.lg;
  style["font-size"] = size.startsWith("--") ? `var(${size})` : size;
  const weight = own.weight ?? WEIGHT_VAR[tagWeight(tag) ?? ""] ?? "";
  if (weight !== "") style["font-weight"] = `var(${weight})`;
  return style;
}

/** The class that renders the preview in the face its row names. */
function previewClass(tag: string): string {
  const slot = faceFor(tag, tag.startsWith("h") ? "heading" : "body");
  return `font-${slot.replace(/[^a-z]/g, "")}`;
}
