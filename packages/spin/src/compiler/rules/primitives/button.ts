import type { Rule } from "@unocss/core";
import { named, type ThemeContext, token } from "../../utils/lookup.ts";
import type { ThemeTokenPath } from "../../../theme/theme-types.d.ts";
import {
  ALIVE,
  disabledPosture,
  type Entry,
  focusPaint,
  focusRing,
  spend,
  spentEntries,
  withFallback,
} from "./shared.ts";

/**
 * The button as generated rules.
 *
 * A button is no longer a stylesheet — it is a rule set, generated from the
 * own contract. The manifest is DERIVED from the rules — it records what they
 * claim and what they spend, so it cannot disagree with them.
 * `tags` decide which element rules exist, its `variants` decide which variant
 * rules exist, and its `component` decides which tokens the rules spend. The
 * declarations themselves are the component's behaviour, authored here.
 *
 * The element extractor (registered beside this preset) turns a `<button>` tag
 * into the token `button`, so a classless button is styled with no class at
 * all. A variant is a standalone token — `class="secondary"` alone pulls in
 * the variant rule, and `<button class="secondary">` pulls in both the base
 * (matched by the `button` tag) and the variant.
 *
 * Each element rule is a generator: uno keeps only the first rule that matches
 * a token, so the base, its states and the reset fall-through are yielded from
 * one rule rather than spread across many. The symbols come from the rule
 * context (`ctx.symbols`) — inside a generator the module-level symbol is
 * ignored and uno emits the default `.name` selector instead.
 *
 * Layers carry the ordering, not specificity: every rule here is in the
 * `primitives` layer, so a variant beats the base by source order and a
 * utility in the default layer beats both.
 *
 * The icon slot and the group join are rules, not a preflight. Both are
 * things an author writes — a `.button-icon` class, a `<span role="group">` —
 * and a rule emits them only when they appear, which is the whole point of
 * the migration: only the variants a page actually uses are emitted. The
 * group join's child-combinator selectors are separate yields for the same
 * reason: uno core does not expand a nested `&` in a rule body.
 */

/**
 * The elements a button can be. The manifest's `tags` claims `button` and
 * `span`; `button` is the control, `span` is the group container. The
 * attribute selectors are the input types and the ARIA role a styled link or
 * div becomes.
 */
const BUTTON =
  ':is(button, [type="submit"], [type="reset"], [type="button"], [role="button"])';

/**
 * The contrast variant omits `[type="reset"]`: a reset button is a secondary
 * action by what the browser means by it, never the loudest control on the
 * page, so it is excluded from the one variant that is.
 */
const CONTRAST =
  ':is(button, [type="submit"], [type="button"], [role="button"])';

/** The group container a joined control lives in. */
const GROUP = 'span[role="group"]';

/** The property each component token step sets. */
const COMPONENT_PROPERTY: Record<string, string> = {
  shadow: "box-shadow",
  "shadow-hover": "box-shadow",
  edge: "border-color",
  radius: "border-radius",
};

/**
 * The component tokens this component OWNS, and which rule spends each.
 *
 * Declared here rather than read from the manifest, for two reasons. The
 * manifest is derived FROM this file, so reading it back is circular — a
 * variant or a component step that the manifest happened to omit would then
 * delete the rule that declared it, silently. And the split below is a
 * decision about which rule spends what: the base spends everything but the
 * hover shadow, hover spends the hover shadow alone, and the resting shadow is
 * re-spent by the pressed state. Deriving that by filtering a flat list is how
 * it ends up meaning three different things in three places.
 *
 * The dead state spends NO component token: a control that cannot be pressed
 * wears no elevation, and a shadow is the shape of a control that can be.
 *
 * A union, so a step that is not declared cannot be spent, and adding one here
 * is a compile error rather than a silent omission from the contract.
 */
type ComponentStep =
  | "shadow"
  | "shadow-hover"
  | "edge"
  | "radius";

const COMPONENT_STEPS: readonly ComponentStep[] = [
  "shadow",
  "shadow-hover",
  "edge",
  "radius",
];

/** The component step the base rule spends — all but the hover shadow. */
const BASE_COMPONENT_STEPS = COMPONENT_STEPS.filter((step) =>
  step !== "shadow-hover"
);

