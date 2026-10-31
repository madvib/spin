// Docs landing page: foreground interactive black-widow stage and live product workbenches.
import { createEffect, createSignal, For, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import {
  Logo,
  Mark,
  mode,
  theme,
  WEB_ANCHOR_NODES,
} from "@spinjs/kit";
import type { MarkPluckEvent } from "@spinjs/kit";
import { COMPONENT_GROUPS } from "../nav.ts";
import { Code, Reveal } from "../bits.tsx";

interface OracleFinding {
  readonly id: string;
  readonly rule: string;
  readonly badToken: string;
  readonly goodToken: string;
  readonly reason: string;
}

const ORACLE_FINDINGS: readonly OracleFinding[] = [
  {
    id: "hex",
    rule: "spin/no-hardcoded-color",
    badToken: "bg-[#c8102e]",
    goodToken: "bg-primary",
    reason: "Raw hex bypasses dark mode restatements.",
  },
  {
    id: "scale",
    rule: "spin/unknown-class",
    badToken: "p-13",
    goodToken: "p-4",
    reason: "Step 13 is not in the spacing scale; emits zero CSS.",
  },
  {
    id: "pair",
    rule: "spin/unpaired-ink",
    badToken: "bg-primary text-text",
    goodToken: "bg-primary text-on-primary",
    reason: "text-text on primary drops to 1.8:1 in dark mode.",
  },
];

const ANCHOR_META: Record<
  string,
  {
    readonly title: string;
    readonly role: string;
    readonly snippet: string;
  }
> = {
  primary: {
    title: "Spot & action ink",
    role: "Paired with --color-on-primary across every mode.",
    snippet: `<button type="button">Deploy build</button>\n<badge variant="primary">verified</badge>`,
  },
  spacing: {
    title: "Closed spacing scale",
    role: "20 steps from 0 to 64. Unlisted steps compile to nothing.",
    snippet: `<card class="flex flex-col gap-4 p-4">\n  <h3>Release v2.4</h3>\n</card>`,
  },
  radius: {
    title: "Structural corner radius",
    role: "Shared across cards, fields, panels, and buttons.",
    snippet: `<input type="text" placeholder="Filter routes..." />`,
  },
  surface: {
    title: "Layered paper & charcoal",
    role: "surface, surface-sunken, and surface-raised hold 4.5:1 text floors.",
    snippet: `<panel>\n  <panel-list>...</panel-list>\n</panel>`,
  },
  motion: {
    title: "Bounded motion tokens",
    role: "fast, base, slow, and loop durations governed by the theme.",
    snippet: `<div class="transition-colors duration-fast ease-standard">...</div>`,
  },
};

export default function Home(): JSX.Element {
  const [activeAnchor, setActiveAnchor] = createSignal<string>("primary");
  const [reweaveKey, setReweaveKey] = createSignal(0);
  const [pluckedToken, setPluckedToken] = createSignal("--color-primary");
  const [pluckedValue, setPluckedValue] = createSignal("#c8102e");
  const [pluckCoords, setPluckCoords] = createSignal("ring 4 · spoke 2");
  const [copiedInstall, setCopiedInstall] = createSignal(false);

  // Interactive Specimen state connected to the foreground web
  const [specimenCount, setSpecimenCount] = createSignal(3);
  const [strictGate, setStrictGate] = createSignal(true);
  const [specimenLoad, setSpecimenLoad] = createSignal(76);

  // Interactive Oracle Workbench state (which of the 3 agent bugs are fixed)
  const [fixedIds, setFixedIds] = createSignal<Record<string, boolean>>({
    hex: false,
    scale: false,
    pair: false,
  });

  // Interactive Component Taxonomy preview state
  const [activeGroupIdx, setActiveGroupIdx] = createSignal(0);

  const readCssVar = (varName: string): string => {
    if (typeof document === "undefined") return "";
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return val || "—";
  };

  const syncTokenReadout = (varName: string) => {
    requestAnimationFrame(() => {
      setPluckedValue(readCssVar(varName));
    });
  };

  onMount(() => {
    syncTokenReadout(pluckedToken());
  });

  createEffect(() => {
    theme();
    mode();
    syncTokenReadout(pluckedToken());
  });

  const handlePluck = (event: MarkPluckEvent) => {
    setPluckedToken(event.token);
    setPluckCoords(`ring ${event.ring} · spoke ${event.spoke}`);
    syncTokenReadout(event.token);
    const matched = WEB_ANCHOR_NODES.find((n) => n.token === event.token);
    if (matched) setActiveAnchor(matched.id);
  };

  const selectAnchor = (id: string) => {
    const node = WEB_ANCHOR_NODES.find((n) => n.id === id);
    if (!node) return;
    setActiveAnchor(id);
    setPluckedToken(node.token);
    setPluckCoords(`ring ${node.ring + 1} · spoke ${node.spoke + 1}`);
    syncTokenReadout(node.token);
  };

  const toggleFix = (id: string) => {
    setFixedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allFixed = () =>
    ORACLE_FINDINGS.every((f) => fixedIds()[f.id] === true);

  const setAllFixed = (val: boolean) => {
    setFixedIds({ hex: val, scale: val, pair: val });
  };

  const remainingBugs = () =>
    ORACLE_FINDINGS.filter((f) => !fixedIds()[f.id]).length;

  const oracleCode = () => {
    const f = fixedIds();
    const cardPad = f.scale ? "p-4" : "p-13";
    const badgeFill = f.hex ? "bg-primary" : "bg-[#c8102e]";
    const btnClasses = f.pair
      ? "bg-primary text-on-primary"
      : "bg-primary text-text";
    return `<article class="rounded-lg border border-border bg-surface-raised ${cardPad}">
  <div class="flex items-center justify-between gap-3">
    <span class="font-semibold text-text">pr-418 · checkout-flow</span>
    <span class="rounded-sm px-2 py-1 text-xs ${badgeFill} text-on-primary">
      canary
    </span>
  </div>
  <p class="mt-2 text-sm text-text-muted">
    32 routes probed in 410ms · contrast & geometry verified
  </p>
  <button type="button" class="bare mt-4 rounded-md px-3 py-2 text-xs font-semibold ${btnClasses}">
    Promote release
  </button>
</article>`;
  };

  const openStudioOverlay = () => {
    const fab = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open the theme studio"]',
    );
    if (fab) {
      fab.click();
    }
  };

  const copyInstall = () => {
    navigator.clipboard?.writeText("bun add @spinjs/spin @spinjs/components");
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 1800);
  };

  return (
    <main class="min-h-dvh bg-surface text-text font-sans text-md">
      {/* First screen: Split Hero — Pitch & Theme Switch Left, Foreground Interactive Black Widow Stage Right */}
      <section class="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-screen-xl items-center gap-8 px-4 py-8 md:grid-cols-2 md:px-8 md:py-12">
        {/* Left Column: Direct Pitch + Live Starter Strip + Interactive Token Workbench */}
        <div class="flex flex-col justify-center gap-6">
          <div class="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium text-text-muted">
            <span class="h-2 w-2 rounded-full bg-primary" />
            <span>Closed-vocabulary UI · Built for humans &amp; agents</span>
          </div>

          <div>
            <h1 class="m-0 font-heading text-display font-bold tracking-tight text-text">
              Spin your own web.
            </h1>
            <p class="mt-4 max-w-[54ch] text-lg text-text-muted">
              Give agents and engineers one design contract. Spin locks colors,
              spacing, and typography to a validated theme JSON, ships 59 native
              primitives and state-machine components, and catches visual drift
              mechanically.
            </p>
          </div>

          {/* Primary CTAs + One-click install */}
          <div class="flex flex-wrap items-center gap-3">
            <A href="/guide/install" role="button" class="no-underline">
              Get started
            </A>
            <A
              href="/components"
              role="button"
              class="secondary no-underline"
            >
              Explore 59 components
            </A>
            <button
              type="button"
              onClick={copyInstall}
              class="bare inline-flex items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-text transition-colors duration-fast hover:border-border-strong"
              title="Copy install command"
            >
              <span class="text-primary">$</span>
              <span>bun add @spinjs/spin</span>
              <span
                class={
                  copiedInstall()
                    ? "i-lucide-check icon-sm text-semantic-success"
                    : "i-lucide-copy icon-sm text-text-muted"
                }
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Interactive Workbench coupled to the Foreground Spider Web */}
          <div class="rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-semibold text-primary">
                  LIVE WEB TELEMETRY
                </span>
                <span class="text-xs text-text-muted">· {pluckCoords()}</span>
              </div>
              <button
                type="button"
                onClick={() => setReweaveKey((k) => k + 1)}
                class="bare inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-xs text-text-muted transition-colors duration-fast hover:border-border-strong hover:text-text"
              >
                <span class="i-lucide-rotate-ccw icon-sm" aria-hidden="true" />
                <span>Re-spin web</span>
              </button>
            </div>

            {/* Clickable token nodes that lure the spider across the foreground web */}
            <div class="mt-3">
              <p class="m-0 text-xs text-text-muted">
                Click a token node (or pluck the web) to send the widow to that
                strand and inspect the live contract:
              </p>
              <div
                class="mt-2 flex flex-wrap gap-1"
                role="group"
                aria-label="Web token anchors"
              >
                <For each={WEB_ANCHOR_NODES}>
                  {(node) => (
                    <button
                      type="button"
                      aria-pressed={activeAnchor() === node.id}
                      onClick={() => selectAnchor(node.id)}
                      class={`bare rounded-sm px-2 py-1 font-mono text-xs transition-colors duration-fast ${
                        activeAnchor() === node.id
                          ? "bg-primary text-on-primary font-semibold"
                          : "border border-border bg-surface text-text-muted hover:text-text"
                      }`}
                    >
                      {node.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Live resolved token readout + interactive mini-component driven by that token */}
            <div class="mt-3 grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-2">
              <div class="flex flex-col justify-between gap-2">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <code class="text-xs font-semibold text-primary">
                      {pluckedToken()}
                    </code>
                    <code class="rounded-sm bg-surface-sunken px-2 py-1 text-xs text-text">
                      {pluckedValue()}
                    </code>
                  </div>
                  <p class="mt-1 mb-0 text-xs font-semibold text-text">
                    {ANCHOR_META[activeAnchor()]?.title ?? "Active token"}
                  </p>
                  <p class="mt-1 mb-0 text-xs text-text-muted">
                    {ANCHOR_META[activeAnchor()]?.role ??
                      "Resolved from the active theme document."}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-2 border-t border-border pt-2 font-mono text-xs text-text-muted">
                  <span>data-theme="{theme()}"</span>
                  <span>data-mode="{mode()}"</span>
                </div>
              </div>

              {/* Interactive live component specimen responding to user clicks */}
              <div class="flex flex-col justify-between gap-3 rounded-md border border-border bg-surface-raised p-3">
                <div class="flex items-center justify-between gap-2">
                  <label class="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={strictGate()}
                      onChange={(e) => {
                        setStrictGate(e.currentTarget.checked);
                        selectAnchor("primary");
                      }}
                    />
                    <span>Strict gate</span>
                  </label>
                  <badge variant={strictGate() ? "primary" : "neutral"}>
                    {strictGate() ? "enforced" : "advisory"}
                  </badge>
                </div>

                <div>
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-text-muted">Silk tension</span>
                    <span class="font-mono font-semibold text-text">
                      {specimenLoad()}%
                    </span>
                  </div>
                  <progress
                    value={specimenLoad()}
                    max={100}
                    class="mt-1"
                  />
                </div>

                <div class="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    class="s-sm"
                    onClick={() => {
                      setSpecimenCount((n) => n + 1);
                      setSpecimenLoad((v) => (v >= 95 ? 45 : v + 10));
                      selectAnchor(
                        WEB_ANCHOR_NODES[
                          specimenCount() % WEB_ANCHOR_NODES.length
                        ]!.id,
                      );
                    }}
                  >
                    Pluck strand ({specimenCount()})
                  </button>
                  <span class="font-mono text-xs text-text-muted">
                    {theme()}/{mode()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Foreground Interactive Black Widow Stage */}
        <div class="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-sm">
          <div class="flex items-center justify-between border-b border-border bg-surface px-4 py-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-primary" />
              <span class="font-mono font-semibold text-text">
                orb-weaver.svg
              </span>
              <span class="text-text-muted">
                · 8-leg 2-bone IK · elastic catenary silk
              </span>
            </div>
            <span class="font-mono text-xs text-text-muted">
              move or click web
            </span>
          </div>

          <div class="relative flex aspect-square max-h-[32rem] w-full items-center justify-center p-2">
            <Mark
              class="h-full w-full cursor-crosshair text-text select-none"
              activeAnchor={activeAnchor()}
              reweaveKey={reweaveKey()}
              onPluck={handlePluck}
            />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-4 py-2 text-xs text-text-muted">
            <span>
              Plucked:{" "}
              <code class="text-primary">{pluckedToken()}</code> ={" "}
              <code class="text-text">{pluckedValue()}</code>
            </span>
            <span>Hover to stalk · Click any intersection to strike</span>
          </div>
        </div>
      </section>

      {/* Below the fold: Show, Don't Tell Interactive Workbenches */}
      <div class="mx-auto max-w-screen-xl px-4 py-12 md:px-8 md:py-16">
        {/* Workbench 01: Mechanical Verification (Interactive Agent Bug Fixer) */}
        <Reveal>
          <section class="rounded-lg border border-border bg-surface-raised p-6 md:p-8">
            <div class="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p class="m-0 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  01 / Mechanical Verification
                </p>
                <h2 class="mt-1 mb-0 font-heading text-2xl font-bold text-text">
                  What code review misses, Spin catches.
                </h2>
                <p class="mt-2 max-w-[62ch] text-sm text-text-muted">
                  An agent writes a clean-looking component and slips in three
                  one-word bugs: a raw hex color, a made-up spacing step, and an
                  illegible dark-mode ink pair. Click each diagnostic below to
                  watch Spin repair the source and the rendered output.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <badge variant={allFixed() ? "success" : "danger"}>
                  {allFixed()
                    ? "0 issues · 6.5:1 PASS"
                    : `${remainingBugs()} issues · 1.8:1 FAIL`}
                </badge>
                <button
                  type="button"
                  class={allFixed() ? "secondary s-sm" : "s-sm"}
                  onClick={() => setAllFixed(!allFixed())}
                >
                  {allFixed() ? "Reset agent bugs" : "Fix all 3 with Spin"}
                </button>
              </div>
            </div>

            <div class="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Left: Clickable Diagnostics + Live Markup */}
              <div class="flex flex-col gap-3">
                <For each={ORACLE_FINDINGS}>
                  {(item) => {
                    const isFixed = () => fixedIds()[item.id] === true;
                    return (
                      <button
                        type="button"
                        onClick={() => toggleFix(item.id)}
                        class={`bare flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors duration-fast ${
                          isFixed()
                            ? "border-border bg-surface"
                            : "border-primary bg-surface"
                        }`}
                      >
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span
                              class={
                                isFixed()
                                  ? "i-lucide-check-circle-2 icon-sm text-semantic-success"
                                  : "i-lucide-alert-triangle icon-sm text-primary"
                              }
                              aria-hidden="true"
                            />
                            <code class="text-xs font-semibold text-text">
                              {item.rule}
                            </code>
                            <code class="rounded-sm bg-surface-sunken px-2 py-1 text-xs text-text-muted">
                              {isFixed() ? item.goodToken : item.badToken}
                            </code>
                          </div>
                          <p class="mt-1 mb-0 text-xs text-text-muted">
                            {item.reason}
                          </p>
                        </div>
                        <span class="shrink-0 rounded-sm border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-text">
                          {isFixed() ? "Fixed ✓" : "Apply fix"}
                        </span>
                      </button>
                    );
                  }}
                </For>

                <Code class="text-xs" code={oracleCode()} lang="html" />
              </div>

              {/* Right: Live Rendered Preview (showing the actual bug vs fixed result) */}
              <div class="flex flex-col justify-between rounded-lg border border-border bg-surface p-6">
                <div class="flex items-center justify-between text-xs text-text-muted">
                  <span class="font-mono">LIVE RENDERED SURFACE</span>
                  <span class="font-mono">
                    {allFixed()
                      ? "contrast: 6.49:1 · vocabulary: valid"
                      : "contrast: 1.82:1 · padding: collapsed"}
                  </span>
                </div>

                <div class="my-6 flex items-center justify-center">
                  <article
                    class={`w-full max-w-md rounded-lg border border-border bg-surface-raised shadow-sm transition-all duration-fast ${
                      fixedIds().scale ? "p-4" : "p-0"
                    }`}
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-semibold text-text">
                        pr-418 · checkout-flow
                      </span>
                      <badge
                        variant={fixedIds().hex ? "primary" : "danger"}
                      >
                        {fixedIds().hex ? "canary (token)" : "#c8102e (raw hex)"}
                      </badge>
                    </div>
                    <p class="mt-2 text-sm text-text-muted">
                      32 routes probed in 410ms · contrast &amp; geometry
                      verified across light and dark modes.
                    </p>
                    <div class="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleFix("pair")}
                        class={`bare rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-fast ${
                          fixedIds().pair
                            ? "bg-primary text-on-primary"
                            : "bg-primary text-surface"
                        }`}
                      >
                        Promote release
                      </button>
                      <span class="font-mono text-xs text-text-muted">
                        {fixedIds().scale ? "padding: 1rem (p-4)" : "padding: 0px (p-13 dead)"}
                      </span>
                    </div>
                  </article>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-muted">
                  <span>
                    Runs in <code>oxlint</code>, <code>eslint</code>,{" "}
                    <code>spin lint</code>, and MCP.
                  </span>
                  <A href="/tooling/lints" class="font-semibold no-underline">
                    Explore the 6 lint gates →
                  </A>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Workbench 02: 59 Native Primitives & Interactive State Machines */}
        <Reveal>
          <section class="mt-12 rounded-lg border border-border bg-surface-raised p-6 md:p-8">
            <div class="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p class="m-0 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  02 / 59 Components · One Taxonomy
                </p>
                <h2 class="mt-1 mb-0 font-heading text-2xl font-bold text-text">
                  Native HTML where possible. State machines where required.
                </h2>
                <p class="mt-2 max-w-[62ch] text-sm text-text-muted">
                  A button is <code>&lt;button&gt;</code>, a dialog is{" "}
                  <code>&lt;dialog&gt;</code>, and a switch is a checkbox wearing{" "}
                  <code>role="switch"</code>. When an interface outgrows native
                  HTML — cascade selects, date pickers, tree views, signature
                  pads — Spin pairs accessible state machines with the exact
                  same token contract.
                </p>
              </div>
              <A href="/components" role="button" class="secondary s-sm no-underline">
                Browse all 59 components →
              </A>
            </div>

            {/* Category switcher tabs */}
            <div
              class="mt-6 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Component categories"
            >
              <For each={COMPONENT_GROUPS}>
                {(group, idx) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeGroupIdx() === idx()}
                    onClick={() => setActiveGroupIdx(idx())}
                    class={`bare inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-fast ${
                      activeGroupIdx() === idx()
                        ? "bg-primary text-on-primary"
                        : "border border-border bg-surface text-text-muted hover:text-text"
                    }`}
                  >
                    <span>{group.label}</span>
                    <span class="rounded-sm bg-surface-sunken px-1 font-mono text-xs text-text">
                      {group.items.length}
                    </span>
                  </button>
                )}
              </For>
            </div>

            {/* Direct links into the selected category's components */}
            <div class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <For
                each={
                  COMPONENT_GROUPS[activeGroupIdx()]?.items ??
                  COMPONENT_GROUPS[0]?.items ??
                  []
                }
              >
                {(item) => (
                  <A
                    href={item.href}
                    class="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-3 no-underline transition-colors duration-fast hover:border-border-strong"
                  >
                    <div class="flex min-w-0 items-center gap-2">
                      <span
                        class={`${item.icon} icon-sm shrink-0 text-primary`}
                        aria-hidden="true"
                      />
                      <span class="truncate text-sm font-medium text-text">
                        {item.name}
                      </span>
                    </div>
                    <span class="font-mono text-xs text-text-muted">
                      {item.href.includes("/machine-") ? "machine" : "primitive"}
                    </span>
                  </A>
                )}
              </For>
            </div>
          </section>
        </Reveal>

        {/* Workbench 03: Live Studio & Theme Contract */}
        <Reveal>
          <section class="mt-12 grid gap-6 rounded-lg border border-border bg-surface-raised p-6 md:grid-cols-2 md:p-8">
            <div class="flex flex-col justify-between gap-4">
              <div>
                <p class="m-0 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  03 / Live Theme Studio &amp; MCP
                </p>
                <h2 class="mt-1 mb-0 font-heading text-2xl font-bold text-text">
                  Edit tokens beside your running app.
                </h2>
                <p class="mt-2 text-sm text-text-muted">
                  The Spin daemon mounts the Theme Studio on the same origin as
                  your dev server and exposes an MCP server for coding agents.
                  Every token edit is checked against legibility and scale
                  floors before it writes <code>spin/*.json</code> back to disk.
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <button type="button" onClick={openStudioOverlay}>
                  Open Studio on this page
                </button>
                <A
                  href="/themes"
                  role="button"
                  class="secondary no-underline"
                >
                  Read the theme contract
                </A>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <A
                href="/why"
                class="flex flex-col justify-between rounded-md border border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong"
              >
                <div>
                  <p class="m-0 font-heading text-lg font-bold text-text">
                    Why Spin
                  </p>
                  <p class="mt-1 mb-0 text-xs text-text-muted">
                    Why code review misses one-word UI bugs, and how a closed
                    contract eliminates the class of failure.
                  </p>
                </div>
                <span class="mt-4 font-mono text-xs text-primary">
                  /why →
                </span>
              </A>

              <A
                href="/guide/install"
                class="flex flex-col justify-between rounded-md border border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong"
              >
                <div>
                  <p class="m-0 font-heading text-lg font-bold text-text">
                    Install &amp; Wiring
                  </p>
                  <p class="mt-1 mb-0 text-xs text-text-muted">
                    Add the Vite plugin, pick a starter theme, and drop
                    primitives or machines into Solid, React, or HTML.
                  </p>
                </div>
                <span class="mt-4 font-mono text-xs text-primary">
                  /guide/install →
                </span>
              </A>

              <A
                href="/utilities"
                class="flex flex-col justify-between rounded-md border border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong"
              >
                <div>
                  <p class="m-0 font-heading text-lg font-bold text-text">
                    Tokens &amp; Utilities
                  </p>
                  <p class="mt-1 mb-0 text-xs text-text-muted">
                    Inspect every CSS variable and utility class emitted by the
                    active starter in light and dark modes.
                  </p>
                </div>
                <span class="mt-4 font-mono text-xs text-primary">
                  /utilities →
                </span>
              </A>

              <A
                href="/tooling/mcp"
                class="flex flex-col justify-between rounded-md border border-border bg-surface p-4 no-underline transition-colors duration-fast hover:border-border-strong"
              >
                <div>
                  <p class="m-0 font-heading text-lg font-bold text-text">
                    MCP &amp; Agent Skill
                  </p>
                  <p class="mt-1 mb-0 text-xs text-text-muted">
                    Connect Claude or Cursor to the live project daemon so
                    agents query real tokens instead of guessing.
                  </p>
                </div>
                <span class="mt-4 font-mono text-xs text-primary">
                  /tooling/mcp →
                </span>
              </A>
            </div>
          </section>
        </Reveal>

        <footer class="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-xs text-text-muted">
          <Logo size="sm" class="text-text" />
          <span>
            Closed vocabulary · 5 starter themes · 59 components · mechanical
            verification
          </span>
        </footer>
      </div>
    </main>
  );
}
