// Docs landing page: full-bleed orb-weaver canvas with single-stage threshold-scroll carousel, compact w-fit specimens, live component preview HoverCards, and tiny FAB.
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import type { JSX } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  COMPONENT_ICONS,
  select,
  UNIFIED_COMPONENT_GROUPS,
} from "@spinjs/components";
import { createSpinComponent } from "@spinjs/components/solid";
// Only the specimens the hover cards mount: the full example registry is a
// gallery concern, not a first-load one.
import "@spinjs/components/mode-picker/examples/basic.html";
import "@spinjs/components/theme-picker/examples/basic.html";
import "@spinjs/components/tabs/examples/basic.html";
import "@spinjs/components/menu/examples/basic.html";
import "@spinjs/components/pagination/examples/basic.html";
import "@spinjs/components/steps/examples/basic.html";
import "@spinjs/components/angle-slider/examples/basic.html";
import "@spinjs/components/date-input/examples/basic.html";
import {
  examplesFor,
  primitiveContracts,
  primitiveElements,
} from "@spinjs/preset";
import {
  Mark,
  type MarkPluckEvent,
  mode,
  ThemePicker,
  theme,
} from "@spinjs/kit";

const STAGE_COUNT = 7;
const WHEEL_THRESHOLD = 62;
const STEP_COOLDOWN_MS = 650;

const MACHINE_COUNT = UNIFIED_COMPONENT_GROUPS.reduce(
  (total, group) =>
    total + group.members.filter((member) => member.startsWith("component-")).length,
  0,
);
const ELEMENT_COUNT = primitiveElements.filter(
  (element) => primitiveContracts[element.name] !== undefined,
).length;

const PACKAGE_MANAGERS = [
  { id: "bun", command: "bun add -d @spinjs/spin && bun add @spinjs/components @spinjs/runtime" },
  { id: "npm", command: "npm i -D @spinjs/spin && npm i @spinjs/components @spinjs/runtime" },
  { id: "pnpm", command: "pnpm add -D @spinjs/spin && pnpm add @spinjs/components @spinjs/runtime" },
  { id: "yarn", command: "yarn add -D @spinjs/spin && yarn add @spinjs/components @spinjs/runtime" },
  { id: "deno", command: "deno add -D npm:@spinjs/spin && deno add npm:@spinjs/components npm:@spinjs/runtime" },
] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number]["id"];

function isPackageManager(value: string): value is PackageManager {
  return PACKAGE_MANAGERS.some((manager) => manager.id === value);
}

interface HoverTileSpec {
  readonly name: string;
  readonly href: string;
  readonly icon: string;
  readonly mountHtml: string;
  readonly meta: string;
}

function primitiveTile(name: string): HoverTileSpec {
  const example = examplesFor(name);
  const variants = primitiveContracts[name]?.variants.length ?? 0;
  return {
    name,
    href: `/components/${name}`,
    icon: COMPONENT_ICONS[name] ?? "i-lucide-box",
    mountHtml: example?.rows[0]?.html ?? `<${name}>${name}</${name}>`,
    meta: variants > 0 ? `${variants} variants` : "pure CSS",
  };
}

const MACHINE_TILES = [
  { name: "mode-picker", stem: "basic" },
  { name: "theme-picker", stem: "basic" },
  { name: "tabs", stem: "basic" },
  { name: "menu", stem: "basic" },
  { name: "pagination", stem: "basic" },
  { name: "steps", stem: "basic" },
  { name: "angle-slider", stem: "basic" },
  { name: "date-input", stem: "basic" },
] as const;

function machineTile(tile: (typeof MACHINE_TILES)[number]): HoverTileSpec {
  return {
    name: tile.name,
    href: `/components/machine-${tile.name}`,
    icon: COMPONENT_ICONS[tile.name] ?? "i-lucide-box",
    mountHtml: `<${tile.name}-${tile.stem}></${tile.name}-${tile.stem}>`,
    meta: "state machine",
  };
}

const HOVER_TILES: readonly HoverTileSpec[] = [
  ...["button", "breadcrumbs", "join", "kbd"].map(primitiveTile),
  ...MACHINE_TILES.map(machineTile),
];

interface DtcgTokenSample {
  readonly path: string;
  readonly type: string;
  readonly role: string;
  readonly sample: "color" | "font" | "radius";
  readonly sampleClass: string;
  readonly pairing: string;
}