/** The component step the hover rule spends. */
const HOVER_COMPONENT_STEPS = COMPONENT_STEPS.filter((step) =>
  step === "shadow-hover"
);

/** The resting shadow step, re-spent by the active rule. */
const SHADOW_COMPONENT_STEPS = COMPONENT_STEPS.filter((step) =>
  step === "shadow"
);

/**
 * The shared scale a component step falls back to when a theme omits it.
 *
 * The label's type is the label style's business, so no type step needs a
 * fallback here: the base reads the style outright. The rest — the edge,
 * the corner — fall back to the shared scales they would otherwise wear.
 */
const COMPONENT_FALLBACK: Partial<Record<ComponentStep, ThemeTokenPath>> = {
  edge: "color.border",
  radius: "radius.md",
};

/**
 * The variant names, in the order they are offered.
 *
 * The source of truth for what an author may type on a button. `VARIANTS` is
 * keyed by these, the derivation walks the rules it builds, and the manifest
 * records the result — so a variant cannot be added to one and forgotten in
 * another, which is the whole point of deriving rather than listing.
 */
const VARIANT_NAMES = [
  "bare",
  "primary",
  "secondary",
  "outline",
  "ghost",
  "contrast",
  "danger",
  "s-sm",
  "s-lg",
  "icon",
  // The icon slot is a class on a CHILD of the control rather than a variant
  // on it, so it has no entry in VARIANTS — but it is still a class an author
  // may type, so it belongs in the vocabulary the derivation records.
  "button-icon",
] as const;

/** The variants that carry a declaration, keyed into VARIANTS below. */
type PaintedVariant = Exclude<VariantName, typeof ICON_SLOT>;

type VariantName = (typeof VARIANT_NAMES)[number];

/** The icon slot's name. A class on a CHILD, so it has no VARIANTS entry. */
const ICON_SLOT = "button-icon" satisfies VariantName;

/**
 * A variant's shape: the group it paints, the class an author writes, and
 * what it states.
 *
 * The class is the ordinary way in; the attribute is the same opt-in for a
 * document that carries its variants as data. Both spellings are the SAME
 * variant, so every rule a variant states has to reach both — including the
 * one it states for a dead control.
 */
interface VariantShape {
  /** The element group the variant paints. */
  readonly group: string;
  /** The class an author writes. */
  readonly name: string;
  /**
   * True when the variant states a colour of its own.
   *
   * Such a variant has to say what a dead version of itself wears: the base
   * paints the posture for a dead control, but a variant's own ink would win
   * over it — a dead outline button would keep its accent ink, which is the
   * one thing the posture exists to replace.
   */
  readonly inked: boolean;
  readonly body: (
    ctx: ThemeContext | undefined,
  ) => Record<string, string | undefined>;
}

/** A variant's selector: the class, and the attribute form of the same. */
function variantSelector(variant: VariantShape): string {
  return `${variant.group}.${variant.name}, ${variant.group}[variant~="${variant.name}"]`;
}

/**
 * The same variant, in the state a dead control is in.
 *
 * The dead state is its own selector rather than a suffix on the variant's:
 * a suffix appended to a comma list reaches only the last alternative, so
 * `A, B:disabled` would style B when it is disabled and A always.
 */
function deadVariantSelector(variant: VariantShape): string {
  const dead = ':is(:disabled, [aria-disabled="true"])';
  return `${variant.group}.${variant.name}${dead}, ${variant.group}[variant~="${variant.name}"]${dead}`;
}

/**
 * The variant declarations, keyed by variant name.
 */
