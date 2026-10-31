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

import type { GeometryClaim } from "@spin/check";

/** The claims each route of the reference is held to. */
const CLAIMS_BY_ROUTE: Record<string, readonly string[]> = {
  "/themes": ["no-horizontal-overflow"],
  "/components/table": ["striped-rows", "no-horizontal-overflow"],
  "/components/avatar": [
    "avatar-group-overlap",
    "avatar-square",
    "no-horizontal-overflow",
  ],
  "/components/join": [
    "join-seam",
    "join-heights",
    "no-horizontal-overflow",
  ],
  "/components/card": [
    "card-parts",
    "card-header",
    "card-actions",
    "no-horizontal-overflow",
  ],
  "/components/details": ["details-stable", "no-horizontal-overflow"],
  "/components/checkbox": ["checkbox-square", "no-horizontal-overflow"],
  "/components/switch": ["switch-track", "no-horizontal-overflow"],
};

/** The claims a route is held to; every component route paints and fits. */
export function geometryClaimsFor(hash: string): readonly string[] {
  const explicit = CLAIMS_BY_ROUTE[hash];
  if (explicit !== undefined) {
    return explicit.includes("specimen-paints")
      ? explicit
      : [...explicit, "specimen-paints", "no-orphan-scrim"];
  }
  if (hash.startsWith("/components/")) {
    return ["specimen-paints", "no-orphan-scrim", "no-horizontal-overflow"];
  }
  return [];
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

  /**
   * A card's action holds the title's line, and a description sits under the
   * title — never beside the action, never under it.
   */
  if (options.claims.includes("card-header")) {
    const headers = [...document.querySelectorAll("card-header")].filter(
      painted,
    );
    const bad: string[] = [];
    for (const header of headers) {
      const headerRect = box(header);
      const title = header.querySelector("card-title");
      const description = header.querySelector("card-description");
      const action = header.querySelector("card-action");
      if (title && action) {
        const t = box(title);
        const a = box(action);
        if (Math.abs(t.top - a.top) > EPSILON) {
          bad.push("the action is not on the title's line");
        }
        if (a.right > headerRect.right + EPSILON) {
          bad.push("the action leaves the header");
        }
      }
      if (title && description) {
        if (box(description).top < box(title).top + EPSILON) {
          bad.push("the description is not under the title");
        }
      }
    }
    claims.push({
      id: "card-header",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `${headers.length} card headers hold their action on the title's line`
        : bad.join(", "),
    });
  }

  /** Every action in a card's footer stays inside it, and none overlap. */
  if (options.claims.includes("card-actions")) {
    const footers = [...document.querySelectorAll("card-footer")].filter(
      painted,
    );
    const bad: string[] = [];
    for (const footer of footers) {
      const f = box(footer);
      const actions = [...footer.children].filter(painted);
      for (let i = 0; i < actions.length; i++) {
        const a = box(actions[i]!);
        if (
          a.left < f.left - EPSILON || a.right > f.right + EPSILON ||
          a.top < f.top - EPSILON || a.bottom > f.bottom + EPSILON
        ) {
          bad.push("an action leaves the footer");
        }
        for (let j = i + 1; j < actions.length; j++) {
          const b = box(actions[j]!);
          if (
            a.left < b.right - EPSILON && b.left < a.right - EPSILON &&
            a.top < b.bottom - EPSILON && b.top < a.bottom - EPSILON
          ) {
            bad.push("two actions overlap");
          }
        }
      }
    }
    claims.push({
      id: "card-actions",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `${footers.length} card footers hold their actions`
        : bad.join(", "),
    });
  }

  /**
   * A disclosure reveals without moving its own width or its label. Opening
   * one is a vertical reveal: the surface is the line's width before and
   * after, and the summary is where the reader left it.
   */
  if (options.claims.includes("details-stable")) {
    const details = [...document.querySelectorAll("details")].filter(painted);
    const bad: string[] = [];
    for (const element of details) {
      const summary = element.querySelector("summary");
      const before = box(element);
      const labelBefore = summary ? box(summary) : null;
      const wasOpen = (element as HTMLDetailsElement).open;
      (element as HTMLDetailsElement).open = true;
      const after = box(element);
      const labelAfter = summary ? box(summary) : null;
      if (Math.abs(after.width - before.width) > EPSILON) {
        bad.push(
          `width ${round(before.width)}px → ${round(after.width)}px`,
        );
      }
      if (
        labelBefore && labelAfter &&
        (Math.abs(labelAfter.left - labelBefore.left) > EPSILON ||
          Math.abs(labelAfter.top - labelBefore.top) > EPSILON)
      ) {
        bad.push("the summary moves when the disclosure opens");
      }
      (element as HTMLDetailsElement).open = wasOpen;
    }
    claims.push({
      id: "details-stable",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `${details.length} disclosures open without changing width`
        : bad.join(", "),
    });
  }

  /** Every control in a join shares one height, so the object reads as one. */
  if (options.claims.includes("join-heights")) {
    const joins = [...document.querySelectorAll(".join")].filter(painted);
    const bad: string[] = [];
    for (const join of joins) {
      const items = [...join.children].filter(painted);
      if (items.length < 2) continue;
      const first = box(items[0]!);
      for (const item of items.slice(1)) {
        const r = box(item);
        if (
          Math.abs(r.top - first.top) > EPSILON ||
          Math.abs(r.bottom - first.bottom) > EPSILON
        ) {
          bad.push(
            `${item.tagName.toLowerCase()} ${round(r.height)}px beside ${
              round(first.height)
            }px`,
          );
        }
      }
    }
    claims.push({
      id: "join-heights",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `${joins.length} joins share one height`
        : bad.join(", "),
    });
  }

  /** Every card keeps its parts inside its box and in top-to-bottom order. */
  if (options.claims.includes("card-parts")) {
    const cards = [...document.querySelectorAll("card")].filter(painted);
    if (cards.length === 0) {
      claims.push({
        id: "card-parts",
        ok: false,
        detail: "no cards on the page",
      });
    } else {
      const bad: string[] = [];
      for (const card of cards) {
        const cardRect = box(card);
        const header = card.querySelector("card-header");
        const content = card.querySelector("card-content");
        const footer = card.querySelector("card-footer");
        if (header && content && painted(header) && painted(content)) {
          if (box(header).bottom > box(content).top + EPSILON) {
            bad.push("card-header overlaps card-content");
          }
        }
        if (content && footer && painted(content) && painted(footer)) {
          if (box(content).bottom > box(footer).top + EPSILON) {
            bad.push("card-content overlaps card-footer");
          }
        }
        for (const child of [...card.children].filter(painted)) {
          const childRect = box(child);
          if (childRect.right > cardRect.right + EPSILON) {
            bad.push(
              `${child.tagName.toLowerCase()} overflows card by ${
                round(childRect.right - cardRect.right)
              }px`,
            );
          }
        }
      }
      claims.push({
        id: "card-parts",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${cards.length} cards keep header/content/footer inside their bounds`
          : bad.join(", "),
      });
    }
  }

  /** Every checkbox is a square. */
  if (options.claims.includes("checkbox-square")) {
    const boxes = [
      ...document.querySelectorAll('input[type="checkbox"]:not([role])'),
    ].filter(painted);
    if (boxes.length === 0) {
      claims.push({
        id: "checkbox-square",
        ok: false,
        detail: "no checkboxes on the page",
      });
    } else {
      const bad: string[] = [];
      for (const cb of boxes) {
        const rect = box(cb);
        if (Math.abs(rect.width - rect.height) > EPSILON) {
          bad.push(`${round(rect.width)}x${round(rect.height)}`);
        }
      }
      claims.push({
        id: "checkbox-square",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${boxes.length} checkboxes square`
          : `not square: ${bad.join(", ")}`,
      });
    }
  }

  /** Every switch track is wider than it is tall. */
  if (options.claims.includes("switch-track")) {
    const switches = [
      ...document.querySelectorAll('input[type="checkbox"][role="switch"]'),
    ].filter(painted);
    if (switches.length === 0) {
      claims.push({
        id: "switch-track",
        ok: false,
        detail: "no switches on the page",
      });
    } else {
      const bad: string[] = [];
      for (const sw of switches) {
        const rect = box(sw);
        if (rect.width <= rect.height + EPSILON) {
          bad.push(`${round(rect.width)}x${round(rect.height)}`);
        }
      }
      claims.push({
        id: "switch-track",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${switches.length} switch tracks proportional`
          : `not pill-proportioned: ${bad.join(", ")}`,
      });
    }
  }

  /**
   * Every specimen's leaf content paints: skeleton blocks, controls, and
   * mounted scopes carry non-zero area. A zero-width skeleton, a crushed
   * panel, or an empty mount fails here — presence in the DOM is not paint.
   * Hidden subtrees (`hidden`, `display:none`, closed popovers) are not
   * content yet, so they are skipped; visibility-hidden boxes still hold
   * layout and are held to it. Faded-out decoration (`opacity:0`,
   * `scale-50` check indicators, zero-height progress fills) owns no
   * pixels by design and is skipped — the audit's own contrast pass
   * already walks what a reader can see.
   */
  if (options.claims.includes("specimen-paints")) {
    const inert = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      // A `display:contents` wrapper owns no box by design: its children
      // are the content, and measuring it reports 0x0 on a healthy page.
      if (style.display === "contents") return true;
      if (style.display === "none") return true;
      // Faded-out decoration owns no pixels by design: a check indicator
      // at `opacity:0`, or a progress fill waiting at zero height. The
      // content they decorate is measured on its own box.
      if (Number.parseFloat(style.opacity || "1") <= 0.05) return true;
      // Closed disclosure content is not content yet: dialog panels,
      // collapsed details, and shut popovers paint on open. Their
      // triggers (measured on their own boxes) are what must paint.
      const closed = el.closest("dialog:not([open]), details:not([open])");
      if (closed !== null) return true;
      if (el.closest("[hidden]") !== null) return true;
      const pop = el.closest("[popover]");
      if (pop !== null) {
        try {
          if (!(pop as HTMLElement).matches(":popover-open")) return true;
        } catch {
          return true;
        }
      }
      return false;
    };
    const candidates = [
      ...document.querySelectorAll(
        "main section .skeleton, main section button, main section select, main section textarea, main section [data-scope]",
      ),
    ].filter((el) => {
      if (inert(el)) return false;
      // Icon glyphs paint through their font: an inline `i-lucide-*`
      // without a sizing class owns no box until it blockifies as a flex
      // item. The control around it is what must paint.
      const cls = el.getAttribute("class") ?? "";
      if (/(?:^|\s)i-[a-z]/.test(cls) && !/(?:^|\s)(icon-|h-|w-)/.test(cls)) {
        return false;
      }
      // A zero-width span wrapping a single icon glyph is the same
      // decoration one level up: the glyph owns no box, so neither
      // does its wrapper.
      const kid = el.firstElementChild;
      if (
        kid !== null &&
        el.children.length === 1 &&
        /(?:^|\s)i-[a-z]/.test(kid.getAttribute("class") ?? "")
      ) {
        return false;
      }
      // and the slider's `hidden` text input are necessarily empty — their
      // triggers and tracks are what paint.
      if (el instanceof HTMLInputElement) {
        if (el.type === "hidden" || el.type === "file") return false;
        if (el.hasAttribute("hidden")) return false;
      }
      if (el.getAttribute("role") === "progressbar") return false;
      // A scale-zero fill is a value of nothing, not a crushed box: its
      // track is what must paint.
      const transform = getComputedStyle(el).transform;
      if (transform !== "none" && transform.startsWith("matrix(0")) {
        return false;
      }
      // An empty value line is the placeholder's own box: it paints when
      // it holds text, and its trigger paints regardless. A single empty
      // child (the row template's mount point) is still empty. Skeletons
      // are the exception: an empty placeholder IS the content, and a
      // zero-width one is exactly what this claim exists to catch.
      if (
        (el.textContent ?? "").trim().length === 0 &&
        !el.classList.contains("skeleton")
      ) {
        return false;
      }
      // A zero-width centered marker (`w-0 justify-center`) is an anchor
      // point, not a box: its label paints around it.
      if (
        el.getBoundingClientRect().width <= 0.51 &&
        getComputedStyle(el).justifyContent === "center"
      ) {
        return false;
      }
      // An empty toast queue is a region with no rows: it paints when a
      // toast fires. A queue WITH rows paints through them — but the
      // queue's own box is the viewport span, not content, so the rows
      // (measured on their own boxes) carry the claim either way.
      if (el.getAttribute("data-part") === "group") {
        return false;
      }
      return true;
    });
    if (candidates.length === 0) {
      claims.push({
        id: "specimen-paints",
        ok: true,
        detail: "no painted leaf content on the page",
      });
    } else {
      const bad: string[] = [];
      for (const el of candidates) {
        const rect = box(el);
        if (rect.width <= EPSILON || rect.height <= EPSILON) {
          const label = el.getAttribute("class")?.split(" ")[0] ??
            el.tagName.toLowerCase();
          const heading = el.closest("section")?.querySelector("h3")
            ?.textContent?.trim().slice(0, 40) ?? "";
          bad.push(
            `${heading} ${el.tagName.toLowerCase()}.${label} paints ${
              round(rect.width)
            }x${round(rect.height)}`,
          );
        }
      }
      claims.push({
        id: "specimen-paints",
        ok: bad.length === 0,
        detail: bad.length === 0
          ? `${candidates.length} leaf boxes paint`
          : bad.join(", "),
      });
    }
  }

  /**
   * No orphan scrim: a fixed full-viewport layer with a painted backdrop
   * (a non-transparent background above faint opacity) belongs to a
   * running machine. A backdrop whose owner reports closed (or carries no
   * state at all) is the tour shape — paint without an owner. Empty fixed
   * regions (a toast queue with no rows) own no pixels and are not scrims.
   */
  if (options.claims.includes("no-orphan-scrim")) {
    const fixed = [...document.querySelectorAll("main *")].filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      if (style.position !== "fixed") return false;
      if (style.visibility === "hidden" || style.display === "none") {
        return false;
      }
      if (Number.parseFloat(style.opacity || "1") <= 0.2) return false;
      if (box(el).width < document.documentElement.clientWidth - 2) {
        return false;
      }
      const bg = style.backgroundColor;
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
      return true;
    });
    const bad: string[] = [];
    for (const el of fixed) {
      const owned = el.closest("[data-state]")?.getAttribute("data-state");
      if (owned === "open" || owned === "running" || owned === "active") {
        continue;
      }
      const part = el.getAttribute("data-part");
      bad.push(
        `${el.tagName.toLowerCase()}${part ? `[data-part="${part}"]` : ""} state=${owned ?? "none"}`,
      );
    }
    claims.push({
      id: "no-orphan-scrim",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? "no unowned full-viewport layers"
        : `orphan scrims: ${bad.join(", ")}`,
    });
  }

  /**
   * Closed overlays stay shut: a popover/tooltip/hover-card panel that is
   * not `:popover-open` paints nothing. Without it a closed panel reads as
   * a paint failure — closed is correct, and this claim says so.
   */
  if (options.claims.includes("top-layer-closed")) {
    const panels = [...document.querySelectorAll("[popover]")].filter((
      el,
    ) => {
      try {
        return !(el as HTMLElement).matches(":popover-open");
      } catch {
        return true;
      }
    });
    const bad: string[] = [];
    for (const el of panels) {
      const style = getComputedStyle(el);
      const rect = box(el);
      if (
        style.display !== "none" &&
        (rect.width > EPSILON || rect.height > EPSILON)
      ) {
        bad.push(
          `${el.tagName.toLowerCase()} paints ${round(rect.width)}x${
            round(rect.height)
          } while closed`,
        );
      }
    }
    claims.push({
      id: "top-layer-closed",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `${panels.length} closed panels stay shut`
        : bad.join(", "),
    });
  }


  return claims;
}
