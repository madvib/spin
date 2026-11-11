/**
 * Studio Overview (/): Project dashboard summarizing the active Brand,
 * the six Token Groups (Color, Type, Spacing, Style, Motion, Icons),
 * Components (Primitives & Machines), and Diagnostics health.
 */

import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { toHex } from "@spinjs/theme";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { inDrawer } from "../lib/host.ts";
import {
  activeBrand,
  activeMode,
  activeName,
  activeTree,
  library,
  project,
  projectFailure,
  refetchBrand,
  refetchProject,
  refetchThemes,
  registerMarkup,
  setActiveName,
  themeSummaries,
  themeText,
} from "../lib/store.ts";
import {
  initProject,
  listFacets,
  problemText,
} from "../lib/themes.ts";
import { Badge } from "../components/Concern.tsx";
import { groupTokens, toPx } from "../lib/tokens.ts";
import type { TokenRow } from "../lib/tokens.ts";
import { authoredLeafCount } from "../lib/theme.ts";
import { checks } from "../lib/floors.ts";
import {
  elementSamples,
  faceSpecimens,
  paletteChips,
  spaceSteps,
  surfaceSteps,
} from "../lib/overview.ts";
import type { Chip, ElementSample, Face } from "../lib/overview.ts";
import { DISPLAY, PANGRAM } from "../lib/specimen-copy.ts";
import type { RoutePath } from "../lib/routes.ts";

const BRAND_LAYER_SLOTS: readonly {
  readonly file: string;
  readonly label: string;
  readonly href: RoutePath | "/tokens/colors" | "/tokens/spacing" | "/tokens/type/styles";
}[] = [
  { file: "tokens.json", label: "Identity & roles", href: "/tokens/colors" },
  { file: "reference.json", label: "Reference scales", href: "/tokens/spacing" },
  { file: "elements.json", label: "HTML elements", href: "/tokens/type/styles" },
  { file: "primitives/*.json", label: "Primitives", href: "/components" },
];

