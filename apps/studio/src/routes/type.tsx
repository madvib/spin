/** Type — the faces a theme uses, the ramps it sets, and the styles elements read. */

import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { FamilyField, firstFamily } from "../components/FamilyField.tsx";
import { tokenStatus } from "../lib/live-edit.ts";
import { activeMode, activeName, activeTree, noteRefusal, refusalFor, registry, setThemeText, themeText } from "../lib/store.ts";
import {
  attachedStyle,
  elementTargets,
  groupTokens,
  referenceTargets,
  scaleRampEdits,
  styleEdits,
  styleGroups,
  trimRefusal,
  trimStyle,
  typeTarget,
  type StyleGroup,
  type TokenRow,
} from "../lib/tokens.ts";
import { SENTENCE } from "../lib/specimen-copy.ts";
import {
  editFontFamily,
  editToken,
  editTokens,
  upsertToken,
} from "../lib/editing.ts";
import { facesOf, fontDeclarationFor, injectFontFaces, type CatalogFont } from "../lib/fonts.ts";
import { spinClient } from "../lib/client.ts";
import { scaleValue } from "../lib/scale.ts";
import ValueInput from "../components/demos/ValueInput.tsx";
import {
  Badge,
  ConcernPage,
  Frame,
  Section,
  TokenLine,
} from "../components/Concern.tsx";

