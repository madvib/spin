/**
 * Animations & Motion: `motion.duration.*` and `motion.easing.*` tokens,
 * transition utilities, `@spinjs/spin/animation` keyframes, reduced-motion
 * clamping, and the 250ms continuous-loop safety floor.
 */
import { A } from "@solidjs/router";
import { createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { animationContract } from "@spinjs/spin/animation";
import {
  Chip,
  Code,
  PageHeader,
  PropList,
  Section,
  starterDoc,
  type PropEntry,
} from "../../../ui/index.ts";

const TRANSITION_SNIPPET = `<!-- State transitions spend motion.duration.* and motion.easing.* -->
<button
  type="button"
  class="bare rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text transition-colors duration-fast ease-standard hover:border-primary hover:text-primary"
>
  Hover transition
</button>

<!-- Entry and loop keyframes from @spinjs/spin/animation -->
<card class="animate-fade-in">
  <div class="flex items-center gap-4">
    <span class="i-lucide-loader icon-sm animate-spin text-primary" aria-hidden="true"></span>
    <span>Deploying preview...</span>
  </div>
</card>`;

const MOTION_JSON_SNIPPET = `{
  "motion": {
    "distance": { "$type": "dimension", "$value": "4px" },
    "duration": {
      "$type": "duration",
      "fast": { "$value": "120ms" },
      "base": { "$value": "180ms" },
      "slow": { "$value": "280ms" },
      "loop": { "$value": "1200ms" }
    },
    "easing": {
      "$type": "cubicBezier",
      "standard": { "$value": [0.2, 0, 0, 1] },
      "accelerate": { "$value": [0.3, 0, 1, 1] },
      "decelerate": { "$value": [0, 0, 0, 1] },
      "linear": { "$value": [0, 0, 1, 1] }
    }
  }
}`;

export default function StylingAnimation(): JSX.Element {
  const [activeAnim, setActiveAnim] = createSignal<string>(
    animationContract.variants[0] ?? "animate-fade-in",
  );
  const [replayKey, setReplayKey] = createSignal(0);

  const triggerAnimation = (variant: string) => {
    setActiveAnim(variant);
    setReplayKey((k) => k + 1);
  };

  const durationItems = (): readonly PropEntry[] => {
    const motion = (starterDoc().motion ?? {}) as Record<string, unknown>;
    const durations = (motion["duration"] ?? {}) as Record<string, unknown>;
    return Object.entries(durations)
      .filter(([key]) => !key.startsWith("$"))
      .map(([key, node]) => {
        const val =
          node && typeof node === "object" && "$value" in node
            ? String((node as Record<string, unknown>)["$value"])
            : "—";
        return {
          name: `duration-${key}`,
          badge: `motion.duration.${key}`,
          defaultValue: val,
          description: (
            <>
              Sets <code>transition-duration</code> /{" "}
              <code>animation-duration</code> to{" "}
              <code>var(--motion-duration-{key})</code> (currently{" "}
              <code>{val}</code> in the active starter).
            </>
          ),
        };
      });
  };

  const easingItems = (): readonly PropEntry[] => {
    const motion = (starterDoc().motion ?? {}) as Record<string, unknown>;
    const easings = (motion["easing"] ?? {}) as Record<string, unknown>;
    return Object.entries(easings)
      .filter(([key]) => !key.startsWith("$"))
      .map(([key, node]) => {
        const raw =
          node && typeof node === "object" && "$value" in node
            ? (node as Record<string, unknown>)["$value"]
            : undefined;
        const val = Array.isArray(raw)
          ? `cubic-bezier(${raw.join(", ")})`
          : raw !== undefined
          ? String(raw)
          : "—";
        return {
          name: `ease-${key}`,
          badge: `motion.easing.${key}`,
          defaultValue: val,
          description: (
            <>
              Sets <code>transition-timing-function</code> /{" "}
              <code>animation-timing-function</code> to{" "}
              <code>var(--motion-easing-{key})</code>.
            </>
          ),
        };
      });
  };

  return (
    <main class="flex flex-col">
      <PageHeader
        title="Animations & Motion"
        lede="Theme-driven transition utilities and @spinjs/spin/animation keyframes that spend your theme's motion.duration.* and motion.easing.* tokens, respect prefers-reduced-motion automatically, and enforce a 250ms floor on continuous loops."
      />

      <Section id="overview" title="How motion tokens drive transitions & keyframes">
        <p class="max-w-prose">
          Spin separates <em>what</em> animates (in markup) from{" "}
          <em>how fast and with what curve</em> it moves (in your{" "}
          <code>spin/*.json</code> theme). State transitions compose{" "}
          <code>transition-*</code> with <code>duration-*</code> and{" "}
          <code>ease-*</code> utilities, while entrance, exit, and status loops
          use the <code>animate-*</code> classes from{" "}
          <code>@spinjs/spin/animation</code>:
        </p>
        <Code
          code={TRANSITION_SNIPPET}
          lang="html"
          title="Transitions and keyframe utilities"
        />
        <Code
          code={MOTION_JSON_SNIPPET}
          lang="json"
          title="spin/default.json — motion.duration and motion.easing"
        />
      </Section>

      <Section id="keyframes" title="Keyframe utilities (@spinjs/spin/animation)">
        <p class="max-w-prose">
          Click any <code>animate-*</code> utility below to preview its keyframe
          against the active starter's motion tokens:
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">Available animate-* classes</p>
            <div class="flex flex-wrap gap-2">
              <For each={animationContract.variants}>
                {(variant) => (
                  <button
                    type="button"
                    onClick={() => triggerAnimation(variant)}
                    class={
                      activeAnim() === variant
                        ? "primary s-sm font-mono"
                        : "s-sm font-mono"
                    }
                  >
                    {variant}
                  </button>
                )}
              </For>
            </div>
            <div class="border-t border-border pt-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">CSS custom properties read</p>
              <div class="mt-2 flex flex-wrap gap-1">
                <For each={animationContract.reads}>
                  {(token) => <Chip>--{token}</Chip>}
                </For>
              </div>
            </div>
          </div>

          <div class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-6">
            <For each={[replayKey()]}>
              {() => (
                <div
                  class={`rounded-md border border-primary bg-surface-raised px-4 py-3 font-mono text-sm text-text shadow-sm ${activeAnim()}`}
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

      <Section id="durations" title="Duration utilities, live">
        <p class="max-w-prose">
          Declared <code>motion.duration.*</code> steps in the active starter
          theme:
        </p>
        <PropList items={durationItems()} />
      </Section>

      <Section id="easings" title="Easing utilities, live">
        <p class="max-w-prose">
          Declared <code>motion.easing.*</code> curves in the active starter
          theme:
        </p>
        <PropList items={easingItems()} />
      </Section>

      <Section id="safety" title="Reduced motion & the 250ms loop floor">
        <PropList
          items={[
            {
              name: "@media (prefers-reduced-motion: reduce)",
              badge: "theme preflight",
              description:
                "Emitted automatically in the theme layer: clamps transition and animation durations to 0.01ms and limits animation-iteration-count to 1 whenever the OS or browser requests reduced motion.",
            },
            {
              name: "motion.duration.loop >= 250ms",
              badge: "themeGate & check",
              description: (
                <>
                  Continuous loop animations faster than <code>250ms</code> (4 Hz)
                  fail both the build-time{" "}
                  <A href="/docs/themes/validation">motion theme check</A> and
                   the Playwright{" "}
                  <A href="/docs/tooling/check">strobe-animation browser check</A>.
                </>
              ),
            },
          ]}
        />
      </Section>
    </main>
  );
}
