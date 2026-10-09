/**
 * The invariants. Each one reads geometry the engine produced and compares
 * it against a value the theme itself named — never against a number
 * transcribed from a browser session.
 *
 * The catalog is small on purpose: one entry per defect the reference has
 * actually shipped. A check earns its place by being able to fail; each
 * states the number that would make it fail.
 */

import { descendants, type DomNode, hasClass } from "./dom.ts";
import { evalLength, evalString } from "./css.ts";
import {
  type LayoutResult,
  offsetWithin,
  resolvedBorderWidthPx,
} from "./layout.ts";

export interface CheckReport {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CheckInput {
  readonly route: string;
  readonly theme: string;
  readonly root: DomNode;
  readonly resolved: ReadonlyMap<DomNode, Record<string, string>>;
  readonly vars: Record<string, string>;
  readonly layout: LayoutResult;
  readonly viewportWidth: number;
}

const EPSILON = 0.51;

function px(value: string | undefined, vars: Record<string, string>): number {
  if (value === undefined) return NaN;
  const length = evalLength(value, vars);
  return length.kind === "px" ? length.px : NaN;
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * The preview panels: the app's own `overflow-auto` panel (signature
 * `min-h-16`), which is the scroller a reader uses. An example that brings
 * its own inner scroller is a demo of one, not the reference's preview defect,
 * so it is not what this measures.
 */
function scrollersOf(root: DomNode): DomNode[] {
  return descendants(root).filter((node) =>
    hasClass(node, "overflow-auto") && hasClass(node, "min-h-16") &&
    descendants(node).some((d) => d.tag === "table")
  );
}

/**
 * The header is visible and at least three body rows are, too. A scroller
 * shorter than header + 3 rows shows a header over nothing — the reference's
 * cramped-preview defect, measured rather than eyeballed.
 */
function checkStickyTable(input: CheckInput): CheckReport {
  const scrollers = scrollersOf(input.root);
  if (scrollers.length === 0) {
    return {
      id: "sticky-table-visible",
      ok: false,
      detail: "no sticky table fixture found",
    };
  }
  const lines: string[] = [];
  let ok = true;
  for (const scroller of scrollers) {
    const table = descendants(scroller).find((d) => d.tag === "table")!;
    const headerRow = [...descendants(table)].find((d) => d.tag === "tr");
    const bodyRows = [...descendants(table)].filter((d) =>
      d.tag === "tr" && d.parent?.tag !== "thead"
    );
    const scrollerBox = input.layout.boxOf(scroller);
    const bottom = scrollerBox.height;
    const headerBox = input.layout.boxOf(headerRow!);
    const headerTop = offsetWithin(input.layout, scroller, headerRow!).y;
    const headerFits = headerTop >= -EPSILON &&
      headerTop + headerBox.height <= bottom + EPSILON;
    const visible = bodyRows.filter((row) => {
      const box = input.layout.boxOf(row);
      const top = offsetWithin(input.layout, scroller, row).y;
      return top >= -EPSILON && top + box.height <= bottom + EPSILON;
    }).length;
    const tableBox = input.layout.boxOf(table);
    const needed = headerBox.height +
      3 * (bodyRows.length > 0 ? input.layout.boxOf(bodyRows[0]).height : 0);
    lines.push(
      `scroller ${round(scrollerBox.width)}x${round(scrollerBox.height)}, ` +
        `table ${round(tableBox.width)}x${round(tableBox.height)}, ` +
        `header ${round(headerBox.height)} + 3 rows needs ${
          round(needed)
        }px: ` +
        `${visible} body rows visible`,
    );
    if (!headerFits || visible < 3) ok = false;
  }
  return {
    id: "sticky-table-visible",
    ok,
    detail: lines.join("; "),
  };
}

/** Every avatar is a square at every ladder step. */
function checkAvatarSquare(input: CheckInput): CheckReport {
  const avatars = descendants(input.root).filter((node) =>
    hasClass(node, "avatar")
  );
  if (avatars.length === 0) {
    return {
      id: "avatar-square",
      ok: false,
      detail: "no avatar fixture found",
    };
  }
  const bad: string[] = [];
  const seen: string[] = [];
  for (const avatar of avatars) {
    const box = input.layout.boxOf(avatar);
    const label = avatar.classes.join(".");
    if (!seen.includes(label)) seen.push(label);
    if (Math.abs(box.width - box.height) > EPSILON) {
      bad.push(`${label} ${round(box.width)}x${round(box.height)}`);
    }
  }
  const sizes = seen.map((label) => {
    const avatar = avatars.find((a) => a.classes.join(".") === label)!;
    const box = input.layout.boxOf(avatar);
    return `${label}=${round(box.width)}px`;
  }).join(", ");
  return {
    id: "avatar-square",
    ok: bad.length === 0,
    detail: bad.length === 0
      ? `square at every step: ${sizes}`
      : `not square: ${bad.join(", ")}`,
  };
}

/**
 * Grouped faces overlap by a third of the DEFAULT face — the theme's
 * avatar-md edge — whatever size the faces themselves are.
 */
function checkGroupOverlap(input: CheckInput): CheckReport {
  const groups = descendants(input.root).filter((node) =>
    hasClass(node, "avatar-group")
  );
  if (groups.length === 0) {
    return {
      id: "avatar-group-overlap",
      ok: false,
      detail: "no avatar-group fixture found",
    };
  }
  const defaultEdge = px(input.vars["--avatar-md"], input.vars);
  const expected = defaultEdge / 3;
  const bad: string[] = [];
  let checked = 0;
  for (const group of groups) {
    const kids = group.children;
    for (let i = 1; i < kids.length; i++) {
      const previous = input.layout.boxOf(kids[i - 1]);
      const current = input.layout.boxOf(kids[i]);
      const overlap = previous.width - (current.x - previous.x);
      checked++;
      // Taffy reports whole-pixel positions, so a third of a face lands
      // within a pixel of the token's arithmetic; a doubled or opened seam
      // misses by a whole face.
      if (Math.abs(overlap - expected) > 1) {
        bad.push(`overlap ${round(overlap)}px, expected ${round(expected)}px`);
      }
    }
  }
  return {
    id: "avatar-group-overlap",
    ok: bad.length === 0,
    detail: bad.length === 0
      ? `${checked} seams overlap ${round(expected)}px (avatar-md ${
        round(defaultEdge)
      } / 3)`
      : bad.join(", "),
  };
}

/**
 * Exactly one seam between join neighbours: the next item starts one border
 * width inside the previous item's box. Zero would double the border; a
 * positive gap would open one.
 */
function checkJoinSeam(input: CheckInput): CheckReport {
  const joins = descendants(input.root).filter((node) =>
    hasClass(node, "join")
  );
  if (joins.length === 0) {
    return { id: "join-seam", ok: false, detail: "no join fixture found" };
  }
  const bad: string[] = [];
  let seams = 0;
  let width = NaN;
  for (const join of joins) {
    const items = join.children.filter((child) => hasClass(child, "join-item"));
    width = resolvedBorderWidthPx(input.resolved.get(items[0]) ?? {}, "top");
    for (let i = 1; i < items.length; i++) {
      const previous = input.layout.boxOf(items[i - 1]);
      const current = input.layout.boxOf(items[i]);
      const gap = current.x - (previous.x + previous.width);
      seams++;
      if (Math.abs(gap + width) > 0.01) {
        bad.push(
          `seam ${round(gap)}px, expected -${
            round(width)
          }px (one border width)`,
        );
      }
    }
  }
  return {
    id: "join-seam",
    ok: bad.length === 0,
    detail: bad.length === 0
      ? `${seams} seams, each exactly one border width (${
        round(width)
      }px in ${input.theme})`
      : bad.join(", "),
  };
}

/**
 * Striped rows paint the sunken surface on odd rows and nothing on even
 * ones — per theme, straight from the theme's own tokens.
 */
function checkStriped(input: CheckInput): CheckReport {
  const striped = descendants(input.root).find((node) =>
    node.tag === "table" && hasClass(node, "striped")
  );
  if (striped === undefined) {
    return {
      id: "striped-rows",
      ok: false,
      detail: "no striped table fixture found",
    };
  }
  const oddRow = striped.children
    .flatMap((section) => section.children)
    .filter((tr) => tr.tag === "tr" && tr.parent?.tag === "tbody")[0];
  const evenRow = striped.children
    .flatMap((section) => section.children)
    .filter((tr) => tr.tag === "tr" && tr.parent?.tag === "tbody")[1];
  if (oddRow === undefined || evenRow === undefined) {
    return {
      id: "striped-rows",
      ok: false,
      detail: "striped table has fewer than two body rows",
    };
  }
  const oddCell = oddRow.children[0];
  const evenCell = evenRow.children[0];
  const oddBg = evalString(
    input.resolved.get(oddCell)?.["background-color"] ?? "transparent",
    input.vars,
  );
  const evenBg = evalString(
    input.resolved.get(evenCell)?.["background-color"] ?? "transparent",
    input.vars,
  );
  const sunken = evalString("var(--color-surface-sunken)", input.vars);
  const ok = oddBg !== null && oddBg !== "transparent" && oddBg !== evenBg &&
    (sunken === null || oddBg === sunken);
  return {
    id: "striped-rows",
    ok,
    detail: `odd rows paint ${oddBg ?? "nothing"}, even rows paint ${
      evenBg ?? "nothing"
    } (${input.theme})`,
  };
}

/** The document fits the viewport: no element's right edge passes it. */
function checkNoHorizontalOverflow(input: CheckInput): CheckReport {
  let worst = { node: input.root, right: 0 };
  const walk = (node: DomNode): void => {
    if (input.layout.isModelled(node)) {
      const box = input.layout.boxOf(node);
      const left = offsetWithin(input.layout, input.root, node).x;
      if (left + box.width > worst.right) {
        worst = { node, right: left + box.width };
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(input.root);
  const root = input.layout.boxOf(input.root);
  const over = worst.right - input.viewportWidth;
  return {
    id: "no-horizontal-overflow",
    ok: over <= EPSILON && root.width <= input.viewportWidth + EPSILON,
    detail: `widest edge ${round(worst.right)}px at ${input.viewportWidth}px (${
      over > EPSILON ? `${round(over)}px over` : "fits"
    })`,
  };
}

const CHECKS_BY_ROUTE: Record<
  string,
  ReadonlyArray<(input: CheckInput) => CheckReport>
> = {
  table: [checkStickyTable, checkStriped, checkNoHorizontalOverflow],
  avatar: [checkAvatarSquare, checkNoHorizontalOverflow],
  "avatar-group": [
    checkGroupOverlap,
    checkAvatarSquare,
    checkNoHorizontalOverflow,
  ],
  join: [checkJoinSeam, checkNoHorizontalOverflow],
};

export function checksFor(
  route: string,
): ReadonlyArray<(input: CheckInput) => CheckReport> {
  const checks = CHECKS_BY_ROUTE[route];
  if (checks === undefined) {
    throw new Error(`layout oracle: no checks registered for route "${route}"`);
  }
  return checks;
}
