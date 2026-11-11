/** Type ramps — the scales named styles are built from. */

import { createMemo, createSignal, For, Show } from "solid-js";
import { activeMode, activeTree, noteRefusal } from "../../lib/store.ts";
import {
  groupTokens,
  scaleRampEdits,
  type TokenRow,
} from "../../lib/tokens.ts";
import {
  editToken,
  editTokens,
} from "../../lib/editing.ts";
import { scaleValue } from "../../lib/scale.ts";
import ValueInput from "../../components/demos/ValueInput.tsx";
import {
  ConcernPage,
  Frame,
  Section,
  TokenLine,
} from "../../components/Concern.tsx";
import { RAMPS, stepName } from "./type-shared.ts";

export default function TypeRampsPage() {
  return (
    <ConcernPage title="Type">
      <For each={RAMPS}>
        {(ramp) => <RampSection group={ramp.group} title={ramp.title} info={ramp.info} />}
      </For>
    </ConcernPage>
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
          <ul class="flex flex-col">
            <For each={rows()}>
              {(row) => (
                <TokenLine
                  path={row.path}
                  specimen={
                    <span
                      data-studio-specimen=""
                      class="min-w-0 flex-1 truncate px-2"
                      style={
                        props.group === "font.size"
                          ? { "font-size": `var(${row.variable})` }
                          : props.group === "font.weight"
                          ? { "font-weight": `var(${row.variable})` }
                          : props.group === "font.tracking"
                          ? { "letter-spacing": `var(${row.variable})` }
                          : { "line-height": `var(${row.variable})` }
                      }
                    >
                      {props.group === "font.tracking" ? "TRACKING" : "AaBbCc"}
                    </span>
                  }
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
