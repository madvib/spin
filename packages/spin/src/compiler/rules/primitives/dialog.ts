import type { SpinRule } from "../../utils/lookup.ts";
import type { ThemeContext } from "../../utils/lookup.ts";


/**
 * Dialog — the native `<dialog>` and its backdrop.
 *
 * The element is the whole reason this is a primitive rather than a
 * convention. `showModal()` puts the panel in the top layer above everything
 * else on the page, and brings the four things a modal has to have: focus
 * trapped inside, Escape to close, the rest of the document inert to pointer
 * and assistive technology, and `:modal` matching only while it is open. All
 * of that is the platform's and none of it is ours to reimplement.
 *
 * **Everything here is one rule on one token.** A document writes `<dialog>`;
 * it never writes `dialog-header`, so a rule keyed on that token never matches
 * and none of the layout ships — the panel renders with the page's own
 * `<header>` block styling and the close button stacks under the title. uno
 * keeps only the first rule matching a token, so the backdrop, the panel, the
 * header row, the close control and the footer row are all yields from one
 * generator, separated by the selector each yield carries.
 *
 * Three opinions about the surface:
 *
 * **The backdrop is themed, not black.** `::backdrop` is the correct element
 * and there is no alternative — a fixed pseudo-element behind a top-layer
 * element is behind the top layer too, so it can never cover the page the way
 * a modal must. It is a scrim rather than a veil: enough to separate the panel
 * from the page, not enough to hide what the reader is deciding about.
 *
 * **The panel is centred and capped.** A dialog that grows to its content can
 * be taller than the viewport, and a modal you can scroll past has lost the
 * thing that makes it modal. So it is capped and scrolls inside itself, which
 * also keeps the close control reachable.
 *
 * **Header and footer break out of the padding.** A title row that starts a
 * pixel below the panel's edge while the body text starts a full step in is
 * the inconsistency that makes a dialog look assembled rather than designed.
 *
 * The close control is pinned rather than distributed: `justify-content` alone
 * leaves its position to the heading's width, which is how it lands mid-header
 * on a short title and hard right on a long one. The heading grows, the control
 * is absolute to the panel's corner, and neither depends on the other's width.
 * The corner is where an x belongs, so the rule states a position and nothing
 * about the control's contents — the shape is the consumer's, and a shape
 * needs no width management.
 *
 * The rise is deliberately absent. The top layer and the display toggle give no
 * reliable transition hook, and faking one with `@starting-style` would delay
 * the panel behind its own backdrop. It opens at its final size.
 */