const VARIANTS: Record<PaintedVariant, VariantShape> = {
  bare: {
    group: BUTTON,
    name: "bare",
    inked: false,
    body: () => ({
      cursor: "pointer",
      "min-height": "0",
    }),
  },
  primary: {
    group: BUTTON,
    name: "primary",
    inked: true,
    body: (ctx) => ({
      "background-color": token(ctx, "color.primary"),
      "border-color": token(ctx, "color.primary"),
      color: token(ctx, "color.on-primary"),
    }),
  },
  secondary: {
    group: BUTTON,
    name: "secondary",
    inked: true,
    body: (ctx) => ({
      "background-color": token(ctx, "color.secondary"),
      "border-color": token(ctx, "color.border"),
      color: token(ctx, "color.on-secondary"),
    }),
  },
  ghost: {
    group: BUTTON,
    name: "ghost",
    inked: true,
    body: (ctx) => ({
      "background-color": "transparent",
      "border-color": "transparent",
      // A ghost is paint-free: no fill, no edge, and no shadow either. The
      // base rule spends the theme's shadow, and a neobrut theme's shadow is
      // a hard offset — a ghost carrying it is a black box floating over an
      // empty button.
      "box-shadow": "none",
      color: token(ctx, "color.text"),
    }),
  },
  danger: {
    group: BUTTON,
    name: "danger",
    inked: true,
    body: (ctx) => ({
      "background-color": token(ctx, "color.semantic.error"),
      "border-color": token(ctx, "color.semantic.error"),
      color: token(ctx, "color.on-semantic-error"),
    }),
  },
  contrast: {
    group: CONTRAST,
    name: "contrast",
    inked: true,
    body: (ctx) => ({
      "background-color": token(ctx, "color.text"),
      "border-color": token(ctx, "color.text"),
      color: token(ctx, "color.surface"),
    }),
  },
  outline: {
    group: BUTTON,
    name: "outline",
    inked: true,
    body: (ctx) => ({
      "background-color": "transparent",
      // An outline is an edge and nothing else: no fill, so no shadow — the
      // same reason ghost spends none. Without this the theme's shadow hangs
      // off an empty box (a hard offset in neobrut).
      "box-shadow": "none",
      // The edge is the theme's accent: the mark. The LABEL is the page's
      // ink, because an accent is a FILL — it is legible with its own ink on
      // it, and not legible as a word on the page (neobrut's amber measures
      // 1.76:1 on its own sky). Every variant with no fill wears the page's
      // ink; this one wore a fill colour, which is a pairing the contract
      // does not promise.
      "border-color": token(ctx, "color.accent"),
      color: token(ctx, "color.text"),
    }),
  },
  "s-sm": {
    group: BUTTON,
    name: "s-sm",
    inked: false,
    body: (ctx) => {
      const fontSize = token(ctx, "font.size.sm");
      const spacing1 = token(ctx, "spacing.1");
      const spacing2 = token(ctx, "spacing.2");
      const borderWidth = token(ctx, "border.width");
      return {
        "padding-inline-start": spacing2,
        "padding-inline-end": spacing2,
        "padding-top": spacing1,
        "padding-bottom": spacing1,
        "font-size": fontSize,
        ...(fontSize !== undefined && spacing1 !== undefined &&
            borderWidth !== undefined
          ? {
            "min-height":
              `calc(${fontSize} + (2 * ${spacing1}) + (2 * ${borderWidth}))`,
          }
          : {}),
      };
    },
  },
  "s-lg": {
    group: BUTTON,
    name: "s-lg",
    inked: false,
    body: (ctx) => {
      const fontSize = token(ctx, "font.size.lg");
      const spacing4 = token(ctx, "spacing.4");
      const spacing8 = token(ctx, "spacing.8");
      const borderWidth = token(ctx, "border.width");
      return {
        "padding-inline-start": spacing8,
        "padding-inline-end": spacing8,
        "padding-top": spacing4,
        "padding-bottom": spacing4,
        "font-size": fontSize,
        ...(fontSize !== undefined && spacing4 !== undefined &&
            borderWidth !== undefined
          ? {
            "min-height":
              `calc(${fontSize} + (2 * ${spacing4}) + (2 * ${borderWidth}))`,
          }
          : {}),
      };
    },
  },
  icon: {
    group: BUTTON,
    name: "icon",
    inked: false,
    body: () => ({
      width: "auto",
      "padding-inline": "0",
      "aspect-ratio": "1",
    }),
  },
};

/**
 * The variant-specific hover rules. A variant whose hover holds its tokens
 * needs its own yield — the base hover would otherwise restyle it.
 */
