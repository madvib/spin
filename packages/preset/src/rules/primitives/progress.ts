import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Progress — the `<progress>` element.
 *
 * A native element with a real value and a real indeterminate state, so no
 * JavaScript. What is hard about styling one is that it is the only control
 * with no cross-browser standard rendering: Chromium exposes
 * `::-webkit-progress-bar` and `::-webkit-progress-value`, Firefox exposes
 * `::-moz-progress-bar` and `::-moz-progress-value`. Neither engine reads the
 * other's, so both are stated.
 *
 * The difficulty is not the duplication — it is that **uno merges rules with
 * identical bodies into one selector list, and an unrecognised selector in a
 * list is not skipped, it discards the entire rule.** A merged rule carrying
 * `::-moz-progress-bar` therefore loses the element's `appearance`, height,
 * radius and inset depth in every browser that is not Firefox — silently, and
 * with the element still matching nothing else. Measured rather than assumed:
 * adding the moz pseudo-element to a working selector list turns it into a
 * no-op in Chromium, and removing it makes the same declarations apply.
 *
 * So every rule below states a declaration its siblings do not, which keeps
 * the bodies distinct enough that they are never merged. The differences are
 * real ones each engine needs, not padding to defeat a merge.
 *
 * Two opinions about the surface:
 *
 * **The track is a surface.** A groove with a lit inner edge, the same inset
 * depth a control gets, so a progress bar and a switch read as the same
 * material. Without it the bar is a hairline, and a hairline is not a shape a
 * reader can find on a page.
 *
 * **Indeterminate moves, because it does not know.** A static bar with no fill
 * is a bar that failed to load. The absence of a value is information, and
 * motion is how it is expressed. The keyframes belong to `@spin/animation`,
 * which owns every one in the system — a keyframe defined in a shakeable
 * component file is one that can ship without its definition.
 */
export function progressRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("progress")) return [];
  const progress = claim(mode, "progress");
  return [
    barRule(progress),
    ...indeterminateRule(progress),
    ariaBusyRule(),
  ];
}

function tokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    height: t?.spacing?.["1"],
    radius: t?.radius?.["full"],
    track: t?.colors?.["surface-raised"],
    primary: t?.colors?.["primary"],
    warning: t?.colors?.["semantic-warning"],
    error: t?.colors?.["semantic-error"],
    // A sweep is watched for the length of a load, not clicked through:
    // the motion ladder's steps are response times (150/250/400ms), and a
    // 150ms sweep is a strobe. The period is stated, like the skeleton's
    // dim floor, because no scale owns a loader's cycle.
    sweep: "1.6s",
  };
}

/**
 * The bar: its groove, its fill, and the indeterminate sweep.
 *
 * All of it yields from one rule because uno keeps only the first rule matching
 * a token, and a document only ever says `<progress>` — a `progress-value` rule
 * would never match, so the fill would never ship.
 */
