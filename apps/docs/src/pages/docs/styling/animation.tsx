/**
 * Motion & Transitions: theme-backed durations, easing curves, entrance animations,
 * and automatic reduced-motion support.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { animationContract } from "@spinjs/preset";
import { PageHeader, Section, Specimen } from "../../../ui/index.ts";

const STATE_TRANSITION_SNIPPET = `<button
  type="button"
  aria-pressed="true"
  class="bare rounded-md border px-4 py-2 transition-colors duration-fast ease-standard aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary aria-[pressed=true]:text-on-primary"
>
  Notifications enabled
</button>`;

const ENTRANCE_SNIPPET = `<card class="animate-slide-up max-w-sm">
  <card-header>
    <card-title>Deployment ready</card-title>
    <card-description>Timed and eased by your active theme.</card-description>
  </card-header>
</card>`;

export default function StylingAnimation(): JSX.Element {
  const [enabled, setEnabled] = createSignal(true);
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
        title="Motion"
        lede="Durations, easing curves, and entrance animations driven by your theme, with automatic reduced-motion support."
      />

      <Section id="state-vs-entrances" title="State transitions and entrance animations">
        <p class="max-w-prose">
          Instead of scattering one-off millisecond numbers across templates,
          motion utilities read your theme's duration steps (
          <code>duration-fast</code>, <code>duration-base</code>,{" "}
          <code>duration-slow</code>) and easing curves (
          <code>ease-standard</code>, <code>ease-decelerate</code>). Pair
          transition classes for interactive state changes, or add an{" "}
          <code>animate-*</code> class when a card, toast, or dialog mounts:
        </p>

        <div class="my-3 flex flex-col gap-4">
          <Specimen
            title="Interactive state transition"
            code={STATE_TRANSITION_SNIPPET}
            preview={
              <button
                type="button"
                aria-pressed={enabled()}
                onClick={() => setEnabled((v) => !v)}
                class="bare cursor-pointer rounded-md border px-4 py-2 type-label transition-colors duration-fast ease-standard aria-[pressed=true]:border-primary aria-[pressed=true]:bg-primary aria-[pressed=true]:text-on-primary aria-[pressed=false]:bg-surface-raised"
              >
                {enabled() ? "Notifications enabled" : "Enable notifications"}
              </button>
            }
          />

          <Specimen
            title="Entrance animation"
            code={ENTRANCE_SNIPPET}
            controls={
              <button
                type="button"
                class="secondary s-sm"
                onClick={() => setEntranceKey((k) => k + 1)}
              >
                Replay entrance
              </button>
            }
            preview={
              <For each={[entranceKey()]}>
                {() => (
                  <card class="animate-slide-up w-full max-w-sm">
                    <card-header>
                      <card-title>Deployment ready</card-title>
                      <card-description>
                        Timed and eased by your active theme.
                      </card-description>
                    </card-header>
                  </card>
                )}
              </For>
            }
          />
        </div>
      </Section>

      <Section id="gallery" title="Built-in keyframe animations">
        <p class="max-w-prose">
          Click any animation class below to preview it live:
        </p>
        <div class="my-3 flex flex-col gap-3 rounded-lg border bg-surface-raised p-4">
          <div class="flex flex-wrap gap-2">
            <For each={animationContract.variants}>
              {(variant) => (
                <button
                  type="button"
                  class={
                    activeAnim() === variant
                      ? "primary s-sm type-code"
                      : "secondary s-sm type-code"
                  }
                  onClick={() => triggerAnimation(variant)}
                >
                  {variant}
                </button>
              )}
            </For>
          </div>
          <div class="flex min-h-32 items-center justify-center rounded-md border bg-surface p-6">
            <For each={[replayKey()]}>
              {() => (
                <div
                  class={`rounded-md border bg-surface-raised px-4 py-3 shadow-sm ${activeAnim()}`}
                >
                  <code>{activeAnim()}</code>
                </div>
              )}
            </For>
          </div>
        </div>
      </Section>

      <Section id="reduced-motion" title="Automatic reduced-motion protection">
        <p class="max-w-prose">
          Spin includes a global <code>prefers-reduced-motion: reduce</code>{" "}
          preflight out of the box. When a visitor enables reduced motion in
          their OS settings, animations and transitions collapse automatically
          without requiring extra utility classes on every component. To tune
          your brand's durations and bezier curves visually, open Motion in{" "}
          <A href="/studio">Theme Studio</A>.
        </p>
      </Section>
    </main>
  );
}
