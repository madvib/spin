import type { SpinRule } from "../../utils/lookup.ts";
import type { ThemeContext } from "../../utils/lookup.ts";


/**
 * Panel — the floating surface every dropdown, menu, and popover shares.
 *
 * Cascade, select, combobox, menu, theme-picker, popover, hover-card, and
 * tooltip each hand-rolled `rounded-lg border bg-surface-raised p-1 shadow-lg`
 * in their examples — the same six declarations, copy-pasted, drifting. A
 * panel that is 4px padded in one component and 8px in another is not two
 * designs, it is no design. So the surface is one primitive: rounded,
 * bordered, raised, elevated, and padded by the theme.
 *
 * Two parts: the surface itself (`.panel`) and the option column inside it
 * (`.panel-list`) — a vertical stack with room between rows and room to
 * breathe at the edges. An option row is a machine part (`item`), not a
 * primitive; the list owns only the spacing rows sit in.
 */
export function panelRules(
  roots: readonly string[],
): SpinRule[] {
  if (!roots.includes("panel")) return [];
  const panel = "panel";
  const list = "panel-list";
  return [
    [
      /^panel$/,
      function* (_m, ctx) {
        const t = panelTokens(ctx);
        yield {
          [ctx.symbols.selector]: () => panel,
          display: "block",
          width: "100%",
          ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
          ...(t.text !== undefined ? { color: t.text } : {}),
          ...(t.borderWidth !== undefined && t.border !== undefined
            ? { border: `${t.borderWidth} solid ${t.border}` }
            : {}),
          ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
          ...(t.shadow !== undefined ? { "box-shadow": t.shadow } : {}),
          ...(t.pad !== undefined ? { padding: t.pad } : {}),
        };
        yield {
          [ctx.symbols.selector]: () => list,
          display: "flex",
          "flex-direction": "column",
          ...(t.gap !== undefined ? { gap: t.gap } : {}),
          "min-width": "0",
        };
        const raised = ctx?.theme?.color?.surface;
        const muted = ctx?.theme?.color?.["text-muted"];
        yield {
          [ctx.symbols.selector]: () =>
            `${panel} [data-highlighted]:not([data-disabled]), ${panel} [data-selected]:not([data-disabled])`,
          ...(raised !== undefined ? { "background-color": raised } : {}),
        };
        yield {
          [ctx.symbols.selector]: () => `${panel} hr`,
          "margin-block": t.gap ?? 0,
        };
        yield {
          [ctx.symbols.selector]: () => `${panel} [data-disabled]`,
          opacity: ctx?.theme?.opacity?.["50"] ?? 0.55,
          ...(muted !== undefined ? { color: muted } : {}),
          cursor: "not-allowed",
        };
      },
      { layer: "primitives", autocomplete: "panel" },
    ],
  ];
}

function panelTokens(ctx: ThemeContext | undefined) {
  return {
    radius: ctx?.theme?.radius?.lg,
    borderWidth: ctx?.theme?.border?.width,
    border: ctx?.theme?.color?.border,
    raised: ctx?.theme?.color?.["surface-raised"],
    text: ctx?.theme?.color?.text,
    shadow: ctx?.theme?.shadow?.lg,
    pad: ctx?.theme?.spacing?.[2],
    gap: ctx?.theme?.spacing?.[1],
  };
}