function barRule(progress: string): Rule {
  return [
    /^progress$/,
    function* (_m, ctx) {
      const t = tokens(ctx);

      const track: Record<string, string | undefined> = {
        appearance: "none",
        display: "block",
        width: "100%",
        ...(t.height !== undefined ? { height: t.height } : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        // The groove is inset, so the bar reads as a channel the value travels
        // in rather than as a line drawn on the page.
        "box-shadow": "inset 0 1px 2px 0 rgba(0, 0, 0, 0.1)",
        ...(t.track !== undefined ? { "background-color": t.track } : {}),
      };

      // The element itself. `appearance: none` is what tells the engine to stop
      // painting a native widget and let the pseudo-elements be styled at all;
      // the vendor properties are here because that is where each engine looks
      // for them, and stating them here also keeps this body distinct from the
      // vendor rules' so they are never merged.
      yield {
        [ctx.symbols.selector]: () => progress,
        ...track,
        "-webkit-appearance": "none",
        "-moz-appearance": "none",
      };

      // Each engine's groove. The declarations that differ are ones the engine
      // actually needs rather than tokens to make the bodies differ.
      yield {
        [ctx.symbols.selector]: () => `${progress}::-webkit-progress-bar`,
        ...track,
        overflow: "hidden",
      };
      yield {
        [ctx.symbols.selector]: () => `${progress}::-moz-progress-bar`,
        ...track,
        "-moz-appearance": "none",
      };

      const fill: Record<string, string | undefined> = {
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.primary !== undefined ? { "background-color": t.primary } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${progress}::-webkit-progress-value`,
        ...fill,
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () => `${progress}::-moz-progress-value`,
        ...fill,
        "-moz-appearance": "none",
      };

      // Indeterminate. The motion is the state: a bar with no fill and no
      // movement is a bar that failed to load.
      //
      // The sweep is a gradient on `::-webkit-progress-bar` — the GROOVE, not
      // the fill and not the element. Measured on a blank page: a gradient on
      // the element paints nothing at all, and gradients on both the bar and
      // the value paint correctly. Three earlier attempts failed because the
      // groove carried the track's own opaque background from the rule above,
      // which covers the gradient painted onto it — so the indeterminate rule
      // has to take the groove's background away before it can put its own on.
      //
      // The value is emptied at the same time, because the platform draws its
      // own fill for an indeterminate bar and a fill plus a sweeping band reads
      // as two overlapping things.
      if (t.primary !== undefined) {
        const band = {
          "background-image": `linear-gradient(90deg, ${
            t.track ?? "transparent"
          } 0 30%, ${t.primary} 50% 70%, ${t.track ?? "transparent"} 90% 100%)`,
          "background-size": "300% 100%",
          "background-repeat": "no-repeat",
        };
        const motion = {
          animation: `progress-indeterminate ${t.sweep} linear infinite`,
        };

        yield {
          [ctx.symbols.selector]: () =>
            `${progress}:indeterminate::-webkit-progress-bar`,
          ...band,
          ...motion,
          "-webkit-appearance": "none",
        };
        yield {
          [ctx.symbols.selector]: () =>
            `${progress}:indeterminate::-webkit-progress-value`,
          "background-color": "transparent",
          "-webkit-appearance": "none",
        };
        yield {
          [ctx.symbols.selector]: () =>
            `${progress}:indeterminate::-moz-progress-bar`,
          ...band,
          ...motion,
          "-moz-appearance": "none",
        };
        yield {
          [ctx.symbols.selector]: () =>
            `${progress}:indeterminate::-moz-progress-value`,
          "background-color": "transparent",
          "-moz-appearance": "none",
        };
      }
    },
    { layer: "primitives", autocomplete: "progress" },
  ];
}

/**
 * The indeterminate bar.
 *
 * Its own rule, on its own token, because a selector that differs from the
 * track's only by `:indeterminate` is still the same rule to uno: one rule per
 * selector, and the track's yield was taking the groove, so the sweep never
 * applied at all. Split out, the two rules stop competing.
 *
 * Both entry points work — `:indeterminate` is the state the platform reports
 * for a `<progress>` with no value, and the token is what a consumer writes to
 * ask for one on any control.
 */
function indeterminateRule(progress: string): Rule[] {
  return [
    [
      /^(?:progress-indeterminate|progress-pending)$/,
      function* (_m, ctx) {
        const t = tokens(ctx);
        if (t.primary === undefined) return;
        // The gradient is assembled from custom properties the ELEMENT
        // declares, not from the references `themeOf` hands out. A `var()`
        // written inline into a gradient on a progress pseudo-element
        // computes to `none` in Chromium — measured on a blank page with this
        // exact shape: the rule is accepted, the gradient is computed, and
        // nothing paints. A property set on the element is inherited by its
        // pseudo-elements and substituted first, so it resolves. This is the
        // one place in the system a value is passed as a property rather than
        // as a reference, and the reason is a browser limitation rather than a
        // preference.
        const states =
          `${progress}:is(:indeterminate, .progress-indeterminate)`;
        yield {
          [ctx.symbols.selector]: () => states,
          "--progress-sweep-from": t.track ?? "transparent",
          "--progress-sweep-to": t.primary,
          "background-image":
            "linear-gradient(90deg, var(--progress-sweep-from) 0 30%, var(--progress-sweep-to) 50% 70%, var(--progress-sweep-from) 90% 100%)",
          "background-size": "300% 100%",
          "background-repeat": "no-repeat",
          animation: `progress-indeterminate ${t.sweep} linear infinite`,
        };
        const band = {};
        yield {
          [ctx.symbols.selector]: () => `${states}::-webkit-progress-bar`,
          ...band,
          "-webkit-appearance": "none",
        };
        yield {
          [ctx.symbols.selector]: () => `${states}::-moz-progress-bar`,
          ...band,
          "-moz-appearance": "none",
        };
        // The value is emptied because the platform draws its own fill for an
        // indeterminate bar, and a fill plus a travelling band reads as two
        // overlapping things.
        yield {
          [ctx.symbols.selector]: () => `${states}::-webkit-progress-value`,
          "background-color": "transparent",
          "-webkit-appearance": "none",
        };
        yield {
          [ctx.symbols.selector]: () => `${states}::-moz-progress-value`,
          "background-color": "transparent",
          "-moz-appearance": "none",
        };
      },
      { layer: "primitives", autocomplete: "progress-indeterminate" },
    ],
  ];
}

/**
 * `aria-busy` — the same state, for a region rather than a control.
 *
 * A container marked busy tells assistive technology its contents are
 * mid-update. The visual is a bar along its top edge, because that is where a
 * reader's attention already is, and a bar in the middle of a panel competes
 * with the content it is reporting on.
 */
function ariaBusyRule(): Rule {
  return [
    /^aria-busy$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => '[aria-busy="true"]',
        position: "relative",
      };
      const bar: Record<string, string | undefined> = {
        content: '""',
        position: "absolute",
        "inset-inline": "0",
        "inset-block-start": "0",
        ...(t.height !== undefined ? { height: t.height } : {}),
        ...(t.primary !== undefined ? { "background-color": t.primary } : {}),
      };
      Object.assign(bar, {
        transformOrigin: "left",
        animation: `progress-indeterminate ${t.sweep} linear infinite`,
      });
      yield {
        [ctx.symbols.selector]: () => '[aria-busy="true"]::before',
        ...bar,
      };
    },
    { layer: "primitives", autocomplete: "aria-busy" },
  ];
}
