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

import {
  createMemo,
  createResource,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
import { Badge, ConcernPage, Frame, Section } from "../components/Concern.tsx";
import {
  ClassOrders,
  FindingGroups,
  Repetitions,
} from "../components/Findings.tsx";
import { checks } from "../lib/floors.ts";
import { activeName, themeText } from "../lib/store.ts";
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
  const themeChecks = createMemo(() => checks(themeText()));

  return (
    <ConcernPage
      title="Findings"
      note="Theme checks and source-code lints for this project. Fixes update the theme or source file directly."
    >
      <Show when={notice() !== null}>
        <div
          role="status"
          class="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
        >
          {notice()}
        </div>
      </Show>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Frame class="stack-xs p-3">
          <div class="split">
            <span class="text-xs font-medium text-text-muted">
              Theme checks
            </span>
            <Badge
              tone={themeChecks().length === 0 ? "primary" : "warning"}
            >
              {themeChecks().length === 0
                ? "ok"
                : `${themeChecks().length} issues`}
            </Badge>
          </div>
          <p class="m-0 text-sm font-medium">{activeName()}</p>
        </Frame>
        <Frame class="stack-xs p-3">
          <div class="split">
            <span class="text-xs font-medium text-text-muted">
              Source lints
            </span>
            <Badge tone={findings().length === 0 ? "primary" : "warning"}>
              {findings().length === 0 ? "clean" : `${findings().length} rules`}
            </Badge>
          </div>
          <p class="m-0 text-sm font-medium">
            {report()?.files ?? 0} files scanned
          </p>
        </Frame>
        <Frame class="stack-xs p-3">
          <div class="split">
            <span class="text-xs font-medium text-text-muted">Repetition</span>
            <Badge tone="info">{repetition().length}</Badge>
          </div>
          <p class="m-0 text-sm font-medium">
            repeated class lists
          </p>
        </Frame>
        <Frame class="stack-xs p-3">
          <div class="split">
            <span class="text-xs font-medium text-text-muted">
              Class order
            </span>
            <Badge tone="info">{order().length}</Badge>
          </div>
          <p class="m-0 text-sm font-medium">files out of order</p>
        </Frame>
      </div>

      <Section
        title="The lints"
        fact={`${report()?.files ?? 0} files`}
        note="Invalid or conflicting utility classes detected across project source files."
      >
        <Frame class="p-4">
          <Switch>
            <Match when={report() === undefined}>
              <p class="m-0 text-sm text-text-muted">reading the source…</p>
            </Match>
            <Match when={report.error !== undefined}>
              <p class="m-0 text-sm text-text-muted">
                The findings could not be read. Is the API running?
              </p>
            </Match>
            <Match when={findings().length === 0}>
              <p class="m-0 text-sm text-text-muted">
                Nothing to report: every class in the project's source is one
                the theme can produce, and no class fights a decision the theme
                has already made.
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
            <p class="m-0 text-sm text-text-muted">
              {report()?.unreadable.join(", ")} could not be read.
            </p>
          </Show>
        </Frame>
      </Section>

      <Section
        title="Repetition"
        fact={`${repetition().length}`}
        note="Repeated utility compositions that can be promoted to named shortcuts in your project config."
      >
        <Frame class="p-4">
          <Switch>
            <Match when={corpus() === undefined}>
              <p class="m-0 text-sm text-text-muted">reading the source…</p>
            </Match>
            <Match when={repetition().length === 0}>
              <p class="m-0 text-sm text-text-muted">
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
        </Frame>
      </Section>

      <Section
        title="Class order"
        fact={`${order().length}`}
        note="Source files whose utility classes can be reordered to match canonical stylesheet order."
      >
        <Frame class="p-4">
          <Switch>
            <Match when={corpus() === undefined}>
              <p class="m-0 text-sm text-text-muted">reading the source…</p>
            </Match>
            <Match when={order().length === 0}>
              <p class="m-0 text-sm text-text-muted">
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
        </Frame>
      </Section>
    </ConcernPage>
  );
}