const DTCG_SAMPLES: readonly DtcgTokenSample[] = [
  {
    path: "color.primary",
    type: "color",
    role: "Brand action fill & focus accent",
    sample: "color",
    sampleClass: "bg-primary",
    pairing: "Paired with color.on-primary (≥ 4.5:1 AA)",
  },
  {
    path: "color.surface-raised",
    type: "color",
    role: "Elevated cards, panels & overlays",
    sample: "color",
    sampleClass: "bg-surface-raised",
    pairing: "Paired with color.text & color.text-muted",
  },
  {
    path: "font.family.heading",
    type: "fontFamily",
    role: "Display & section headings",
    sample: "font",
    sampleClass: "font-heading",
    pairing: "Paired with font.family.sans body copy",
  },
  {
    path: "radius.lg",
    type: "dimension",
    role: "Container & panel corner geometry",
    sample: "radius",
    sampleClass: "rounded-lg",
    pairing: "Scales across button, card, dialog & panel",
  },
] as const;

interface OracleFinding {
  readonly id: string;
  readonly rule: string;
  readonly badCode: string;
  readonly fixedCode: string;
}

const ORACLE_FINDINGS: readonly OracleFinding[] = [
  {
    id: "hex",
    rule: "spin/no-hardcoded-color",
    badCode: 'class="bg-[#c8102e] text-white"',
    fixedCode: 'class="bg-primary text-on-primary"',
  },
  {
    id: "scale",
    rule: "spin/unknown-class",
    badCode: 'class="p-13 rounded-[7px]"',
    fixedCode: 'class="p-6 rounded-md"',
  },
  {
    id: "ink",
    rule: "spin/unpaired-ink",
    badCode: 'class="bg-primary text-text"',
    fixedCode: 'class="bg-primary text-on-primary"',
  },
] as const;