const VARIANT_HOVER: Record<string, {
  selector: string;
  body: (ctx: ThemeContext | undefined) => Record<string, string | undefined>;
}> = {
  ghost: {
    // The base's hover spends `button.shadow-hover` — a theme's lift, which in
    // neobrut is a hard offset. A control that opts out of the paint has no
    // object to lift, so its hover states the same shadow it rests with. The
    // base selector cannot be narrowed from here, so the opt-out repeats it
    // and adds the one thing it is entitled to change.
    selector: `${BUTTON}.ghost:hover${ALIVE}:not([aria-busy="true"])`,
    body: (ctx) => ({
      "background-color": "transparent",
      "border-color": "transparent",
      "box-shadow": "none",
      color: token(ctx, "color.text"),
    }),
  },
  outline: {
    selector: `${BUTTON}.outline:hover${ALIVE}:not([aria-busy="true"])`,
    // The hover answers the accent: the edge fills in and the label takes the
    // accent's OWN ink, which is the pairing the contract floors. A hover
    // that put a fill colour on the page as a word would fail the same way
    // the resting label did.
    body: (ctx) => ({
      "background-color": token(ctx, "color.accent"),
      "box-shadow": "none",
      "border-color": token(ctx, "color.accent"),
      color: token(ctx, "color.on-accent"),
    }),
  },
  bare: {
    selector: `${BUTTON}.bare:hover${ALIVE}:not([aria-busy="true"])`,
    body: () => ({
      "box-shadow": "none",
      transform: "none",
    }),
  },
};

/**
 * The variant-specific focus rules.
 *
 * A variant that owns its own EDGE has to say what that edge wears while the
 * control is focused. The base's focus rule gives every control the ring's
 * ink, which is right for a control whose edge is its own — but a ghost has
 * no edge of its own: it is paint-free, and a ring-coloured border beside the
 * ring would be the second edge the ring exists to replace.
 */
const VARIANT_FOCUS: Record<string, {
  selector: string;
  body: (ctx: ThemeContext | undefined) => Record<string, string | undefined>;
}> = {
  ghost: {
    selector: `${BUTTON}.ghost:focus-visible${ALIVE}`,
    body: () => ({ "border-color": "transparent" }),
  },
};

/**
 * The button's rules. `roots` decides whether the button is enabled at all —
 * the preset's `primitives` option is the only switch, and a component that
 * is not enabled ships no rules.
 */
