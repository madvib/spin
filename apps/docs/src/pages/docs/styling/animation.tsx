/**
 * Motion guide (Stage D6): how motion works — theme-owned timing, transitions
 * for state vs. keyframes for entrances, automatic reduced-motion and loop
 * protection, and the interactive keyframe gallery.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { animationContract } from "@spinjs/spin/animation";
import {
  Code,
  PageHeader,
  Section,
} from "../../../ui/index.ts";

const THEME_MOTION_SNIPPET = `<button type="button" class="primary">
  Hover to feel the button transition
</button>

<card class="animate-slide-up">
  <card-header>
    <card-title>Deployment ready</card-title>
    <card-description>Arrives on the same theme curve.</card-description>
  </card-header>
</card>`;

const STATE_TRANSITION_SNIPPET = `<div
  tabindex="0"
  class="rounded-md border border-border bg-surface-raised px-4 py-3 text-text-muted transition-colors duration-fast ease-standard hover:border-primary hover:bg-surface"
>
  Hover or focus to transition state
</div>`;

const ENTRANCE_SNIPPET = `<card class="animate-fade-in">
  <div class="row-sm">
    <span class="i-lucide-check icon-sm text-primary" aria-hidden="true"></span>
    <span>Preview environment mounted</span>
  </div>
</card>`;

export default function StylingAnimation(): JSX.Element {
  const [themeDemoKey, setThemeDemoKey] = createSignal(0);
  const [entranceKey, setEntranceKey] = createSignal(0);
  const [activeAnim, setActiveAnim] = createSignal<string>(
    animationContract.variants[0] ?? "animate-fade-in",
  );
  const [replayKey, setReplayKey] = createSignal(0);

  const triggerAnimation = (variant: string) => {
    setActiveAnim(variant);
    setReplayKey((k) => k + 1);
  };

  return (
    <main class="flex flex-col">
      <PageHeader
        title="How does motion work?"
        lede="Add a transition or an entrance to an element and let your theme set the pace. Every hover state, dialog entrance, and loading indicator moves at the speed and curve your theme sets once — and stills automatically when a visitor asks for less motion."
      />

      <Section id="theme-motion" title="Motion comes from the theme">
        <p class="max-w-prose">
          Hover a button or mount a card and you never write millisecond values
          or cubic-bezier curves in your markup. How long things take and how
          they ease are set once in the theme, so every transition and entrance
          on the page agrees.
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5">
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="primary">
                Hover to feel the button transition
              </button>
              <button
                type="button"
                class="ghost s-sm"
                onClick={() => setThemeDemoKey((k) => k + 1)}
              >
                Replay card entrance
              </button>
            </div>
            <For each={[themeDemoKey()]}>
              {() => (
                <card class="animate-slide-up">
                  <card-header>
                    <card-title>Deployment ready</card-title>
                    <card-description>
                      Arrives on the same theme curve.
                    </card-description>
                  </card-header>
                </card>
              )}
            </For>
          </div>
          <Code
            code={THEME_MOTION_SNIPPET}
            lang="html"
            title="One button and one card, both paced by the active theme"
          />
        </div>

        <p class="max-w-prose">
          Change the theme&apos;s timing in the Studio or your theme file — or
          switch starter themes in the top bar right now — and both follow
          together (see the motion scale steps in the{" "}
          <A href="/docs/themes/reference#groups">Token Reference</A>).
        </p>
      </Section>

      <Section
        id="state-vs-entrances"
        title="Transitions for state, keyframes for entrances"
      >
        <p class="max-w-prose">
          Use transition utilities when an element stays on screen and changes
          state, and use a named entrance when an element arrives or asks for
          attention. State changes like <code>hover:</code> or an open/close
          toggle pair <code>transition-colors</code> with a speed step (
          <code>duration-fast</code>, <code>duration-base</code>) and a curve (
          <code>ease-standard</code>, <code>ease-decelerate</code>); mounting
          moments use a named entrance such as <code>animate-fade-in</code> or{" "}
          <code>animate-slide-up</code>.
        </p>

        <div class="my-2 grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-4">
            <div class="flex min-h-32 flex-col items-center justify-center rounded-md border border-border bg-surface-raised p-4">
              <div
                tabindex="0"
                class="cursor-pointer rounded-md border border-border bg-surface-raised px-4 py-3 text-text-muted transition-colors duration-fast ease-standard hover:border-primary hover:bg-surface"
              >
                Hover or focus to transition state
              </div>
            </div>
            <Code
              code={STATE_TRANSITION_SNIPPET}
              lang="html"
              title="State change — transition utilities"
            />
          </div>

          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-4">
            <div class="flex min-h-32 flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface-raised p-4">
              <For each={[entranceKey()]}>
                {() => (
                  <card class="animate-fade-in">
                    <div class="row-sm">
                      <span
                        class="i-lucide-check icon-sm text-primary"
                        aria-hidden="true"
                      />
                      <span>Preview environment mounted</span>
                    </div>
                  </card>
                )}
              </For>
              <button
                type="button"
                class="ghost s-sm"
                onClick={() => setEntranceKey((k) => k + 1)}
              >
                Replay animate-fade-in
              </button>
            </div>
            <Code
              code={ENTRANCE_SNIPPET}
              lang="html"
              title="Mounting moment — named entrance"
            />
          </div>
        </div>
      </Section>

      <Section id="respect" title="Respect is automatic">
        <p class="max-w-prose">
          Turn on reduced motion in your operating system or browser and every
          transition and entrance on the page settles immediately without a
          single media-query class in your markup: your visitors who asked for
          less motion get it through{" "}
          <code>@media (prefers-reduced-motion: reduce)</code>, and continuous
          loops like <code>animate-spin</code> and <code>animate-pulse</code>{" "}
          carry a <code>250ms</code> floor so loops that could strobe
          can&apos;t. Both guarantees are verified automatically by{" "}
          <A href="/docs/themes/validation">theme validation</A> and{" "}
          <A href="/docs/tooling/check">browser checks</A>.
        </p>

        <div class="my-2 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-raised px-4 py-3">
          <div class="row-sm">
            <span
              class="i-lucide-loader icon-sm animate-spin text-primary"
              aria-hidden="true"
            />
            <code>animate-spin</code>
          </div>
          <div class="row-sm">
            <span
              class="inline-block h-3 w-3 rounded-full bg-primary text-on-primary animate-pulse"
              aria-hidden="true"
            />
            <code>animate-pulse</code>
          </div>
          <span class="text-text-muted type-caption">
            Paced at the theme&apos;s loop step (&ge; <code>250ms</code>) and
            stopped under <code>@media (prefers-reduced-motion: reduce)</code>.
          </span>
        </div>
      </Section>

      <Section id="keyframes" title="Every entrance and loop, live">
        <p class="max-w-prose">
          Click any class below to preview every entrance and loop the system
          ships against the active theme.
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface-raised p-4">
            <div class="flex flex-wrap gap-2">
              <For each={animationContract.variants}>
                {(variant) => (
                  <button
                    type="button"
                    onClick={() => triggerAnimation(variant)}
                    class={
                      activeAnim() === variant
                        ? "primary s-sm type-code"
                        : "s-sm type-code"
                    }
                  >
                    {variant}
                  </button>
                )}
              </For>
            </div>
            <Code
              code={`<div class="${activeAnim()}">\n  ${activeAnim()}\n</div>`}
              lang="html"
              title="Selected class"
            />
          </div>

          <div class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-6">
            <For each={[replayKey()]}>
              {() => (
                <div
                  class={`rounded-md border border-primary bg-surface-raised px-4 py-3   shadow-sm ${activeAnim()}`}
                >
                  {activeAnim()}
                </div>
              )}
            </For>
            <button
              type="button"
              onClick={() => setReplayKey((k) => k + 1)}
              class="ghost s-sm"
            >
              Replay {activeAnim()}
            </button>
          </div>
        </div>
      </Section>
    </main>
  );
}