/** System stacks the picker offers when no webfont names the slot. */
const SYSTEM_STACKS: readonly { label: string; stack: string }[] = [
  { label: "System sans", stack: "ui-sans-serif, system-ui, sans-serif" },
  { label: "System serif", stack: "ui-serif, Georgia, Cambria, serif" },
  { label: "System mono", stack: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

/** The step's own name: the last segment of its path. */
function stepName(path: string): string {
  return path.split(".").pop() ?? path;
}

/** Concise specimen phrases for each HTML element in the attachment table. */
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

/** The ramps this page edits: the scales named styles are built from. */
const RAMPS: readonly { group: string; title: string; info: string }[] = [
  { group: "font.size", title: "Size", info: "The sizes named styles read at." },
  { group: "font.weight", title: "Weight", info: "The weights named styles read at." },
  { group: "font.tracking", title: "Tracking", info: "How far the letters sit from each other." },
  { group: "font.leading", title: "Leading", info: "How far the lines sit from each other." },
];

/** Every token under `font.family`: the faces the theme declares. */
function familyRows(): readonly TokenRow[] {
  return groupTokens(activeTree(), [["font", "family"]], activeMode());
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
  return facesOf(themeText()).map((face) => face.family);
}

/** Re-exported with the shared family field. */
export { firstFamily };


export default function TypePage() {
  return (
    <ConcernPage title="Type">
      <Section
        title="Faces"
        fact={`${declaredFaces().length} faces`}
        info="The faces the theme loads, and the stack each slot reads. Pick a webfont into the library or keep a system stack."
      >
        <Show
          when={declaredFaces().length > 0}
          fallback={
            <p>
              This theme declares no faces yet.
            </p>
          }
        >
          <ul class="stack-sm">
            <For each={declaredFaces()}>
              {(slot) => <FacePickerRow slot={slot} />}
            </For>
          </ul>
        </Show>
        <FontDiscovery />
      </Section>

      <For each={RAMPS}>
        {(ramp) => <RampSection group={ramp.group} title={ramp.title} info={ramp.info} />}
      </For>

      <Section
        title="Styles"
        fact={`${styleGroups(activeTree()).length} styles`}
        info="Named type styles: the theme's complete tuples, spent with type-<name>. The owned set is the contract's — trim a user-extension style, never an owned name. Elements read their style through element.<name>.type (see Attachment below)."
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
        fact={`${elementTargets(activeTree()).length} elements`}
        info="Which style each element reads through its element.<name>.type alias. Re-pointing rewrites the alias, so the element follows the new style live — never per-field overrides."
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
              <For each={elementTargets(activeTree())}>
                {(element) => <AttachmentRow element={element} />}
              </For>
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="References"
        fact={`${referenceTargets(activeTree()).length} references`}
        info="The .type aliases components read: button.type for every button, button.<variant>.type for one variant. A target that names no declared style is a theme error, said here."
      >
        <ul class="stack-sm">
          <For each={referenceTargets(activeTree())}>
            {(path) => <ReferenceRow path={path} />}
          </For>
        </ul>
      </Section>

    </ConcernPage>
  );
}

/** One family slot as a picker row: the stack it reads, edited in place. */
function FacePickerRow(props: { slot: string }) {
  const rows = createMemo(familyRows);
  const row = () =>
    rows().find((entry) => entry.path === `font.family.${props.slot}`);
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
    <TokenLine
      path={`font.family.${props.slot}`}
      editor={
        <>
          <Show when={status().aliasOf}>
            {(target) => (
              <span>
                → {target().split(".").pop() ?? target()}
              </span>
            )}
          </Show>
          <Badge tone={loaded().includes(family()) ? "primary" : "info"}>
            {loaded().includes(family()) ? "webfont" : "system stack"}
          </Badge>
          <FamilyField
            value={row()?.value ?? ""}
            label={`font.family.${props.slot}`}
            onCommit={(stack, font) =>
              editFontFamily(["font", "family", props.slot], stack, font)}
          />
        </>
      }
    />
  );
}

/** Font discovery: webfonts from the catalogue plus system stacks, selected into the library. */
function FontDiscovery() {
  const [query, setQuery] = createSignal("");
  const [picked, setPicked] = createSignal<CatalogFont | undefined>(undefined);
  const [stack, setStack] = createSignal(SYSTEM_STACKS[0]!.stack);
  const [matches] = createResource(query, async (needle) => {
    const client = await spinClient();
    const listed = await client.fonts.catalog(
      needle.trim() === "" ? {} : { query: needle },
    );
    const fonts = listed as readonly CatalogFont[];
    injectFontFaces(fonts.map((font) => fontDeclarationFor(font)));
    return fonts.slice(0, 8);
  });
  const selectIntoLibrary = (font: CatalogFont): void => {
    const declaration = fontDeclarationFor(font);
    injectFontFaces([declaration]);
    setPicked(font);
  };
  const commitLibraryPick = (): boolean => {
    const font = picked();
    if (font === undefined) {
      noteRefusal("Pick a webfont from the discovery list first.");
      return false;
    }
    return editFontFamily(
      ["font", "family", "sans"],
      `"${font.family}", ui-sans-serif, system-ui, sans-serif`,
      fontDeclarationFor(font),
    );
  };
  return (
    <Frame class="stack-sm">
      <div class="row-sm flex-wrap">
        <label class="row-sm">
          Discover
          <input
            type="text"
            class="w-36"
            placeholder="Inter, Fraunces, JetBrains Mono"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-label="Discover webfonts by name"
          />
        </label>
        <Show when={matches.loading}>
          <span>Searching…</span>
        </Show>
      </div>
      <Show when={(matches() ?? []).length > 0}>
        <ul class="stack-xs">
          <For each={matches() ?? []}>
            {(font) => (
              <li class="row-sm flex-wrap">
                <button
                  type="button"
                  class="secondary s-sm"
                  aria-pressed={picked()?.id === font.id}
                  onClick={() => selectIntoLibrary(font)}
                >
                  {font.family}
                </button>
                <span>{font.category}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div class="row-sm flex-wrap">
        <label class="row-sm">
          System stack
          <select
            aria-label="System stack for a slot kept local"
            value={stack()}
            onChange={(event) => setStack(event.currentTarget.value)}
          >
            <For each={SYSTEM_STACKS}>
              {(entry) => <option value={entry.stack}>{entry.label}</option>}
            </For>
          </select>
        </label>
        <button
          type="button"
          class="secondary s-sm"
          onClick={() => editFontFamily(["font", "family", "sans"], stack())}
        >
          Keep system stack
        </button>
        <Show when={picked()}>
          {(font) => (
            <button
              type="button"
              class="secondary s-sm"
              onClick={commitLibraryPick}
            >
              Select {font().family} into the library
            </button>
          )}
        </Show>
      </div>
    </Frame>
  );
}

/** One ramp: compact step rows plus a scale-all tool that multiplies every step. */
function RampSection(props: { group: string; title: string; info: string }) {
  const rows = createMemo(() =>
    groupTokens(activeTree(), [props.group.split(".")], activeMode())
  );
  return (
    <Section title={props.title} fact={`${rows().length} steps`} info={props.info}>
      <Show
        when={rows().length > 0}
        fallback={
          <p>
            This theme declares no {props.title.toLowerCase()} steps yet.
          </p>
        }
      >
        <Frame>
          <ul>
            <For each={rows()}>
              {(row) => (
                <TokenLine
                  path={row.path}
                  editor={
                    <ValueInput
                      value={row.value}
                      type={row.type}
                      onCommit={(value) => editToken(row.path.split("."), value)}
                      group={rows().map((entry) => entry.value)}
                      variable={row.variable}
                      label={row.path}
                    />
                  }
                />
              )}
            </For>
          </ul>
          <ScaleAll rows={rows()} />
        </Frame>
      </Show>
    </Section>
  );
}

/** Multiply every step of a ramp by one factor, with a preview before the commit. */
function ScaleAll(props: { rows: readonly TokenRow[] }) {
  const [factor, setFactor] = createSignal("1.1");
  const parsed = () => Number(factor());
  const preview = (): readonly { path: string; value: string }[] => {
    const at = parsed();
    if (!Number.isFinite(at) || at <= 0) return [];
    return props.rows.flatMap((row) => {
      const next = scaleValue(row.value, at);
      return next === undefined || next === row.value
        ? []
        : [{ path: stepName(row.path), value: next }];
    });
  };
  const commit = (): void => {
    const at = parsed();
    let edits: readonly { path: readonly string[]; value: string }[];
    try {
      edits = scaleRampEdits(props.rows, at);
    } catch (err) {
      noteRefusal(err instanceof Error ? err.message : String(err));
      return;
    }
    if (edits.length === 0) {
      noteRefusal("A factor of one moves nothing.");
      return;
    }
    editTokens(
      edits.map((edit) => ({ path: [...edit.path], value: edit.value })),
      "base",
    );
  };
  return (
    <div class="row-sm flex-wrap">
      <label class="row-sm">
        Scale all
        <input
          type="text"
          inputmode="decimal"
          value={factor()}
          onInput={(event) => setFactor(event.currentTarget.value)}
          aria-label="Factor every step multiplies by"
        />
      </label>
      <button type="button" class="secondary s-sm" onClick={commit}>
        Scale all ×{factor()}
      </button>
      <Show when={preview().length > 0}>
        <span>
          <For each={preview()}>
            {(entry) => <span>{entry.path} → {entry.value}; </span>}
          </For>
        </span>
      </Show>
    </div>
  );
}

/**
 * One named style: its specimen, its tuple leaves, and its trim.
 *
 * The specimen wears the style's own variables, so it reads what the theme
 * says rather than what the row claims. The trim refuses the owned set in
 * words — an owned name is stable API, and trimming it fails completeness.
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
    <li class="stack-sm rounded-md border bg-surface-raised p-4">
      <div class="row-sm flex-wrap items-center gap-2">
        <span class="type-label">{name()}</span>
        <Show when={props.group.owned}>
          <span title="Owned styles stay: every theme keeps them, so there is nothing to trim.">
            <Badge tone="info">owned</Badge>
          </span>
        </Show>
        <code>type-{name()}</code>
        <code>font.style.{name()}</code>
        <Show when={!props.group.owned}>
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
      <div data-studio-specimen="" class="rounded-md border bg-surface p-3">
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
 * The specimen wears the element's own .type variables, so a row shows what
 * the element reads rather than what the row says it reads. The pick
 * re-points the element's .type alias at the new style — created when the
 * document lacks it, edited when it has it — and the gate judges the batch
 * whole. There is no default marker: the tree is layered, so the attached
 * style IS the answer.
 */
function AttachmentRow(props: { element: string }) {
  const attached = () => attachedStyle(activeTree(), props.element);
  const names = () => styleGroups(activeTree()).map((group) => group.name);
  const specimen = (): Record<string, string> => ({
    "font-family": `var(--element-${props.element}-type-family)`,
    "font-size": `var(--element-${props.element}-type-size)`,
    "font-weight": `var(--element-${props.element}-type-weight)`,
  });
  const repoint = (style: string): void => {
    if (!names().includes(style)) {
      noteRefusal(`“${style}” is not a style this theme declares.`);
      return;
    }
    upsertToken(["element", props.element, "type"], "typography", `{font.style.${style}}`, "base");
  };
  return (
    <tr>
      <td>
        <code>{`<${props.element}>`}</code>
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
            <Show when={attached() === undefined}>
              <option value="">—</option>
            </Show>
            <For each={names()}>
              {(style) => <option value={style}>{style}</option>}
            </For>
          </select>
          <code>type-{attached() ?? "—"}</code>
        </div>
      </td>
    </tr>
  );
}

/**
 * One .type alias a component reads: the style it names, and whether that
 * style is declared.
 *
 * The value is a whole-style alias, edited by picking the style it names
 * and judged against the declared styles: a target no style wears is a
 * theme error, said on the row rather than left silent. A missing alias is
 * unset — the row shows "—" until a style is picked, which creates the
 * token.
 */
function ReferenceRow(props: { path: string }) {
  const target = () => typeTarget(activeTree(), props.path);
  const names = () => styleGroups(activeTree()).map((group) => group.name);
  const dangling = () => {
    const value = target() ?? "";
    return value.length > 0 && !names().includes(value)
      ? `"${value}" names no declared font.style`
      : undefined;
  };
  const commit = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      noteRefusal(`${props.path}: a .type alias names a declared font.style — an empty name says nothing.`);
      return false;
    }
    return upsertToken(props.path.split("."), "typography", `{font.style.${trimmed}}`, "base");
  };
  return (
    <li class="stack-sm rounded-md border bg-surface-raised p-4">
      <div class="row-sm flex-wrap items-center gap-2">
        <code>{props.path}</code>
        <Show when={target() === undefined}>
          <Badge tone="info">unset</Badge>
        </Show>
      </div>
      <div data-studio-chrome="" class="row-sm flex-wrap gap-2">
        <select
          aria-label={`Style ${props.path} names`}
          value={target() ?? ""}
          onChange={(event) => {
            commit(event.currentTarget.value);
          }}
        >
          <Show when={target() === undefined}>
            <option value="">—</option>
          </Show>
          <For each={names()}>
            {(style) => <option value={style}>{style}</option>}
          </For>
        </select>
        <code>type-{target() ?? "—"}</code>
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
