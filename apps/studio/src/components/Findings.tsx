/**
 * The findings, as the studio draws them.
 *
 * The page is about what the lints say about the project's own source, so
 * the drawings are about reading a finding and acting on it:
 *
 *   - a group is one RULE's findings. The rule says what it is for, and
 *     the findings under it are its instances — the same problem, in five
 *     files, is one thing to read and one kind of edit to apply.
 *   - a finding reads as the rule's own sentence, then as what to do about
 *     it. A finding the rule can fix offers the fix; a finding it cannot
 *     says so, and says what to do instead, because a complaint with no
 *     way out is not an offer.
 *   - the corpus's two facts are facts, not faults, and they are drawn
 *     apart from the findings: a composition the source repeats is a
 *     composition the project may declare, and a class list in the wrong
 *     order is a list that reads backwards.
 *
 * Nothing here decides anything. The rules own the findings, the service
 * owns the files, and this file draws what they say.
 */

import { createSignal, For, Show } from "solid-js";
import { Marker } from "./Concern.tsx";
import type {
  ClassOrderFile,
  Finding,
  Repetition,
  RuleGroup,
} from "../lib/findings.ts";

/**
 * The findings, grouped by the rule that said them.
 */
export function FindingGroups(props: {
  groups: readonly RuleGroup[];
  /** Applies one finding's edit. */
  onFix: (finding: Finding) => void;
  /** Whether a fix is in flight. */
  busy: boolean;
}) {
  return (
    <div class="stack-lg">
      <For each={props.groups}>
        {(group) => (
          <section class="stack-sm" aria-label={group.ruleId}>
            <div class="split">
              <h2 class="row-sm">
                <Marker />
                <span class="min-w-0">{group.title}</span>
              </h2>
              <span class="shrink-0 type-caption text-text-muted">
                {group.findings.length}
              </span>
            </div>
            <ul class="stack-sm">
              <For each={group.findings}>
                {(finding) => (
                  <FindingRow
                    finding={finding}
                    busy={props.busy}
                    onFix={() => props.onFix(finding)}
                  />
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
    </div>
  );
}

/**
 * One finding.
 *
 * The file and the place in it are a fact, and they are written as one
 * thing — `src/app.tsx:12:4` — because that is how a reader names a place
 * in a file. The message is the rule's own sentence, and the way out is
 * under it.
 */
export function FindingRow(props: {
  finding: Finding;
  busy: boolean;
  onFix: () => void;
}) {
  return (
    <li class="stack-sm border-b border-border py-3 last:border-b-0">
      <div class="row-sm flex-wrap gap-x-3 gap-y-1">
        <code class="min-w-0 truncate">
          {props.finding.file}:{props.finding.line}:{props.finding.column}
        </code>
        <span class="shrink-0 type-caption uppercase text-text-muted">
          {props.finding.severity}
        </span>
      </div>
      <p>{props.finding.message}</p>
      <Show
        when={props.finding.remedy}
        fallback={
          <p class="text-text-muted">
            Nothing to apply — the rule offers no edit for this one.
          </p>
        }
      >
        {(remedy) => (
          <Show
            when={props.finding.fixable}
            fallback={
              <p class="text-text-muted">
                No automatic fix — {remedy()}
              </p>
            }
          >
            <div class="row-sm">
              <button
                type="button"
                class="bare s-sm flex min-h-0 shrink-0 items-center justify-start gap-2 text-left hover:bg-surface-sunken"
                title={remedy()}
                disabled={props.busy}
                onClick={() => props.onFix()}
              >
                {remedy()}
              </button>
            </div>
          </Show>
        )}
      </Show>
    </li>
  );
}

/**
 * The compositions the source repeats.
 *
 * Each row carries the classes as the source writes them, how often, and
 * where — and the name a shortcut for them could take. The name is an
 * input: the composition is the author's, and so is the word for it.
 */
export function Repetitions(props: {
  repetition: readonly Repetition[];
  /** Declares a shortcut for one composition. */
  onDeclare: (name: string, classes: readonly string[]) => void;
  /** Whether a declaration is in flight. */
  busy: boolean;
}) {
  return (
    <div class="stack-sm">
      <For each={props.repetition}>
        {(row) => (
          <RepetitionRow
            row={row}
            busy={props.busy}
            onDeclare={props.onDeclare}
          />
        )}
      </For>
    </div>
  );
}

/**
 * One composition, and the shortcut it could become.
 */
function RepetitionRow(props: {
  row: Repetition;
  busy: boolean;
  onDeclare: (name: string, classes: readonly string[]) => void;
}) {
  const [name, setName] = createSignal(props.row.suggested);
  return (
    <li class="stack-sm border-b border-border py-3 last:border-b-0">
      <div class="stack-sm min-w-0">
        <code class="block break-words">
          {props.row.classes.join(" ")}
        </code>
        <span class="type-caption text-text-muted">
          {props.row.count} times · {props.row.files.join(", ")}
        </span>
      </div>
      <div class="row-sm flex-wrap gap-2">
        <input
          type="text"
          class="min-w-0 flex-1"
          value={name()}
          aria-label={`The name of the shortcut for ${
            props.row.classes.join(" ")
          }`}
          onInput={(event) => setName(event.currentTarget.value)}
        />
        <button
          type="button"
          class="s-sm shrink-0"
          title={`Declare ${name()} as a shortcut for ${
            props.row.classes.join(" ")
          }`}
          disabled={props.busy || name().trim() === ""}
          onClick={() => props.onDeclare(name().trim(), props.row.classes)}
        >
          Make a shortcut
        </button>
      </div>
    </li>
  );
}

/**
 * The class lists that are not in the order the sheet writes them.
 *
 * A file is the unit: the classes in a file are read together, and the
 * order the sheet writes them in is what makes the last class in a list
 * the last class in the cascade.
 */
export function ClassOrders(props: {
  order: readonly ClassOrderFile[];
  /** Writes one file's class lists in order. */
  onOrder: (file: ClassOrderFile) => void;
  /** Whether a write is in flight. */
  busy: boolean;
}) {
  return (
    <div class="stack-sm">
      <For each={props.order}>
        {(file) => (
          <li class="stack-sm border-b border-border py-3 last:border-b-0">
            <div class="split">
              <code class="min-w-0 truncate">{file.file}</code>
              <button
                type="button"
                class="s-sm shrink-0"
                title={`Write the class lists in ${file.file} in the order the stylesheet writes them`}
                disabled={props.busy}
                onClick={() => props.onOrder(file)}
              >
                Write them in order
              </button>
            </div>
            <ul class="stack-sm">
              <For each={file.attributes}>
                {(attribute) => (
                  <li>
                    <span class="text-text-muted">
                      {attribute.classes.join(" ")}
                    </span>
                    <span aria-hidden="true" class="text-text-muted">→</span>
                    <span>{attribute.ordered.join(" ")}</span>
                  </li>
                )}
              </For>
            </ul>
          </li>
        )}
      </For>
    </div>
  );
}
