/**
 * Type styles — the named styles, and what reads them.
 *
 * The styles landing: `/themes/type` itself renders this, since styles are
 * the primary content. Elements (which style each element reads) and
 * components (which style each component alias names) live here beside the
 * styles they point at, rather than on their own routes.
 */

import { createMemo, createSignal, For, Show } from "solid-js";
import { activeTree, noteRefusal, refusalFor, setThemeText, themeText } from "../../lib/store.ts";
import {
  attachedStyle,
  elementTargets,
  styleGroups,
  styleEdits,
  trimRefusal,
  trimStyle,
  type StyleGroup,
} from "../../lib/tokens.ts";
import { SENTENCE } from "../../lib/specimen-copy.ts";
import {
  editToken,
  upsertToken,
} from "../../lib/editing.ts";
import ValueInput from "../../components/demos/ValueInput.tsx";
import StudioSelect from "../../components/StudioSelect.tsx";
import {
  Badge,
  ConcernPage,
  Section,
} from "../../components/Concern.tsx";
import { ELEMENT_SPECIMENS } from "./type-shared.ts";

function styleSpecimen(group: StyleGroup): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of group.fields) {
    if (row.path.endsWith(".family")) out["font-family"] = `var(${row.variable})`;
    if (row.path.endsWith(".size")) out["font-size"] = `var(${row.variable})`;
    if (row.path.endsWith(".weight")) out["font-weight"] = `var(${row.variable})`;
    if (row.path.endsWith(".tracking")) out["letter-spacing"] = `var(${row.variable})`;
    if (row.path.endsWith(".leading")) out["line-height"] = `var(${row.variable})`;
  }
  return out;
}

export default function TypeStylesPage() {
  const groups = createMemo(() => styleGroups(activeTree()));
  const [selectedName, setSelectedName] = createSignal<string>("display");
  const selectedGroup = createMemo(
    () => groups().find((g) => g.name === selectedName()) ?? groups()[0],
  );
  return (
    <ConcernPage title="Type">
      <Section
        title="Styles"
        fact={`${groups().length} styles`}
        info="Named type styles: the theme's complete tuples, spent with type-<name>. Select any style to inspect and edit its family, size, weight, tracking, and leading."
      >
        <div class="grid min-w-0 items-start gap-4 lg:grid-cols-2">
          <div class="stack-sm min-w-0">
            <ul class="flex min-w-0 flex-col gap-2">
              <For each={groups()}>
                {(group) => {
                  const active = () => selectedGroup()?.name === group.name;
                  return (
                    <li class="min-w-0">
                      <button
                        type="button"
                        class="bare flex min-w-0 w-full flex-col items-stretch gap-2 overflow-hidden rounded-lg border bg-surface-raised p-3 text-left transition-colors hover:border-primary"
                        classList={{
                          "border-primary border-2": active(),
                        }}
                        aria-pressed={active()}
                        onClick={() => setSelectedName(group.name)}
                      >
                        <span class="row-sm flex-wrap items-center justify-between gap-2">
                          <span class="row-sm items-center gap-2">
                            <span class="type-label">{group.name}</span>
                            <code>type-{group.name}</code>
                          </span>
                          <Show when={group.owned}>
                            <Badge tone="info">owned</Badge>
                          </Show>
                        </span>
                        <span
                          data-studio-specimen=""
                          class="block w-full truncate rounded-sm bg-surface px-2 py-1"
                          style={styleSpecimen(group)}
                        >
                          {SENTENCE}
                        </span>
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
            <AddStyle onAdded={(added) => setSelectedName(added)} />
          </div>
          <Show when={selectedGroup()}>
            {(group) => (
              <div class="min-w-0 lg:sticky lg:top-4">
                <StyleCard group={group()} />
              </div>
            )}
          </Show>
        </div>
      </Section>

      <Section
        title="Elements"
        fact={`${elementTargets(activeTree()).length} elements`}
        info="Which style each HTML element reads."
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
    </ConcernPage>
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
    <div class="stack-sm min-w-0 rounded-lg border bg-surface-raised p-4">
      <div class="row-sm flex-wrap items-center justify-between gap-2">
        <div class="row-sm flex-wrap items-center gap-2">
          <span class="type-title">{name()}</span>
          <Show when={props.group.owned}>
            <span title="Owned styles stay: every theme keeps them, so there is nothing to trim.">
              <Badge tone="info">owned</Badge>
            </span>
          </Show>
          <code>type-{name()}</code>
          <code>font.style.{name()}</code>
        </div>
        <Show when={!props.group.owned}>
          <button
            type="button"
            class="bare type-caption-emphasized text-primary"
            title={`Trim ${name()} from the theme`}
            aria-label={`Trim ${name()} from the theme`}
            onClick={trim}
          >
            trim
          </button>
        </Show>
      </div>
      <div data-studio-specimen="" class="min-w-0 overflow-hidden rounded-md border bg-surface p-3">
        <p class="truncate" style={styleSpecimen(props.group)}>
          {SENTENCE}
        </p>
      </div>
      <ul class="flex flex-col gap-2">
        <For each={props.group.fields}>
          {(row) => (
            <li class="split flex-wrap gap-2 border-b py-2 last:border-b-0">
              <span class="row-sm">
                <span class="w-20 shrink-0 capitalize type-label">
                  {row.path.split(".").pop()}
                </span>
                <code>{row.path}</code>
              </span>
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
    </div>
  );
}

/**
 * A name and a tuple: the custom style the theme gains.
 *
 * The tuple starts as the body's — a new style reads like body until the
 * author edits it, so it is spendable the moment it lands. The name must be
 * new: an existing name is said, not written.
 */
function AddStyle(props: { onAdded?: (name: string) => void }) {
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
    if (setThemeText(next, [`font.style.${trimmed}`])) {
      setName("");
      props.onAdded?.(trimmed);
    }
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
          <StudioSelect
            label={`Style <${props.element}> reads`}
            value={attached() ?? ""}
            items={names().map((style) => ({ value: style, label: style }))}
            onPick={(value) => repoint(value)}
          />
          <code>type-{attached() ?? "—"}</code>
        </div>
      </td>
    </tr>
  );
}