export function dialogRules(
  roots: readonly string[],
): SpinRule[] {
  if (!roots.includes("dialog")) return [];
  const dialog = "dialog";
  return [
    [
      /^dialog$/,
      function* (_m, ctx) {
        const t = tokens(ctx);
        const pad = t.spacing4;

        // The scrim. `:modal` matches only while the dialog is open as a modal,
        // so this one yield covers `showModal()` and a hand-set `open` alike.
        yield {
          [ctx.symbols.selector]: () => ":modal::backdrop",
          // The theme's own scrim. A theme that states none gets a neutral
          // one rather than a missing backdrop: a modal that fails to dim
          // the page has stopped being a modal.
          background: t.scrim ?? "rgba(0, 0, 0, 0.45)",
          ...(t.duration !== undefined
            ? {
              "transition-duration": t.duration,
              "transition-property": "opacity",
            }
            : {}),
          ...(t.easing !== undefined
            ? { "transition-timing-function": t.easing }
            : {}),
        };

        // The panel: a card, centred, capped, scrollable within itself.
        // No `display` is stated — the element hides itself when closed, and
        // saying `display: block` would defeat exactly that.
        yield {
          [ctx.symbols.selector]: () => dialog,
          margin: "auto",
          ...(pad !== undefined ? { padding: pad } : {}),
          ...(t.borderWidth !== undefined && t.border !== undefined
            ? { border: `${t.borderWidth} solid ${t.border}` }
            : {}),
          ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
          ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
          ...(t.text !== undefined ? { color: t.text } : {}),
          ...(t.shadow !== undefined ? { "box-shadow": t.shadow } : {}),
          // Narrow enough to stay a dialog, wide enough for a form.
          width: "min(32rem, calc(100vw - 2rem))",
          "max-height": "calc(100vh - 4rem)",
          "overflow-y": "auto",
          // The panel is the containing block for the close control, so it
          // needs a position of its own for `inset` to mean anything.
          position: "relative",
        };

        // A non-modal dialog is inline content, not a floating panel: no
        // backdrop, no elevation, nothing above anything.
        yield {
          [ctx.symbols.selector]: () => `${dialog}:not(:modal)`,
          margin: "0",
          ...(t.shadow !== undefined ? { "box-shadow": "none" } : {}),
          "max-height": "none",
        };

        // The title row. `<header>` inside a dialog is not page furniture, and
        // scoping it to the dialog's children is what keeps the same tag
        // neutral everywhere else.
        yield {
          [ctx.symbols.selector]: () => `${dialog} > header:first-of-type`,
          display: "flex",
          "align-items": "flex-start",
          // The heading grows and the close control is out of flow, so the row
          // has exactly one item to lay out and nothing to distribute.
          "justify-content": "flex-start",
          ...(pad !== undefined ? { "padding-block-start": pad } : {}),
          ...(pad !== undefined
            ? { "margin-block-start": `calc(${pad} * -1)` }
            : {}),
        };
        // The heading breaks out on the start and top edges, then puts its own
        // padding back so the text lands on the panel's grid.
        yield {
          [ctx.symbols.selector]: () =>
            `${dialog} > header:first-of-type > :is(h1, h2, h3)`,
          margin: "0",
          "flex-grow": "1",
          "min-width": "0",
          ...(pad !== undefined
            ? {
              "margin-block-start": `calc(${pad} * -1)`,
              "margin-inline-start": `calc(${pad} * -1)`,
              "padding-block-start": pad,
              "padding-inline-start": pad,
            }
            : {}),
        };

        // The close control, in the panel's corner rather than in the row's
        // flow. Absolute placement is what makes it independent of the
        // heading's width — the failure mode is a button directly under a
        // short title and hard right under a long one, which is a corner in
        // neither case.
        //
        // It is positioned INSET from the panel's own padding rather than
        // breaking out of it. A negative margin would put the control's box on
        // the corner, but the panel scrolls (`overflow-y: auto`), and a
        // scrolling box clips its own overflow — so the ring and the button's
        // border would be cut off on two sides. Insetting keeps the whole
        // control visible, which is the only thing a corner control is for.
        //
        // The control is an x, so it states no text: nothing here clips or
        // truncates, and the row's layout does not depend on its width.
        yield {
          [ctx.symbols.selector]: () =>
            `${dialog} > header:first-of-type > :last-child`,
          position: "absolute",
          ...(pad !== undefined
            ? { "inset-block-start": pad, "inset-inline-end": pad }
            : { "inset-block-start": "0", "inset-inline-end": "0" }),
        };

        // The actions row, breaking out at the bottom.
        //
        // It WRAPS, and that is the whole of the fix — the same fix the
        // card's footer got, for the same reason. A dialog's footer holds
        // the dialog's actions, and a row that cannot hold them pushes them
        // out of the panel they belong to: in a narrow column the buttons
        // leave the dialog entirely, and a dialog whose actions have left
        // it is a dialog with no way out. The width the actions need is the
        // theme's own type scale, so a theme with a wider scale would break
        // every dialog in a narrow column — the row that wraps is what keeps
        // the panel whole in all of them.
        yield {
          [ctx.symbols.selector]: () => `${dialog} > footer:last-of-type`,
          display: "flex",
          "flex-wrap": "wrap",
          "align-items": "center",
          "justify-content": "flex-end",
          ...(t.spacing2 !== undefined ? { gap: t.spacing2 } : {}),
          ...(pad !== undefined
            ? {
              "margin-block-end": `calc(${pad} * -1)`,
              "margin-inline-start": `calc(${pad} * -1)`,
              "margin-inline-end": `calc(${pad} * -1)`,
              "padding-block-end": pad,
              "padding-inline-start": pad,
              "padding-inline-end": pad,
            }
            : {}),
        };

        // The entrance and the exit. A top-layer element has no previous
        // style to transition from on its first open, so `@starting-style`
        // supplies the "before"; `allow-discrete` on `overlay` and `display`
        // is what lets the panel leave the top layer over the duration rather
        // than vanish at the moment `close()` runs. Both are progressive:
        // an engine that knows neither still opens and closes the dialog.
        if (t.duration !== undefined) {
          yield {
            [ctx.symbols.selector]: () => `${dialog}[open]`,
            opacity: "1",
            transform: "translateY(0) scale(1)",
            "transition-property": "opacity, transform, overlay, display",
            "transition-behavior": "allow-discrete",
            "transition-duration": t.duration,
            "transition-timing-function": t.easing ?? "linear",
          };
          yield {
            [ctx.symbols.parent]: "@starting-style",
            [ctx.symbols.selector]: () => `${dialog}[open]`,
            opacity: "0",
            transform: "translateY(-0.5rem) scale(0.98)",
          };
          yield {
            [ctx.symbols.selector]: () => `${dialog}[open]::backdrop`,
            "transition-property": "opacity, overlay, display",
            "transition-behavior": "allow-discrete",
            "transition-duration": t.duration,
            "transition-timing-function": t.easing ?? "linear",
          };
          yield {
            [ctx.symbols.parent]: "@starting-style",
            [ctx.symbols.selector]: () => `${dialog}[open]::backdrop`,
            opacity: "0",
          };
        }
      },
      { layer: "primitives", autocomplete: "dialog" },
    ],
  ];
}

function tokens(ctx: ThemeContext | undefined) {
  return {
    spacing2: ctx?.theme?.spacing?.[2],
    spacing4: ctx?.theme?.spacing?.[4],
    radius: ctx?.theme?.radius?.lg,
    text: ctx?.theme?.color?.text,
    raised: ctx?.theme?.color?.["surface-raised"],
    border: ctx?.theme?.color?.border,
    scrim: ctx?.theme?.color?.scrim,
    borderWidth: ctx?.theme?.border?.width,
    shadow: ctx?.theme?.shadow?.lg,
    duration: ctx?.theme?.motion?.duration?.fast,
    easing: ctx?.theme?.motion?.easing?.standard,
  };
}