export default function Home(): JSX.Element {
  const navigate = useNavigate();

  const [stage, setStage] = createSignal(0);
  const [reweaveKey, setReweaveKey] = createSignal(0);
  const [autoPlay, setAutoPlay] = createSignal(false);
  const [controlsUnlocked, setControlsUnlocked] = createSignal(false);
  const [pluckedToken, setPluckedToken] = createSignal("color.primary");

  // Section 0: copy command state
  const [copiedCmd, setCopiedCmd] = createSignal(false);
  const [packageManager, setPackageManager] = createSignal<PackageManager>("bun");
  const [selectEl, setSelectEl] = createSignal<HTMLElement>();
  const selectCtl = createSpinComponent(selectEl, select);
  // Items are the app's, not the component's: the vendored select is generic.
  createEffect(() =>
    selectCtl.bind(
      {
        items: PACKAGE_MANAGERS.map((manager) => ({
          value: manager.id,
          label: manager.id,
        })),
      },
      {
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const [value] = event.detail.value;
          if (value !== undefined && isPackageManager(value)) {
            setPackageManager(value);
          }
        },
      },
    ),
  );
  const installCommand = (): string =>
    PACKAGE_MANAGERS.find((manager) => manager.id === packageManager())
      ?.command ?? PACKAGE_MANAGERS[0].command;

  /** The custom property a token path resolves to. */
  const cssVarOf = (path: string): string => `--${path.replaceAll(".", "-")}`;
  /** The value the active theme and mode paint, read from the document. */
  const liveTokenValue = (path: string): string => {
    theme();
    mode();
    if (typeof document === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(cssVarOf(path))
      .trim();
  };

  // Section 1 (Themes / DTCG): selected token path
  const [selectedDtcgIdx, setSelectedDtcgIdx] = createSignal(0);

  // Section 2 (Utilities): live utility toggles
  const [utilPad, setUtilPad] = createSignal<"p-3" | "p-5">("p-3");
  const [utilRadius, setUtilRadius] = createSignal<"rounded-sm" | "rounded-lg">("rounded-lg");
  const [utilSurface, setUtilSurface] = createSignal<"bg-surface" | "bg-surface-raised">("bg-surface-raised");
  const [utilTryInvalid, setUtilTryInvalid] = createSignal(false);

  // Section 3 (Primitives): interactive native controls
  const [switchChecked, setSwitchChecked] = createSignal(true);
  const [classless, setClassless] = createSignal(true);
  const [progressVal, setProgressVal] = createSignal(72);

  // Section 4 (Components): HoverCard with live component specimen preview (like /components)
  const [hoveredTile, setHoveredTile] = createSignal<HoverTileSpec | null>(null);
  const [hoverCardPos, setHoverCardPos] = createSignal<{ top: number; left: number }>({
    top: 180,
    left: 180,
  });
  let hoverOpenTimer: number | undefined;
  let hoverCloseTimer: number | undefined;

  // Section 5 (Tooling): interactive lint autofix state
  const [fixedIds, setFixedIds] = createSignal<Record<string, boolean>>({
    hex: false,
    scale: false,
    ink: false,
  });

  let wheelAccum = 0;
  let lastStepAt = 0;
  let touchStartY: number | null = null;

  const selectStage = (nextStage: number) => {
    const clamped = Math.max(0, Math.min(STAGE_COUNT - 1, nextStage));
    if (clamped > 0) setControlsUnlocked(true);
    setHoveredTile(null);
    wheelAccum = 0;
    lastStepAt = performance.now();
    setStage(clamped);
  };

  const stepStage = (delta: 1 | -1) => {
    const now = performance.now();
    if (now - lastStepAt < STEP_COOLDOWN_MS) return;
    const next = stage() + delta;
    if (next < 0 || next >= STAGE_COUNT) {
      wheelAccum = 0;
      return;
    }
    selectStage(next);
  };

  // Auto-play timer: steps smoothly through carousel stages
  createEffect(() => {
    if (!autoPlay()) return;
    const id = window.setInterval(() => {
      const next = (stage() + 1) % STAGE_COUNT;
      selectStage(next);
    }, 10500);
    onCleanup(() => window.clearInterval(id));
  });

  onMount(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastStepAt < STEP_COOLDOWN_MS) {
        wheelAccum = 0;
        return;
      }
      if (
        (e.deltaY > 0 && wheelAccum < 0) ||
        (e.deltaY < 0 && wheelAccum > 0)
      ) {
        wheelAccum = 0;
      }
      wheelAccum += e.deltaY;
      if (wheelAccum >= WHEEL_THRESHOLD) {
        stepStage(1);
      } else if (wheelAccum <= -WHEEL_THRESHOLD) {
        stepStage(-1);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        stepStage(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        stepStage(-1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? null;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY === null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY;
      const dy = touchStartY - endY;
      touchStartY = null;
      if (Math.abs(dy) >= 44) {
        stepStage(dy > 0 ? 1 : -1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    onCleanup(() => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.clearTimeout(hoverOpenTimer);
      window.clearTimeout(hoverCloseTimer);
    });
  });

  const handlePluck = (ev: MarkPluckEvent) => {
    setPluckedToken(ev.token);
  };

  const copyInstall = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(installCommand());
    }
    setCopiedCmd(true);
    window.setTimeout(() => setCopiedCmd(false), 1400);
  };

  const openTileHoverCard = (tile: HoverTileSpec, triggerEl: HTMLElement) => {
    window.clearTimeout(hoverCloseTimer);
    window.clearTimeout(hoverOpenTimer);
    hoverOpenTimer = window.setTimeout(() => {
      const r = triggerEl.getBoundingClientRect();
      const cardW = 490;
      const cardH = 220;
      const left = Math.max(
        16,
        Math.min(window.innerWidth - cardW - 16, r.left),
      );
      const preferTop = r.top - cardH - 10;
      const top =
        preferTop > 64
          ? preferTop
          : Math.min(window.innerHeight - cardH - 16, r.bottom + 10);
      setHoverCardPos({ top: Math.round(top), left: Math.round(left) });
      setHoveredTile(tile);
    }, 90);
  };

  const scheduleCloseTileHoverCard = () => {
    window.clearTimeout(hoverOpenTimer);
    window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = window.setTimeout(() => {
      setHoveredTile(null);
    }, 150);
  };

  const keepTileHoverCardOpen = () => {
    window.clearTimeout(hoverCloseTimer);
  };

  const toggleFix = (id: string) => {
    setFixedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fixAllFindings = () => {
    setFixedIds({ hex: true, scale: true, ink: true });
  };

  const remainingFindings = () =>
    ORACLE_FINDINGS.filter((item) => !fixedIds()[item.id]).length;

  const currentDtcg = () => DTCG_SAMPLES[selectedDtcgIdx()] ?? DTCG_SAMPLES[0]!;

  return (
    <main
      style={{ height: "calc(100dvh - 3.5rem)" }}
      class="relative w-full overflow-hidden text-text font-sans text-md"
    >
      {/* FULL-PAGE ORB-WEAVER CANVAS (Spans the entire 1440x900 window including behind TopNav) */}
      <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <Mark
          class="h-full w-full text-text select-none"
          stage={stage()}
          reweaveKey={reweaveKey()}
          activeToken={pluckedToken()}
          onPluck={handlePluck}
          onSelectStage={(next: number) => selectStage(next)}
          onNavigateLayer={(href: string) => navigate(href)}
        />
      </div>

      {/* LIVE COMPONENT SPECIMEN HOVER-CARD (Matches /components gallery cards) */}
      <Show when={hoveredTile()}>
        {(tile) => (
          <div
            style={{
              position: "fixed",
              top: `${hoverCardPos().top}px`,
              left: `${hoverCardPos().left}px`,
              width: "30rem",
            }}
            class="z-modal"
            onPointerEnter={keepTileHoverCardOpen}
            onPointerLeave={scheduleCloseTileHoverCard}
          >
            <div class="overflow-hidden rounded-md border border-border-strong bg-surface-raised shadow-lg">
              <div class="flex min-h-[8rem] items-center justify-center overflow-visible border-b border-border bg-surface p-4">
                <div class="flex w-full min-w-0 flex-col items-center text-center [&>*]:text-left" innerHTML={tile().mountHtml} />
              </div>
              <div class="flex items-center justify-between gap-2 px-4 py-2">
                <span class="flex min-w-0 items-center gap-2 font-brand text-md text-text">
                  <span
                    class={`inline-block h-4 w-4 ${tile().icon} shrink-0 text-text-muted`}
                    aria-hidden="true"
                  />
                  <span class="truncate">{tile().name}</span>
                </span>
                <span class="shrink-0 font-mono text-xs text-text-muted">
                  {tile().meta}
                </span>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* TINY FLOATING CONTROL PANEL FAB (Init = Scroll cue; Active = compact dots + prev/next/auto/replay, NO section names) */}
      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-dropdown flex justify-center">
        <Show
          when={stage() > 0 || controlsUnlocked()}
          fallback={
            <button
              type="button"
              onClick={() => selectStage(1)}
              class="bare pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-3 py-1 font-mono text-xs text-text shadow-md transition-colors duration-fast hover:border-primary"
            >
              <span class="h-2 w-2 rounded-full bg-primary" />
              <span>Scroll</span>
              <span aria-hidden="true" class="text-primary">↓</span>
            </button>
          }
        >
          <div
            class="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-2 py-1 shadow-md"
            role="group"
            aria-label="Stage controls"
          >
            <button
              type="button"
              disabled={stage() === 0}
              onClick={() => selectStage(stage() - 1)}
              class="bare inline-flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs text-text hover:bg-surface disabled:opacity-40"
              title="Previous stage"
              aria-label="Previous stage"
            >
              ‹
            </button>

            <div class="flex items-center gap-1" role="tablist" aria-label="Stages">
              <For each={[0, 1, 2, 3, 4, 5, 6]}>
                {(idx) => {
                  const active = () => stage() === idx;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active()}
                      aria-label={`Stage ${idx + 1}`}
                      onClick={() => selectStage(idx)}
                      class={`bare h-2 rounded-full p-0 transition-all duration-fast ${
                        active()
                          ? "w-4 bg-primary"
                          : "w-2 bg-border-strong hover:bg-text-muted"
                      }`}
                    />
                  );
                }}
              </For>
            </div>

            <button
              type="button"
              disabled={stage() === STAGE_COUNT - 1}
              onClick={() => selectStage(stage() + 1)}
              class="bare inline-flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs text-text hover:bg-surface disabled:opacity-40"
              title="Next stage"
              aria-label="Next stage"
            >
              ›
            </button>

            <span class="text-border-strong">·</span>

            <button
              type="button"
              aria-pressed={autoPlay()}
              onClick={() => setAutoPlay((v) => !v)}
              class={`bare inline-flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs transition-colors duration-fast ${
                autoPlay()
                  ? "bg-primary text-on-primary"
                  : "text-text-muted hover:bg-surface hover:text-text"
              }`}
              title={autoPlay() ? "Pause auto-play" : "Auto-play stages"}
              aria-label="Toggle auto-play"
            >
              {autoPlay() ? "⏸" : "▷"}
            </button>

            <button
              type="button"
              onClick={() => setReweaveKey((k) => k + 1)}
              class="bare inline-flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs text-text-muted hover:bg-surface hover:text-primary"
              title="Replay current ring weave"
              aria-label="Replay current ring weave"
            >
              ↻
            </button>
          </div>
        </Show>
      </div>

      {/* SINGLE ACTIVE CAROUSEL STAGE (Never 2+ sections on screen at once; tight w-fit content) */}
      <div class="pointer-events-none relative z-10 mx-auto flex h-full max-w-screen-xl items-center px-6 md:px-10">
        <Switch>
          {/* ===============================================================
              STAGE 0 · HERO
             =============================================================== */}
          <Match when={stage() === 0}>
            <section
              id="sec-hero"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-4"
            >
              <span class="inline-flex w-fit items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-3 py-1 font-mono text-xs text-text-muted shadow-sm">
                <span class="h-2 w-2 rounded-full bg-primary" />
                <span>Framework-agnostic · W3C DTCG · Pure CSS</span>
              </span>

              <h1 class="text-text">
                UI that holds together.
              </h1>

              <p class="text-sm text-text-muted">
                Spin gives humans and coding agents a closed design vocabulary:
                theme tokens, semantic HTML primitives, headless state machines,
                and mechanical oracles that verify the result. Adopt it in
                layers — use Spin to create a single source of truth for
                themes, styles, and components across all your apps.
              </p>

              <div class="flex w-fit flex-wrap items-center gap-2">
                <A href="/guide/install" role="button" class="no-underline">
                  Get started →
                </A>
                <A href="/components" role="button" class="secondary no-underline">
                  Components
                </A>
              </div>

              <div class="flex w-fit max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-border-strong bg-surface-raised p-1 shadow-sm">
                <docs-select ref={setSelectEl} id="install-pm" />
                <button
                  type="button"
                  onClick={copyInstall}
                  class="bare inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 font-mono text-xs text-text hover:bg-surface"
                >
                  <span class="text-text-muted">$</span>
                  <span>{installCommand()}</span>
                  <span
                    class={
                      copiedCmd()
                        ? "inline-block h-4 w-4 i-lucide-check text-semantic-success"
                        : "inline-block h-4 w-4 i-lucide-copy text-text-muted"
                    }
                    aria-hidden="true"
                  />
                </button>
              </div>

              <ThemePicker id="hero-theme-picker" />
            </section>
          </Match>

          {/* ===============================================================
              STAGE 1 · THEMES (W3C DTCG Foundation)
             =============================================================== */}
          <Match when={stage() === 1}>
            <section
              id="sec-themes"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                01 · Foundation · W3C DTCG
              </span>
              <h2 class="text-text">
                One theme document owns every visual decision.
              </h2>
              <p class="text-sm text-text-muted">
                Colors, typography, spacing, and radii live in one W3C DTCG
                document. Every sample below reads its value from that
                document, so switching themes or modes rewrites the page — and
                light/dark contrast pairs are checked before you ship.
              </p>

              {/* Compact w-fit DTCG token selector pills */}
              <div class="flex w-fit flex-wrap gap-2">
                <For each={DTCG_SAMPLES}>
                  {(sample, idx) => {
                    const active = () => selectedDtcgIdx() === idx();
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedDtcgIdx(idx())}
                        class={`bare rounded-md border px-3 py-1 font-mono text-xs transition-colors duration-fast ${
                          active()
                            ? "border-primary bg-primary font-semibold text-on-primary"
                            : "border-border bg-surface-raised text-text hover:border-border-strong"
                        }`}
                      >
                        {sample.path}
                      </button>
                    );
                  }}
                </For>
              </div>

              {/* Compact w-fit DTCG card (zero wasted horizontal space) */}
              <div class="inline-flex w-fit flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-sm">
                <div class="flex items-center gap-4 border-b border-border pb-2">
                  <span class="font-mono text-xs font-semibold text-primary">
                    {currentDtcg().path}
                  </span>
                  <badge class="badge-neutral">$type: {currentDtcg().type}</badge>
                </div>

                <div class="flex w-fit items-center gap-3">
                  <Show
                    when={currentDtcg().sample === "color"}
                    fallback={
                      <span
                        class={`flex h-8 w-8 shrink-0 items-center justify-center border border-primary bg-surface text-text ${currentDtcg().sampleClass}`}
                      >
                        {currentDtcg().sample === "font" ? "Aa" : ""}
                      </span>
                    }
                  >
                    <span
                      class={`h-8 w-8 shrink-0 rounded-md border border-border ${currentDtcg().sampleClass}`}
                      aria-hidden="true"
                    />
                  </Show>
                  <div class="flex flex-col gap-1 font-mono text-xs">
                    <span class="text-text-muted">
                      {cssVarOf(currentDtcg().path)}
                    </span>
                    <strong class="text-text">
                      {liveTokenValue(currentDtcg().path) || "—"}
                    </strong>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-4 text-xs">
                  <span class="text-text-muted">{currentDtcg().pairing}</span>
                  <A
                    href="/themes"
                    class="shrink-0 font-semibold text-primary no-underline hover:underline"
                  >
                    Themes →
                  </A>
                </div>
              </div>
            </section>
          </Match>

          {/* ===============================================================
              STAGE 2 · UTILITIES (Familiar Tailwind syntax, custom to your brand)
             =============================================================== */}
          <Match when={stage() === 2}>
            <section
              id="sec-utilities"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                02 · Styling · Theme-Bound Utilities
              </span>
              <h2 class="text-text">
                Familiar Tailwind syntax, custom to your brand.
              </h2>
              <p class="text-sm text-text-muted">
                Write the utility classes you already know — <code>p-4</code>,{" "}
                <code>bg-surface-raised</code>, <code>rounded-lg</code> — backed
                strictly by your theme's token scale.
              </p>

              {/* Compact w-fit Utility Composer */}
              <div class="inline-flex w-fit flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-sm">
                <div class="flex w-fit flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setUtilPad((p) => (p === "p-3" ? "p-5" : "p-3"))
                    }
                    class="bare rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-primary hover:border-primary"
                  >
                    {utilPad()}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUtilRadius((r) =>
                        r === "rounded-lg" ? "rounded-sm" : "rounded-lg",
                      )
                    }
                    class="bare rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-primary hover:border-primary"
                  >
                    {utilRadius()}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUtilSurface((s) =>
                        s === "bg-surface-raised"
                          ? "bg-surface"
                          : "bg-surface-raised",
                      )
                    }
                    class="bare rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-primary hover:border-primary"
                  >
                    {utilSurface()}
                  </button>
                  <button
                    type="button"
                    aria-pressed={utilTryInvalid()}
                    onClick={() => setUtilTryInvalid((v) => !v)}
                    class={`bare rounded-md border px-2 py-1 font-mono text-xs ${
                      utilTryInvalid()
                        ? "border-primary bg-primary text-on-primary"
                        : "border-border bg-surface text-text-muted hover:text-text"
                    }`}
                  >
                    + p-13
                  </button>
                </div>

                {/* Tight w-fit specimen */}
                <div
                  class={`inline-flex w-fit flex-col gap-1 border border-border-strong transition-all duration-fast ${utilPad()} ${utilRadius()} ${utilSurface()}`}
                >
                  <div class="flex w-fit items-center gap-3">
                    <strong class="font-brand text-sm text-text">
                      Brand-true surface
                    </strong>
                    <badge
                      class={
                        utilTryInvalid() ? "badge-warning" : "badge-success"
                      }
                    >
                      {utilTryInvalid() ? "unknown: p-13" : "Verified"}
                    </badge>
                  </div>
                  <code>
                    {utilTryInvalid()
                      ? "Rejected: step 13 is not in spacing scale"
                      : `class="${utilSurface()} ${utilPad()} ${utilRadius()}"`}
                  </code>
                </div>

                <div class="flex items-center justify-between gap-4 text-xs">
                  <span class="font-mono text-text-muted">
                    Closed token scale
                  </span>
                  <A
                    href="/utilities"
                    class="font-semibold text-primary no-underline hover:underline"
                  >
                    Utilities →
                  </A>
                </div>
              </div>
            </section>
          </Match>

          {/* ===============================================================
              STAGE 3 · PRIMITIVES (Semantic HTML defaults, pure CSS, compact w-fit pills)
             =============================================================== */}
          <Match when={stage() === 3}>
            <section
              id="sec-primitives"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                03 · Elements · Pure CSS Primitives
              </span>
              <h2 class="text-text">
                Semantic HTML defaults. Zero wrapper soup.
              </h2>
              <p class="text-sm text-text-muted">
                A button is <code>&lt;button&gt;</code>, a switch is{" "}
                <code>role="switch"</code> — styled in CSS, no wrapper class.
                Flip the toggle and watch the markup change.
              </p>

              {/* One card size; each specimen fills the same cell */}
              <div class="grid w-[19rem] max-w-full grid-cols-2 gap-2">
                <div class="flex flex-col items-start justify-between gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-sm">
                  <div class="flex flex-wrap items-center gap-1">
                    <button type="button" class="s-sm">
                      Save
                    </button>
                    <button type="button" class="secondary s-sm">
                      Cancel
                    </button>
                  </div>
                  <code>
                    &lt;button&gt;
                  </code>
                </div>

                <div class="flex flex-col items-start justify-between gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-sm">
                  <label class="inline-flex w-fit cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={switchChecked()}
                      onChange={(e) =>
                        setSwitchChecked(e.currentTarget.checked)
                      }
                    />
                    <span>Token gate</span>
                  </label>
                  <code>
                    role="switch"
                  </code>
                </div>

                <div class="flex flex-col items-start justify-between gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-sm">
                  <div class="flex flex-wrap items-center gap-1">
                    <progress value={progressVal()} max={100} class="w-16" />
                    <button
                      type="button"
                      onClick={() =>
                        setProgressVal((v) => (v >= 100 ? 35 : v + 20))
                      }
                      class="bare font-mono text-xs text-primary hover:underline"
                    >
                      {progressVal()}%
                    </button>
                  </div>
                  <code>
                    &lt;progress&gt;
                  </code>
                </div>

                <div class="flex flex-col items-start justify-between gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-sm">
                  <div class="flex flex-wrap items-center gap-1">
                    <badge class="badge-success">AA</badge>
                    <badge class="badge-warning">DTCG</badge>
                    <badge class="badge-neutral">CSS</badge>
                  </div>
                  <code>
                    &lt;badge&gt;
                  </code>
                </div>

                <div class="col-span-2 flex flex-col justify-center gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-sm">
                  <p class="font-heading text-sm font-semibold text-text">
                    Theme-bound prose
                  </p>
                  <p class="text-xs text-text-muted">
                    Headings, paragraphs, lists, and{" "}
                    <a href="/guide/markup">links</a> spend the same type scale.
                  </p>
                  <code>
                    &lt;p&gt; · &lt;h2&gt; · &lt;a&gt;
                  </code>
                </div>
              </div>

              <div class="flex w-[19rem] max-w-full flex-col gap-2">
                <label class="inline-flex w-fit cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={classless()}
                    onChange={(e) => setClassless(e.currentTarget.checked)}
                  />
                  <span>classless</span>
                </label>
                <Show
                  when={classless()}
                  fallback={
                    <button type="button" class="button s-sm">
                      Save
                    </button>
                  }
                >
                  <button type="button" class="s-sm">
                    Save
                  </button>
                </Show>
                <code>
                  {classless()
                    ? "<button>Save</button>"
                    : '<button class="button">Save</button>'}
                </code>
              </div>

              <A
                href="/components?kind=elements"
                class="font-mono text-xs font-semibold text-primary no-underline hover:underline"
              >
                Explore all {ELEMENT_COUNT} CSS elements →
              </A>
            </section>
          </Match>

          {/* ===============================================================
              STAGE 4 · RUNTIME COMPONENTS (Live Specimen HoverCard Tiles)
             =============================================================== */}
          <Match when={stage() === 4}>
            <section
              id="sec-components"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                04 · Interactive · Headless Machines
              </span>
              <h2 class="text-text">
                Stateful machines when native HTML isn't enough.
              </h2>
              <p class="text-sm text-text-muted">
                Multi-part widgets driven by deterministic state machines,
                shipped as custom elements for any framework.{" "}
                <strong>Hover any tile</strong> to preview the live component.
              </p>

              {/* Compact w-fit Component Tile Grid with Live Specimen HoverCards */}
              <div class="flex max-w-[28rem] flex-wrap gap-2">
                <For each={HOVER_TILES}>
                  {(tile) => (
                    <A
                      href={tile.href}
                      onPointerEnter={(e) =>
                        openTileHoverCard(tile, e.currentTarget)
                      }
                      onPointerLeave={scheduleCloseTileHoverCard}
                      onFocus={(e) => openTileHoverCard(tile, e.currentTarget)}
                      onBlur={scheduleCloseTileHoverCard}
                      class="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-1 text-xs text-text no-underline shadow-sm transition-colors duration-fast hover:border-primary"
                    >
                      <span
                        class={`inline-block h-4 w-4 ${tile.icon} text-primary`}
                        aria-hidden="true"
                      />
                      <span class="font-mono font-semibold text-text">
                        {tile.name}
                      </span>
                      <span
                        class="inline-block h-3 w-3 i-lucide-arrow-up-right text-text-muted"
                        aria-hidden="true"
                      />
                    </A>
                  )}
                </For>
              </div>

              <A
                href="/components?kind=machines"
                class="font-mono text-xs font-semibold text-primary no-underline hover:underline"
              >
                Browse all {MACHINE_COUNT} machines →
              </A>
            </section>
          </Match>

          {/* ===============================================================
              STAGE 5 · TOOLING (Lints, CLI & MCP Oracles)
             =============================================================== */}
          <Match when={stage() === 5}>
            <section
              id="sec-tooling"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                05 · Verification · Lints, CLI & MCP
              </span>
              <h2 class="text-text">
                Mechanical verification for humans and agents.
              </h2>
              <p class="text-sm text-text-muted">
                Spin's lint rules, CLI, and MCP server check every class and
                contrast pair against your theme contract.
              </p>

              <div class="inline-flex w-fit flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-sm">
                <div class="flex items-center justify-between gap-4 border-b border-border pb-2">
                  <badge
                    class={
                      remainingFindings() === 0
                        ? "badge-success"
                        : "badge-warning"
                    }
                  >
                    {remainingFindings() === 0
                      ? "0 errors · PASS"
                      : `${remainingFindings()} errors`}
                  </badge>
                  <button
                    type="button"
                    onClick={fixAllFindings}
                    class="s-sm"
                  >
                    Autofix all
                  </button>
                </div>

                <div class="flex w-fit flex-col gap-2">
                  <For each={ORACLE_FINDINGS}>
                    {(item) => {
                      const isFixed = () => fixedIds()[item.id] === true;
                      return (
                        <button
                          type="button"
                          onClick={() => toggleFix(item.id)}
                          class={`bare flex w-fit items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors duration-fast ${
                            isFixed()
                              ? "border-border bg-surface"
                              : "border-primary bg-surface"
                          }`}
                        >
                          <span class="font-mono text-xs font-semibold text-primary">
                            {item.rule}
                          </span>
                          <code>
                            {isFixed() ? item.fixedCode : item.badCode}
                          </code>
                          <span class="font-mono text-xs text-text-muted">
                            {isFixed() ? "✓" : "Fix →"}
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>

                <div class="flex items-center justify-between gap-4 text-xs">
                  <A
                    href="/tooling/lints"
                    class="font-semibold text-primary no-underline hover:underline"
                  >
                    Lint rules →
                  </A>
                  <A
                    href="/tooling/mcp"
                    class="font-semibold text-primary no-underline hover:underline"
                  >
                    MCP server →
                  </A>
                </div>
              </div>
            </section>
          </Match>

          {/* ===============================================================
              STAGE 6 · STUDIO (Visual Token & Component Workbench)
             =============================================================== */}
          <Match when={stage() === 6}>
            <section
              id="sec-studio"
              style={{ "max-width": "29rem" }}
              class="pointer-events-auto flex w-fit flex-col items-start gap-3"
            >
              <div class="flex w-[27rem] max-w-full flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-lg">
                <span class="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  06 · Workbench · Spin Studio
                </span>
                <h2 class="text-text">
                  Edit the theme against the live app.
                </h2>
                <p class="text-sm text-text-muted">
                  Spin Studio runs beside your app in development, or
                  standalone with <code>spin studio</code>: change a color and
                  the running page repaints before anything is saved. Palettes,
                  type, icons, motion, geometry — then save, and the document
                  lands in <code>spin/</code>.
                </p>

                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1 rounded-md border border-border bg-surface p-3">
                    <span class="font-mono text-xs font-semibold text-primary">
                      Theme & Type
                    </span>
                    <span class="text-xs text-text-muted">
                      Palettes, scales, and faces
                    </span>
                  </div>
                  <div class="flex flex-col gap-1 rounded-md border border-border bg-surface p-3">
                    <span class="font-mono text-xs font-semibold text-primary">
                      Contrast Gate
                    </span>
                    <span class="text-xs text-text-muted">
                      Live AA / AAA legibility matrix
                    </span>
                  </div>
                  <div class="flex flex-col gap-1 rounded-md border border-border bg-surface p-3">
                    <span class="font-mono text-xs font-semibold text-primary">
                      Icons & Motion
                    </span>
                    <span class="text-xs text-text-muted">
                      Vendor glyphs; tune easing
                    </span>
                  </div>
                  <div class="flex flex-col gap-1 rounded-md border border-border bg-surface p-3">
                    <span class="font-mono text-xs font-semibold text-primary">
                      Recipes
                    </span>
                    <span class="text-xs text-text-muted">
                      Copy markup into your repo
                    </span>
                  </div>
                </div>

                <div class="flex w-fit flex-wrap items-center gap-2 pt-1">
                  <A href="/studio" role="button" class="no-underline">
                    Explore Studio →
                  </A>
                  <A
                    href="/guide/install"
                    role="button"
                    class="secondary no-underline"
                  >
                    Install →
                  </A>
                </div>
              </div>
            </section>
          </Match>
        </Switch>
      </div>
    </main>
  );
}