export default function OverviewPage() {
  const summaries = createMemo(() => themeSummaries());
  const active = createMemo(() =>
    summaries().find((summary) => summary.name === activeName())
  );
  const brand = () => activeBrand();
  const [facets] = createResource(listFacets);
  const layers = () => Object.entries(brand()?.layers ?? {});
  const themeIssues = createMemo(() => checks(themeText()));

  const currentExtends = createMemo((): string | undefined => {
    const fromBrand = brand()?.designLanguage;
    if (fromBrand !== undefined) return fromBrand;
    try {
      const parsed = JSON.parse(themeText()) as Record<string, unknown>;
      return typeof parsed["$extends"] === "string"
        ? parsed["$extends"]
        : undefined;
    } catch {
      return undefined;
    }
  });

  const firstRun = createMemo(() => {
    const report = project();
    return report !== undefined && !report.spin ? report : undefined;
  });

  const palette = createMemo(() => paletteChips(themeText(), activeMode()));
  const acting = () =>
    palette().find((chip) => chip.path === "color.primary")?.value;
  const ladder = createMemo(() => surfaceSteps(themeText(), activeMode()));
  const faces = createMemo(() => faceSpecimens(themeText(), activeMode()));
  const radius = createMemo(() =>
    groupTokens(activeTree(), [["radius"]], activeMode())
  );
  const shadow = createMemo(() =>
    groupTokens(activeTree(), [["shadow"]], activeMode())
  );
  const space = createMemo(() => spaceSteps(themeText(), activeMode()));
  const durations = createMemo(() =>
    groupTokens(activeTree(), [["motion", "duration"]], activeMode()).filter(
      (row) => row.value !== "",
    )
  );
  const iconSteps = createMemo(() =>
    groupTokens(activeTree(), [["icon"]], activeMode())
  );
  const samples = createMemo(() => elementSamples(library() ?? []));

  const primitiveCount = createMemo(
    () => (library() ?? []).filter((c) => c.kind === "primitive").length,
  );
  const machineCount = createMemo(
    () => (library() ?? []).filter((c) => c.kind === "machine").length,
  );

  createEffect(() => {
    const markup = samples()
      .map((sample) => sample.row.html)
      .concat(faces().map((face) => `<span class="${face.paint}"></span>`))
      .join("\n");
    registerMarkup(markup);
  });
  onCleanup(() => registerMarkup(""));

  const [projectProblem, setProjectProblem] = createSignal<string | null>(null);
  async function init(): Promise<void> {
    const report = project();
    if (report === undefined) return;
    setProjectProblem(null);
    try {
      const made = await initProject(report.root, "default", "minimal");
      if (made.error !== null) {
        setProjectProblem(made.error);
        return;
      }
      refetchProject();
      refetchThemes();
      refetchProjectThemes();
      refetchBrand();
      setActiveName("default");
    } catch (err) {
      setProjectProblem(problemText(err));
    }
  }

  return (
    <div
      class={inDrawer()
        ? "drawer-flow bg-surface p-4 sm:p-6"
        : "drawer-scroll overflow-y-auto bg-surface p-4 sm:p-6"}
    >
      <div class="mx-auto stack max-w-[72rem]">
        <header class="split flex-wrap">
          <div class="stack-xs">
            <h1>Overview</h1>
            <p class="text-muted">
              Brand architecture, token groups, component library, and static verification.
            </p>
          </div>
          <div class="row-sm">
            <A href="/brand" role="button" class="secondary s-sm">
              Manage brand
            </A>
            <A href="/init" role="button" class="primary s-sm">
              New brand
            </A>
          </div>
        </header>

        <Show when={projectFailure()}>
          {(failure) => (
            <section class="stack-sm panel" aria-label="No project">
              <h2>There is no project here</h2>
              <p class="text-muted">
                The studio edits a project on disk, and the daemon it is talking
                to is not serving one: {problemText(failure())}
              </p>
            </section>
          )}
        </Show>

        <Show when={firstRun()}>
          {(report) => (
            <section class="stack-sm panel" aria-label="First run">
              <h2>This folder is not a spin project yet</h2>
              <p class="text-muted">
                A project is a folder with a <code>spin/&lt;brand&gt;/</code>{" "}
                directory in it. The daemon is serving{" "}
                <code class="break-all">{report().root}</code>.
              </p>
              <div class="row-sm">
                <A href="/init" role="button" class="primary">
                  Create your brand
                </A>
                <button
                  type="button"
                  class="secondary"
                  onClick={() => void init()}
                >
                  Scaffold default brand
                </button>
              </div>
              <Show when={projectProblem() !== null}>
                <p class="text-semantic-error" role="alert">
                  {projectProblem()}
                </p>
              </Show>
            </section>
          )}
        </Show>

        <section
          aria-label="Active Brand"
          class="grid gap-4 rounded-lg border bg-surface-raised p-4 grid-cols-1"
          classList={{
            "lg:grid-cols-12": !inDrawer(),
          }}
        >
          <div
            class="stack-sm justify-between"
            classList={{
              "lg:col-span-5": !inDrawer(),
            }}
          >
            <div class="stack-xs">
              <div class="row-sm flex-wrap">
                <span class="type-overline uppercase text-muted">Brand</span>
                <Show when={currentExtends()}>
                  {(lang) => <Badge tone="primary">extends {lang()}</Badge>}
                </Show>
                <Badge tone="info">
                  {(facets()?.length ?? 0)}{" "}
                  {(facets()?.length ?? 0) === 1 ? "facet" : "facets"}
                </Badge>
              </div>
              <div class="split">
                <h2>
                  <A href="/brand" class="no-underline hover:underline">
                    {brand()?.name ?? activeName()}
                  </A>
                </h2>
                <code>
                  {brand() !== undefined
                    ? `spin/${brand()!.name}/`
                    : active()?.file ?? "design language"}
                </code>
              </div>
              <span class="type-caption text-muted">
                {active()?.tokens ?? 0}{" "}
                {(active()?.tokens ?? 0) === 1
                  ? "authored token"
                  : "authored tokens"}{" "}
                · {active()?.composed ?? 0} composed across{" "}
                {(active()?.swatches ?? []).length || 2} modes
              </span>
            </div>

            <Show
              when={(active()?.swatches ?? []).some(
                (group) => group.chips.length > 0,
              )}
            >
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <For
                  each={(active()?.swatches ?? []).filter(
                    (group) => group.chips.length > 0,
                  )}
                >
                  {(group) => (
                    <div class="flex items-center gap-2 rounded-md border bg-surface px-2 py-1">
                      <span class="w-10 shrink-0 type-caption-emphasized uppercase text-muted">
                        {group.mode}
                      </span>
                      <div class="flex h-4 flex-1 overflow-hidden rounded-sm border">
                        <For each={group.chips}>
                          {(chip) => (
                            <span
                              class="flex-1"
                              style={{ background: chip.value }}
                              title={`${chip.label} ${chip.value}`}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div
            class="grid gap-2 grid-cols-1"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
              "lg:col-span-7": !inDrawer(),
            }}
          >
            <For each={BRAND_LAYER_SLOTS}>
              {(slot) => {
                const matching = () =>
                  layers().filter(([file]) =>
                    slot.file === "primitives/*.json"
                      ? file.startsWith("primitives/")
                      : file === slot.file
                  );
                const authoredCount = () =>
                  matching().reduce(
                    (sum, [, doc]) =>
                      sum + authoredLeafCount(JSON.stringify(doc)),
                    0,
                  );
                return (
                  <A
                    href={slot.href}
                    class="flex flex-col justify-between gap-1 rounded-md border bg-surface p-3 no-underline transition-colors hover:border-strong"
                  >
                    <div class="split">
                      <code>{slot.file}</code>
                      <Badge tone={matching().length > 0 ? "primary" : "info"}>
                        {matching().length > 0
                          ? `${authoredCount()} authored`
                          : `via ${currentExtends() ?? "base"}`}
                      </Badge>
                    </div>
                    <span class="type-caption text-muted">{slot.label}</span>
                  </A>
                );
              }}
            </For>
          </div>
        </section>

        <section class="stack-sm" aria-label="Token Groups">
          <div class="split">
            <h2>Tokens</h2>
            <span class="type-caption text-muted">
              6 groups · resolved from <code>spin/{brand()?.name ?? activeName()}/</code>
            </span>
          </div>
          <div
            class="grid gap-3 grid-cols-1"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
              "xl:grid-cols-3": !inDrawer(),
            }}
          >
            <ColorGroupCard chips={palette()} steps={ladder()} />
            <TypeCard faces={faces()} />
            <SpaceCard steps={space()} fill={acting()} />
            <ShapeCard radius={radius()} shadow={shadow()} />
            <MotionCard durations={durations()} fill={acting()} />
            <IconsGroupCard steps={iconSteps()} />
          </div>
        </section>

        <section class="stack-sm" aria-label="Components and Diagnostics">
          <div
            class="grid gap-3 grid-cols-1"
            classList={{
              "sm:grid-cols-2": !inDrawer(),
            }}
          >
            <ComponentsCard
              samples={samples()}
              primitives={primitiveCount()}
              machines={machineCount()}
            />
            <DiagnosticsCard issueCount={themeIssues().length} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ConcernCard(props: {
  path:
    | RoutePath
    | "/tokens/colors"
    | "/tokens/type"
    | "/tokens/type/styles"
    | "/tokens/icons"
    | "/tokens/motion"
    | "/tokens/spacing"
    | "/tokens/style";
  title: string;
  meta?: string;
  children?: JSX.Element;
}) {
  return (
    <article class="flex flex-col justify-between gap-3 rounded-lg border bg-surface-raised p-4">
      <div class="split">
        <h3>
          <A href={props.path} class="row-sm no-underline hover:underline">
            <span class="min-w-0">{props.title}</span>
            <span
              class="inline-block icon-sm i-lucide-arrow-up-right shrink-0 text-muted"
              aria-hidden="true"
            />
          </A>
        </h3>
        <Show when={props.meta}>
          {(m) => <span class="type-caption text-muted">{m()}</span>}
        </Show>
      </div>
      <div class="flex min-h-0 flex-1 flex-col justify-end">{props.children}</div>
    </article>
  );
}

function ColorGroupCard(props: {
  chips: readonly Chip[];
  steps: readonly Chip[];
}) {
  const recessed = () =>
    props.steps.find((step) => step.path === "color.surface-sunken");
  const page = () => props.steps.find((step) => step.path === "color.surface");
  const raised = () =>
    props.steps.find((step) => step.path === "color.surface-raised");

  return (
    <ConcernCard
      path="/tokens/colors"
      title="Color"
      meta={`${props.chips.length} roles · surfaces`}
    >
      <Show
        when={props.chips.length > 0}
        fallback={<p class="text-muted">No palette roles declared yet.</p>}
      >
        <div class="stack-xs">
          <div class="flex h-8 overflow-hidden rounded-md border">
            <For each={props.chips}>
              {(chip) => (
                <div
                  class="flex-1"
                  style={{ background: chip.value }}
                  title={`${chip.label}: ${toHex(chip.value) ?? chip.value}`}
                />
              )}
            </For>
          </div>
          <Show when={props.steps.length > 0}>
            <div class="grid grid-cols-3 gap-2">
              <For
                each={[
                  { label: "sunken", chip: recessed() },
                  { label: "surface", chip: page() },
                  { label: "raised", chip: raised() },
                ]}
              >
                {(item) => (
                  <div
                    class="flex flex-col items-start rounded-sm border px-2 py-1"
                    style={{
                      background: item.chip?.value ?? "transparent",
                      color: item.chip?.ink ?? "inherit",
                    }}
                  >
                    <span class="type-caption">{item.label}</span>
                    <span class="type-code">
                      {toHex(item.chip?.value ?? "") ?? ""}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </ConcernCard>
  );
}

const SPECIMEN: Record<string, string> = {
  heading: DISPLAY,
  mono: "0123456789idarwin",
  body: PANGRAM,
  sans: PANGRAM,
  serif: PANGRAM,
};

function TypeCard(props: { faces: readonly Face[] }) {
  return (
    <ConcernCard
      path="/tokens/type/styles"
      title="Type"
      meta="13 styles · faces · ramps"
    >
      <Show
        when={props.faces.length > 0}
        fallback={<p class="text-muted">No font families declared yet.</p>}
      >
        <div class="flex flex-col gap-1">
          <For each={props.faces.slice(0, 3)}>
            {(face) => (
              <div class="split rounded-sm border bg-surface px-2 py-1">
                <code class="shrink-0">{face.slot}</code>
                <span class={`${face.paint} truncate text-right`}>
                  {SPECIMEN[face.slot] ?? PANGRAM}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </ConcernCard>
  );
}

function ShapeCard(props: {
  radius: readonly TokenRow[];
  shadow: readonly TokenRow[];
}) {
  const empty = () => props.radius.length + props.shadow.length === 0;
  return (
    <ConcernCard
      path="/tokens/style"
      title="Style"
      meta={`${props.radius.length} radii · ${props.shadow.length} shadows`}
    >
      <Show
        when={!empty()}
        fallback={
          <p class="text-muted">No radius or shadow steps declared yet.</p>
        }
      >
        <div class="stack-xs">
          <div class="flex items-center gap-2 rounded-md bg-surface-sunken p-2">
            <For each={props.radius.slice(0, 5)}>
              {(row) => (
                <div class="flex flex-1 flex-col items-center gap-1">
                  <div
                    class="h-7 w-full border bg-surface-raised"
                    style={{ "border-radius": `var(${row.variable})` }}
                    title={`${row.path}: ${row.value}`}
                  />
                  <code class="truncate">{row.path.split(".").pop()}</code>
                </div>
              )}
            </For>
          </div>
          <Show when={props.shadow.length > 0}>
            <div class="split type-caption text-muted">
              <span>Elevation steps</span>
              <div class="row-sm">
                <For each={props.shadow}>
                  {(row) => <code>{row.path.split(".").pop()}</code>}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </ConcernCard>
  );
}

function SpaceCard(props: {
  steps: readonly TokenRow[];
  fill: string | undefined;
}) {
  const longest = () =>
    Math.max(1, ...props.steps.map((row) => toPx(row.value) ?? 0));

  return (
    <ConcernCard
      path="/tokens/spacing"
      title="Spacing"
      meta={`${props.steps.length} scale steps`}
    >
      <Show
        when={props.steps.length > 0}
        fallback={<p class="text-muted">No spacing steps declared yet.</p>}
      >
        <div class="stack-xs">
          <div class="flex h-14 items-end gap-2 rounded-md bg-surface-sunken p-2">
            <For each={props.steps}>
              {(row) => (
                <div
                  class="flex-1 rounded-sm"
                  style={{
                    background: props.fill,
                    height: `${Math.max(12, ((toPx(row.value) ?? 0) / longest()) * 100)}%`,
                  }}
                  title={`${row.path}: ${row.value}`}
                />
              )}
            </For>
          </div>
          <div class="flex justify-between">
            <For each={props.steps}>
              {(row) => <code>{row.path.split(".").pop()}</code>}
            </For>
          </div>
        </div>
      </Show>
    </ConcernCard>
  );
}

function MotionCard(props: {
  durations: readonly TokenRow[];
  fill: string | undefined;
}) {
  const [run, setRun] = createSignal(0);

  return (
    <ConcernCard
      path="/tokens/motion"
      title="Motion"
      meta={`${props.durations.length} durations · easings`}
    >
      <Show
        when={props.durations.length > 0}
        fallback={<p class="text-muted">No motion durations declared yet.</p>}
      >
        <For each={[run()]}>
          {() => (
            <button
              type="button"
              class="bare flex w-full flex-col items-stretch gap-1 rounded-md p-1 text-left"
              title="Replay duration curves"
              onClick={() => setRun(run() + 1)}
            >
              <For each={props.durations.slice(0, 4)}>
                {(row) => (
                  <div class="flex items-center gap-2">
                    <code class="w-12 shrink-0 truncate">
                      {row.path.split(".").pop()}
                    </code>
                    <div class="h-5 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
                      <div
                        class="flex h-full w-14 items-center rounded-sm px-2 animate-fade-in"
                        style={{
                          background: props.fill,
                          "animation-duration": row.value,
                          "animation-fill-mode": "both",
                        }}
                      >
                        <code class="shrink-0">{row.value}</code>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </button>
          )}
        </For>
      </Show>
    </ConcernCard>
  );
}

function IconsGroupCard(props: { steps: readonly TokenRow[] }) {
  return (
    <ConcernCard
      path="/tokens/icons"
      title="Icons"
      meta={`${props.steps.length} sizes · vendored SVGs`}
    >
      <div class="stack-xs">
        <div class="flex items-center justify-between rounded-md border bg-surface px-3 py-2">
          <div class="row-sm">
            <span class="inline-block icon-md i-lucide-sparkles text-muted" aria-hidden="true" />
            <span class="inline-block icon-md i-lucide-palette text-muted" aria-hidden="true" />
            <span class="inline-block icon-md i-lucide-type text-muted" aria-hidden="true" />
            <span class="inline-block icon-md i-lucide-layers text-muted" aria-hidden="true" />
            <span class="inline-block icon-md i-lucide-shield-check text-muted" aria-hidden="true" />
          </div>
          <span class="type-caption text-muted">Lucide</span>
        </div>
        <Show when={props.steps.length > 0}>
          <div class="flex flex-wrap justify-between gap-2">
            <For each={props.steps.slice(0, 3)}>
              {(row) => (
                <span class="type-caption text-muted">
                  <code>{row.path.split(".").pop()}</code> {row.value}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>
    </ConcernCard>
  );
}

function ComponentsCard(props: {
  samples: readonly ElementSample[];
  primitives: number;
  machines: number;
}) {
  return (
    <ConcernCard
      path="/components"
      title="Components"
      meta={`${props.primitives} primitives · ${props.machines} machines`}
    >
      <div class="stack-xs">
        <Show
          when={props.samples.length > 0}
          fallback={<p class="text-muted">Loading component library…</p>}
        >
          <For each={props.samples.slice(0, 1)}>
            {(sample) => (
              <div
                class="flex flex-wrap items-center gap-2 rounded-md border bg-surface px-3 py-2"
                innerHTML={sample.row.html}
              />
            )}
          </For>
        </Show>
        <div class="split type-caption text-muted">
          <A href="/components?kind=primitive">
            Browse {props.primitives} CSS primitives →
          </A>
          <A href="/components?kind=machine">
            Browse {props.machines} statechart machines →
          </A>
        </div>
      </div>
    </ConcernCard>
  );
}

function DiagnosticsCard(props: { issueCount: number }) {
  return (
    <ConcernCard
      path="/diagnostics"
      title="Diagnostics"
      meta={props.issueCount === 0 ? "All checks passing" : `${props.issueCount} theme issues`}
    >
      <div class="stack-xs">
        <div class="split rounded-md border bg-surface px-3 py-2">
          <span class="type-caption text-muted">
            WCAG contrast floors &amp; scale monotonic checks
          </span>
          <Badge tone={props.issueCount === 0 ? "primary" : "warning"}>
            {props.issueCount === 0
              ? "Passing"
              : `${props.issueCount} ${props.issueCount === 1 ? "issue" : "issues"}`}
          </Badge>
        </div>
        <div class="split type-caption text-muted">
          <span>Static source rules (<code>spin lint</code>)</span>
          <A href="/diagnostics">Inspect diagnostics →</A>
        </div>
      </div>
    </ConcernCard>
  );
}