export function buttonRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("button")) return [];
  return [
    // ---------- the button element ----------
    // One rule for the control: the base, its states, and the reset
    // fall-through are yielded together because uno keeps only the first rule
    // that matches a token.
    [
      /^button$/,
      function* (_m, ctx) {
        // The base's tokens, read from the theme. One the theme omits reads
        // as undefined: the engine drops a single-token declaration, and a
        // compound one states itself only when every token in it resolves.
        const spacing2 = token(ctx, "spacing.2");
        const spacing4 = token(ctx, "spacing.4");
        const fontFamily = token(ctx, "font.family.sans");
        const fontSize = token(ctx, "font.size.md");
        // The label reads the label style outright: a control's type is a
        // style attachment, not three atoms of its own.
        const labelWeight = withFallback(ctx, "font.style.label.weight", "font.weight.semibold");
        const labelTracking = withFallback(ctx, "font.style.label.tracking", "font.tracking.normal");
        const borderWidth = token(ctx, "border.width");
        const surfaceRaised = token(ctx, "color.surface-raised");
        const text = token(ctx, "color.text");
        const duration = token(ctx, "motion.duration.fast");
        const easing = token(ctx, "motion.easing.standard");
        // The base. An array body because the rule states longhand border and
        // shadow entries beside the shorthand-free component spends.
        yield [
          [ctx.symbols.selector, () => BUTTON],
          ["align-items", "center"],
          ["justify-content", "center"],
          ["display", "inline-flex"],
          ["text-align", "center"],
          ["text-decoration", "none"],
          ["white-space", "nowrap"],
          ["cursor", "pointer"],
          ["user-select", "none"],
          ["box-sizing", "border-box"],
          ["vertical-align", "middle"],
          ["padding-inline-start", spacing4],
          ["padding-inline-end", spacing4],
          ["padding-top", spacing2],
          ["padding-bottom", spacing2],
          ["gap", spacing2],
          ["font-family", fontFamily],
          ["font-size", fontSize],
          ["font-weight", labelWeight],
          ["letter-spacing", labelTracking],
          ["line-height", "1"],
          ...(fontSize !== undefined && spacing2 !== undefined &&
              borderWidth !== undefined
            ? ([[
              "min-height",
              `calc(${fontSize} + (2 * ${spacing2}) + (2 * ${borderWidth}))`,
            ]] as Entry[])
            : []),
          ...spentEntries(
            spend(
              ctx,
              "button",
              COMPONENT_PROPERTY,
              COMPONENT_FALLBACK,
              ...BASE_COMPONENT_STEPS,
            ),
          ),
          // The edge's width is the theme's stroke; its ink is the `edge`
          // step (falling back to the shared divider), spent by the base's
          // component tokens above. The fill never frames itself: a primary
          // whose edge is its own fill wears an invisible border, and the
          // secondary beside it cannot match a border that isn't there.
          ...(borderWidth !== undefined
            ? ([["border-width", borderWidth], ["border-style", "solid"]] as Entry[])
            : []),
          ["background-color", surfaceRaised],
          ["color", text],
          ["-webkit-tap-highlight-color", "transparent"],
          ["touch-action", "manipulation"],
          // One transition list for everything the states animate: the same
          // list the `transition` utility spends, so a control and a utility
          // transition travel together. The hover spends a new shadow and an
          // opt-in lift, and both must travel — a list that names only
          // transform snaps the shadow.
          [
            "transition-property",
            "color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, translate, scale, rotate",
          ],
          ["transition-duration", duration],
          ["transition-timing-function", easing],
        ];
        // Hover is theme-defined feedback: the shadow step and the opt-in lift.
        // A theme that states no lift gets no transform — the no-movement
        // default the variable fallbacks declared, kept by omission rather
        // than by spelling zero.
        const liftX = named(ctx, "button", "hover-lift-x");
        const liftY = named(ctx, "button", "hover-lift-y");
        yield {
          [ctx.symbols.selector]: () =>
            `${BUTTON}:hover${ALIVE}:not([aria-busy="true"])`,
          ...spend(
            ctx,
            "button",
            COMPONENT_PROPERTY,
            COMPONENT_FALLBACK,
            ...HOVER_COMPONENT_STEPS,
          ),
          ...(liftX !== undefined && liftY !== undefined
            ? { transform: `translate(${liftX}, ${liftY})` }
            : {}),
        };
        // Active cancels the hover lift so the control reads as pushed in.
        yield {
          [ctx.symbols.selector]: () =>
            `${BUTTON}:active${ALIVE}:not([aria-busy="true"])`,
          ...spend(
            ctx,
            "button",
            COMPONENT_PROPERTY,
            COMPONENT_FALLBACK,
            ...SHADOW_COMPONENT_STEPS,
          ),
          transform: "translate(0, 0)",
        };
        // The ring, drawn on focus-visible so a mouse press leaves none. Its
        // width and offset come from the theme's focus scale; a theme that
        // states none gets no ring rather than an outline of undefined width.
        //
        // And the ring is the control's edge: the button's own border takes
        // the ring's ink while it is focused, so the reader sees one edge in
        // the theme's focus colour rather than the button's own edge with a
        // second band beside it.
        const ring = focusRing(ctx);
        yield {
          [ctx.symbols.selector]: () => `${BUTTON}:focus-visible${ALIVE}`,
          ...focusPaint(ring),
        };
        // Remove the UA default ring only where :focus-visible is supported.
        yield {
          [ctx.symbols.selector]: () => `${BUTTON}:focus:not(:focus-visible)`,
          outline: "none",
        };
        // The same ring for engines without :focus-visible. A rule cannot be
        // wrapped in `@supports` from its body, so the parent symbol carries
        // the at-rule and the selector symbol the fallback selector.
        yield {
          [ctx.symbols.parent]: "@supports not selector(:focus-visible)",
          [ctx.symbols.selector]: () => `button:focus${ALIVE}`,
          ...focusPaint(ring),
        };
        // A dead control wears a posture, not a dim.
        //
        // Dimming spent opacity on the WHOLE control, so the ink dimmed with
        // the fill: a white label on a blue button measured 1.56:1 — a button
        // nobody can read, in the one state a reader is most likely to reach
        // for by mistake. The posture is a PAIR the theme states, so a dead
        // control is muted and still legible.
        //
        // And it is dead: no shadow (the theme's resting elevation is the
        // shape of a control that can be pressed), no lift (the hover rule
        // leaves dead controls alone), and no ring.
        yield {
          [ctx.symbols.selector]: () =>
            `${BUTTON}:disabled, ${BUTTON}[aria-disabled="true"]`,
          ...disabledPosture(ctx),
          "box-shadow": "none",
          cursor: "not-allowed",
          transform: "none",
        };
        // Busy keeps its width so a row of buttons does not reflow.
        yield {
          [ctx.symbols.selector]: () => `${BUTTON}[aria-busy="true"]`,
          cursor: "progress",
        };
        // The spinner is a border trick, so it inherits currentColor for free.
        yield {
          [ctx.symbols.selector]: () => `${BUTTON}[aria-busy="true"]::after`,
          content: '""',
          "box-sizing": "border-box",
          width: "1em",
          height: "1em",
          flex: "none",
          border: "2px solid currentColor",
          "border-block-start-color": "transparent",
          "border-radius": "50%",
          ...(duration !== undefined
            ? { animation: `spin calc(${duration} * 4) linear infinite` }
            : {}),
        };
        // The busy state suppresses the icon slot.
        yield {
          [ctx.symbols.selector]: () =>
            `${BUTTON}[aria-busy="true"] > .button-icon`,
          display: "none",
        };
        // A reset button is a secondary action by what the browser means by
        // it, so it reads as one without a class. The `[type="reset"]`
        // selector is specific enough to beat the base rule.
        yield {
          [ctx.symbols.selector]: () => '[type="reset"]',
          "background-color": token(ctx, "color.surface-raised"),
          "border-color": token(ctx, "color.border"),
          // The secondary's resting posture as well as its look: a reset
          // button's fill is a surface, and the base's resting shadow is the
          // loud variant's shout — a surface-filled button floating on
          // itself reads as a second primary action in a hard-edged theme.
          "box-shadow": "none",
          color: token(ctx, "color.text"),
        };
        yield {
          [ctx.symbols.selector]: () => '[type="reset"].outline',
          "background-color": "transparent",
          "border-color": token(ctx, "color.accent"),
          color: token(ctx, "color.primary"),
        };
        yield {
          [ctx.symbols.selector]: () => `[type="reset"].outline:hover${ALIVE}`,
          "background-color": token(ctx, "color.primary"),
          color: token(ctx, "color.on-primary"),
        };
      },
      { layer: "primitives", autocomplete: "button" },
    ],

    // ---------- variants ----------
    // One rule per variant the manifest declares, each scoped to the button's
    // element group. The icon slot is the one variant that is not a button
    // variant — a class on a child element — so it gets the plain class.
    ...VARIANT_NAMES.flatMap((variant): Rule[] => {
      if (variant === ICON_SLOT) {
        return [
          [
            /^button-icon$/,
            (_m, ctx) => {
              // The glyph size is the theme's `icon.md`, spent as a font-size.
              // The icon class sizes itself `1em` in the `icons` layer, which
              // outranks this one at equal specificity, so a width or height
              // stated here would be dead the moment an icon class is present;
              // the font-size is the one declaration that reaches the glyph. In
              // `em`, so the glyph tracks the button's font-size across all
              // three of its sizes — the slot's sizing is a token now.
              const size = token(ctx, "icon.md");
              return {
                [ctx.symbols.selector]: () => ".button-icon",
                display: "inline-block",
                "flex": "none",
                ...(size !== undefined ? { "font-size": size } : {}),
                "background-color": "currentColor",
              };
            },
            { layer: "primitives", autocomplete: "button-icon" },
          ],
        ];
      }
      // No undefined check: `VARIANTS` is keyed by `PaintedVariant`, so the
      // type already says a painted variant has a declaration. A lookup that
      // can miss is a lookup that can silently drop a variant.
      const def = VARIANTS[variant];
      const hover = VARIANT_HOVER[variant];
      const focus = VARIANT_FOCUS[variant];
      const rule: Rule = [
        new RegExp(`^${variant}$`),
        function* (_m, ctx) {
          yield {
            [ctx.symbols.selector]: () => variantSelector(def),
            ...def.body(ctx),
          };
          // The paint and voice reset live one selector lighter than the
          // variant: at `:is(button, …).bare` (0,2,0) they would beat every
          // single-class utility, freezing the fill, edge, ink and face of
          // the control that opts out to paint itself. Here they beat the
          // base by source order and lose to utilities the same way.
          if (variant === "bare") {
            yield {
              [ctx.symbols.selector]: () => `.bare, [variant~="bare"]`,
              background: "transparent",
              // A reset that leaves the base's edge and rounding in place is
              // not a reset: a bare control that recolors its edge would
              // inherit a 1px rounded rect it never asked for. Zero both;
              // utilities that want an edge state their own width and shape.
              "border-width": "0",
              "border-color": "transparent",
              "border-radius": "0",
              "box-shadow": "none",
              color: "inherit",
              cursor: "pointer",
              "min-height": "0",
              "font-weight": "normal",
              "text-transform": "none",
              "letter-spacing": "normal",
            };
          }
          // A dead variant wears the posture: the same fill and the same ink
          // whatever it was. The rule is its own rather than the base's,
          // because a variant's own ink is as specific as the base's dead
          // rule and would win over it — a dead outline button would keep
          // its accent ink, which is the one thing the posture replaces.
          if (def.inked) {
            yield {
              [ctx.symbols.selector]: () => deadVariantSelector(def),
              ...disabledPosture(ctx),
            };
          }
          if (hover !== undefined) {
            yield {
              [ctx.symbols.selector]: () => hover.selector,
              ...hover.body(ctx),
            };
          }
          // A variant whose edge is its own says what that edge wears while
          // the control is focused.
          if (focus !== undefined) {
            yield {
              [ctx.symbols.selector]: () => focus.selector,
              ...focus.body(ctx),
            };
            // And the same for engines without :focus-visible, where the
            // base's fallback puts the ring's ink on the edge.
            yield {
              [ctx.symbols.parent]: "@supports not selector(:focus-visible)",
              [ctx.symbols.selector]: () =>
                `${BUTTON}.${def.name}:focus${ALIVE}`,
              ...focus.body(ctx),
            };
          }
        },
        { layer: "primitives", autocomplete: variant },
      ];
      return [rule];
    }),

    // ---------- the group join ----------
    // A joined control. Children lose their own radii and their adjacent
    // borders are collapsed, so the group reads as one object. Each
    // child-combinator selector is its own yield matched on the `span` tag.
    [
      /^span$/,
      function* (_m, ctx) {
        const borderWidth = token(ctx, "border.width");
        yield {
          [ctx.symbols.selector]: () => GROUP,
          display: "inline-flex",
          "align-items": "stretch",
        };
        yield {
          [ctx.symbols.selector]: () => `${GROUP} > button`,
          "border-radius": 0,
          ...(borderWidth !== undefined
            ? { "margin-inline-start": `calc(-1 * ${borderWidth})` }
            : {}),
        };
        yield {
          [ctx.symbols.selector]: () => `${GROUP} > button:first-child`,
          "margin-inline-start": 0,
          "border-start-start-radius": token(ctx, "radius.md"),
          "border-end-start-radius": token(ctx, "radius.md"),
        };
        yield {
          [ctx.symbols.selector]: () => `${GROUP} > button:last-child`,
          "border-start-end-radius": token(ctx, "radius.md"),
          "border-end-end-radius": token(ctx, "radius.md"),
        };
        yield {
          [ctx.symbols.selector]: () => `${GROUP} > button:hover`,
          "z-index": 1,
        };
        yield {
          [ctx.symbols.selector]: () =>
            `${GROUP} > button[aria-pressed="true"]`,
          "background-color": token(ctx, "color.primary"),
          color: token(ctx, "color.on-primary"),
          "border-color": token(ctx, "color.primary"),
          "z-index": 1,
        };
      },
      { layer: "primitives", autocomplete: "span" },
    ],
  ];
}
