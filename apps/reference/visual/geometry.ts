/**
 * The geometry claims, measured in the browser.
 *
 * Each one reads geometry the browser produced and compares it against a
 * value the theme itself named — never against a number transcribed from a
 * browser session. The catalog is small on purpose: one entry per claim the
 * reference can actually fail, and each states the number that would make it
 * fail.
 *
 * `geometryAudit` is a single in-page function, shipped to the tab by
 * serialising its source: every helper it reads lives inside it, or it is
 * simply missing where it runs.
 */

import type { GeometryClaim } from "../../../internal/check/harness.ts";

/** The claims each route of the reference is held to. */
const CLAIMS_BY_ROUTE: Record<string, readonly string[]> = {
  "/components/table": ["striped-rows", "no-horizontal-overflow"],
  "/components/avatar": ["avatar-square", "no-horizontal-overflow"],
  "/components/avatar-group": [
    "avatar-group-overlap",
    "avatar-square",
    "no-horizontal-overflow",
  ],
  "/components/join": ["join-seam", "no-horizontal-overflow"],
};

/** The claims a route is held to; routes with no geometry carry none. */
export function geometryClaimsFor(hash: string): readonly string[] {
  return CLAIMS_BY_ROUTE[hash] ?? [];
}

export function geometryAudit(options: {
  readonly claims: readonly string[];
}): readonly GeometryClaim[] {
  // Everything the claims read lives inside this function: the source is
  // serialised and shipped to the tab, so a helper left outside is missing
  // in the browser.
  const EPSILON = 0.51;
  const round = (n: number): string => (Math.round(n * 100) / 100).toString();
  const box = (el: Element): DOMRect => el.getBoundingClientRect();
  const painted = (el: Element): boolean => el.getClientRects().length > 0;

  /** A length the theme named, resolved to pixels by the browser itself. */
  const px = (value: string): number => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;height:1px;width:" +
      value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).width;
    probe.remove();
    return parseFloat(resolved);
  };

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  /**
   * A colour as [r, g, b, a] through the canvas: computed values arrive in
   * syntaxes arithmetic cannot read, and two spellings of one colour have to
   * compare equal.
   */
  const rgba = (color: string): readonly number[] | null => {
    if (ctx === null) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
  };

  const same = (
    a: readonly number[] | null,
    b: readonly number[] | null,
  ): boolean =>
    a !== null && b !== null && a.length === b.length &&
    a.every((value, index) => Math.abs(value - (b[index] ?? 0)) < 0.001);

  const claims: GeometryClaim[] = [];

  /** Every avatar is a square at every ladder step. */
  if (options.claims.includes("avatar-square")) {
    const avatars = [...document.querySelectorAll(".avatar")].filter(painted);
    if (avatars.length === 0) {
      claims.push({
        id: "avatar-square",
        ok: false,
        detail: "no avatar faces on the page",
      });
    } else {
      const bad: string[] = [];
      const sizes = new Map<string, number>();
      for (const avatar of avatars) {
        const rect = box(avatar);
        const label = avatar.getAttribute("class") ?? "avatar";
        if (!sizes.has(label)) sizes.set(label, rect.width);
        if (Math.abs(rect.width - rect.height) > EPSILON) {
          bad.push(`${label} ${round(rect.width)}x${round(rect.height)}`);
        }
      }
      claims.push({
        id: "avatar-square",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `square at every step: ${
            [...sizes].map(([label, width]) => `${label}=${round(width)}px`)
              .join(", ")
          }`
          : `not square: ${bad.join(", ")}`,
      });
    }
  }

  /**
   * Grouped faces overlap by a third of the DEFAULT face — the theme's
   * avatar-md edge — whatever size the faces themselves are. A doubled or
   * opened seam misses by a whole face.
   */
  if (options.claims.includes("avatar-group-overlap")) {
    const groups = [...document.querySelectorAll(".avatar-group")].filter(
      painted,
    );
    if (groups.length === 0) {
      claims.push({
        id: "avatar-group-overlap",
        ok: false,
        detail: "no avatar groups on the page",
      });
    } else {
      const defaultEdge = px("var(--avatar-md)");
      const expected = defaultEdge / 3;
      const bad: string[] = [];
      let seams = 0;
      for (const group of groups) {
        const kids = [...group.children].filter(painted);
        for (let index = 1; index < kids.length; index++) {
          const previous = box(kids[index - 1]!);
          const current = box(kids[index]!);
          const overlap = previous.width - (current.x - previous.x);
          seams++;
          if (Math.abs(overlap - expected) > 1) {
            bad.push(
              `overlap ${round(overlap)}px, expected ${round(expected)}px`,
            );
          }
        }
      }
      claims.push({
        id: "avatar-group-overlap",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${seams} seams overlap ${round(expected)}px (avatar-md ${
            round(defaultEdge)
          } / 3)`
          : bad.join(", "),
      });
    }
  }

  /**
   * Exactly one seam between join neighbours: the next item starts one
   * border width inside the previous item's box. Zero would double the
   * border; a positive gap would open one.
   */
  if (options.claims.includes("join-seam")) {
    const joins = [...document.querySelectorAll(".join")].filter(painted);
    if (joins.length === 0) {
      claims.push({
        id: "join-seam",
        ok: false,
        detail: "no join groups on the page",
      });
    } else {
      const bad: string[] = [];
      let seams = 0;
      let width = 0;
      for (const join of joins) {
        const items = [...join.children].filter((child) =>
          child.classList.contains("join-item")
        );
        if (items.length === 0) continue;
        width = parseFloat(getComputedStyle(items[0]!).borderTopWidth) || 0;
        for (let index = 1; index < items.length; index++) {
          const previous = box(items[index - 1]!);
          const current = box(items[index]!);
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
      claims.push({
        id: "join-seam",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${seams} seams, each exactly one border width (${round(width)}px)`
          : bad.join(", "),
      });
    }
  }

  /**
   * Striped rows paint the sunken surface on odd rows and nothing on even
   * ones — per theme, straight from the theme's own tokens.
   */
  if (options.claims.includes("striped-rows")) {
    const striped = [...document.querySelectorAll("table.striped")].filter(
      painted,
    )[0];
    if (striped === undefined) {
      claims.push({
        id: "striped-rows",
        ok: false,
        detail: "no striped table on the page",
      });
    } else {
      const rows = [...striped.querySelectorAll("tbody tr")];
      const odd = rows[0];
      const even = rows[1];
      if (odd === undefined || even === undefined) {
        claims.push({
          id: "striped-rows",
          ok: false,
          detail: `striped table has ${rows.length} body rows`,
        });
      } else {
        const oddCell = odd.querySelector("td");
        const evenCell = even.querySelector("td");
        const oddBg = oddCell
          ? getComputedStyle(oddCell).backgroundColor
          : "transparent";
        const evenBg = evenCell
          ? getComputedStyle(evenCell).backgroundColor
          : "transparent";
        const sunken = (() => {
          const probe = document.createElement("div");
          probe.style.cssText =
            "position:fixed;left:-9999px;top:0;height:1px;width:1px;background:var(--color-surface-sunken)";
          document.body.appendChild(probe);
          const value = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return value;
        })();
        const oddRgba = rgba(oddBg);
        const evenRgba = rgba(evenBg);
        const ok = oddRgba !== null && (oddRgba[3] ?? 0) > 0 &&
          same(oddRgba, rgba(sunken)) && (evenRgba === null ||
            (evenRgba[3] ?? 0) === 0);
        claims.push({
          id: "striped-rows",
          ok,
          detail:
            `odd rows paint ${oddBg}, even rows paint ${evenBg} (sunken ${sunken})`,
        });
      }
    }
  }

  /** The document fits the viewport: nothing makes it scroll sideways. */
  if (options.claims.includes("no-horizontal-overflow")) {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    claims.push({
      id: "no-horizontal-overflow",
      ok: over <= 1,
      detail: `document ${doc.scrollWidth}px wide in ${doc.clientWidth}px (${
        over > 1 ? `${over}px over` : "fits"
      })`,
    });
  }

  return claims;
}
