/**
 * Findings — what the lints say about the project's own source.
 *
 * The studio is pointed at a project, and this page is the project's
 * SOURCE: the files the lints read, the findings they have about them, and
 * the two facts the corpus holds about the code as a whole.
 *
 * The findings are grouped by the rule that said them, because a rule is
 * what groups them: the same rule firing in five files is one problem with
 * five instances, and one kind of edit to apply. A file says where the
 * mess is; a rule says what is wrong, and that is the first question.
 *
 * A fix is applied on demand, and it is applied to the FILE: the daemon
 * owns the project's files, it reads the file again before it writes, and
 * the page reads the lints again afterwards. So a finding that is gone is
 * gone because the code changed — the class was dropped from the file, and
 * the file no longer says what it said.
 *
 * The corpus is beside the findings and apart from them: the compositions
 * the source repeats and the class lists that are out of order are facts
 * about the project, not faults in a file, and they are answered with what
 * to do about them — a shortcut the project declares, and a list written
 * in order.
 */

import { createResource, createSignal, Match, Show, Switch } from "solid-js";
import { ConcernPage, Section } from "../components/Concern.tsx";
import {
  ClassOrders,
  FindingGroups,
  Repetitions,
} from "../components/Findings.tsx";
import {
  type ClassOrderFile,
  declareShortcut,
  type Finding,
  fixFinding,
  loadCorpus,
  loadFindings,
  orderClasses,
} from "../lib/findings.ts";

export default function FindingsPage() {
  const [report, { refetch: refetchReport }] = createResource(loadFindings);
  const [corpus, { refetch: refetchCorpus }] = createResource(loadCorpus);
  /** What the page last did about a file. */
  const [notice, setNotice] = createSignal<string | null>(null);
  /** Whether something is being written. */
  const [busy, setBusy] = createSignal(false);

  /**
   * Applies one finding's edit.
   *
   * The fix lands in the file; the page then reads the lints again, so
   * what the reader sees is the code as it now stands and not a list with
   * one row taken out of it.
   */
  async function fix(finding: Finding): Promise<void> {
    setBusy(true);
    try {
      const outcome = await fixFinding(finding);
      if (!outcome.applied) {
        setNotice(outcome.error ?? "The fix did not land.");
        return;
      }
      setNotice(`${finding.remedy ?? "Fixed"} — ${finding.file}`);
      refetchReport();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Declares a shortcut for a composition the source repeats.
   *
   * The declaration goes into the project's own configuration — the file
   * the project's stylesheet is declared in — and the project's vocabulary
   * knows the class from then on.
   */
  async function declare(
    name: string,
    classes: readonly string[],
  ): Promise<void> {
    setBusy(true);
    try {
      const outcome = await declareShortcut(name, classes);
      if (outcome.error !== null) {
        setNotice(outcome.error);
        return;
      }
      setNotice(`${name} — declared in ${outcome.file ?? "the project"}`);
      refetchCorpus();
      refetchReport();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Writes a file's class lists in the order the stylesheet writes them.
   */
  async function writeOrder(file: ClassOrderFile): Promise<void> {
    setBusy(true);
    try {
      const outcome = await orderClasses(file.file);
      if (!outcome.applied) {
        setNotice(outcome.error ?? "The file was not rewritten.");
        return;
      }
      setNotice(`The class lists in ${file.file} are in order`);
      refetchCorpus();
    } finally {
      setBusy(false);
    }
  }

  const findings = () => report()?.groups ?? [];
  const repetition = () => corpus()?.repetition ?? [];
  const order = () => corpus()?.order ?? [];

  return (
    <ConcernPage
      title="Findings"
      note="What the lints say about this project's own source: the findings, grouped by the rule that said them, and the two facts the corpus holds about the code as a whole. A fix is applied to the file, and the lints are read again afterwards — so a finding that is gone is gone because the code changed."
    >
      <Show when={notice() !== null}>
        <div
          role="status"
          class="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text"
        >
          {notice()}
        </div>
      </Show>

      <Section
        title="The lints"
        fact={`${report()?.files ?? 0} files`}
        note="The rules are spin's own, read against this project's theme: a class the theme cannot produce, a decision the theme already made, an ink the palette does not pair. Each finding carries the rule's own sentence and the rule's own way out."
      >
        <Switch>
          <Match when={report() === undefined}>
            <p class="text-sm text-text-muted">reading the source…</p>
          </Match>
          <Match when={report.error !== undefined}>
            <p class="text-sm text-text-muted">
              The findings could not be read. Is the API running?
            </p>
          </Match>
          <Match when={findings().length === 0}>
            <p class="text-sm text-text-muted">
              Nothing to report: every class in the project's source is one the
              theme can produce, and no class fights a decision the theme has
              already made.
            </p>
          </Match>
          <Match when={findings().length > 0}>
            <FindingGroups
              groups={findings()}
              busy={busy()}
              onFix={(finding) => void fix(finding)}
            />
          </Match>
        </Switch>
        <Show when={(report()?.unreadable.length ?? 0) > 0}>
          <p class="text-sm text-text-muted">
            {report()?.unreadable.join(", ")} could not be read.
          </p>
        </Show>
      </Section>

      <Section
        title="Repetition"
        fact={`${repetition().length}`}
        note="The compositions this source writes over and over. A composition the author writes thirty times is a composition the project should declare: a shortcut is a class the project composes once, and the repetition is the argument for it."
      >
        <Switch>
          <Match when={corpus() === undefined}>
            <p class="text-sm text-text-muted">reading the source…</p>
          </Match>
          <Match when={repetition().length === 0}>
            <p class="text-sm text-text-muted">
              Nothing repeats: no composition is written twice.
            </p>
          </Match>
          <Match when={repetition().length > 0}>
            <Repetitions
              repetition={repetition()}
              busy={busy()}
              onDeclare={(name, classes) => void declare(name, classes)}
            />
          </Match>
        </Switch>
      </Section>

      <Section
        title="Class order"
        fact={`${order().length}`}
        note="Utility against utility is source-order: the last one in the stylesheet wins. A class list that is not in the stylesheet's order therefore reads backwards, and this is a formatter's answer — write the classes in the order the sheet writes them."
      >
        <Switch>
          <Match when={corpus() === undefined}>
            <p class="text-sm text-text-muted">reading the source…</p>
          </Match>
          <Match when={order().length === 0}>
            <p class="text-sm text-text-muted">
              Every class list is in the order the stylesheet writes them.
            </p>
          </Match>
          <Match when={order().length > 0}>
            <ClassOrders
              order={order()}
              busy={busy()}
              onOrder={(file) => void writeOrder(file)}
            />
          </Match>
        </Switch>
      </Section>
    </ConcernPage>
  );
}
