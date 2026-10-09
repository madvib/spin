/**
 * The in-page audit: what the browser can answer about itself without anyone
 * looking at it.
 *
 * `auditPage` is shipped to the tab by serialising its source, so it carries
 * every helper it uses inside itself: a helper left at module scope would be
 * invisible in the browser and the audit would throw there instead of here.
 * Do not let a helper escape.
 *
 * Colour is resolved through a 1x1 canvas because computed values arrive as
 * `oklch(...)` / `color-mix(...)` strings that arithmetic cannot read yet.
 */

/** One text node measured against the background actually painted behind it. */
export interface ContrastFinding {
  readonly check: "contrast";
  readonly selector: string;
  readonly tag: string;
  /** The text as it reads in the document, trimmed for the report. */
  readonly sample: string;
  /** Computed colour of the text. */
  readonly color: string;
  /** Colour of the nearest layer that paints a background, composited down. */
  readonly background: string;
  readonly ratio: number;
  readonly fontSize: number;
}

/** A control that occupies no area, so no pointer can reach it. */
export interface ZeroAreaInteractive {
  readonly check: "zero-area-interactive";
  readonly selector: string;
  readonly tag: string;
  readonly sample: string;
}

/** A loop that runs faster than a reader can follow. */
export interface StrobeAnimation {
  readonly check: "strobe-animation";
  readonly selector: string;
  readonly tag: string;
  readonly animation: string;
  readonly durationMs: number;
}

export type AuditFinding =
  | ContrastFinding
  | ZeroAreaInteractive
  | StrobeAnimation;

export interface AuditOptions {
  /** Lowest ratio a text node may measure against its background. */
  readonly minContrast: number;
  /** Shorter than this and an endless animation is a strobe, not a sweep. */
  readonly strobeMs: number;
  /** Restrict the audit to this subtree; the hover probe audits one element. */
  readonly root?: Element | null;
}

export interface AuditResult {
  readonly findings: readonly AuditFinding[];
  /** Text nodes skipped because a gradient owns their background. */
  readonly unresolved: number;
  /** Text nodes measured. Zero means the audit never looked at the page. */
  readonly measured: number;
}

/** The name the audit is reachable by inside a document the oracle loaded. */
export const AUDIT_GLOBAL = "spinVisualAudit";

/**
 * The audit, installed into every document rather than sent per call.
 *
 * The audit's source is several kilobytes, and shipping it on each of the
 * hundreds of evaluations a run makes costs more than every real audit
 * combined. Installing it once per document turns each call into a symbol
 * lookup.
 */
export function auditInstallScript(): string {
  return `globalThis.${AUDIT_GLOBAL} = ${auditPage.toString()};`;
}

export function auditPage(options: AuditOptions): AuditResult {
  // Everything the audit reads lives inside its own body: the function is
  // serialised and shipped to the tab, so a constant or helper left out here
  // is simply missing in the browser.
  const INTERACTIVE =
    "a[href], button, input:not([type=hidden]), select, textarea, summary, " +
    "[role=button], [role=link], [role=checkbox], [role=radio], " +
    "[role=switch], [role=tab], [role=menuitem], [role=option]";
  const DORMANT = "template, [hidden], details:not([open]) > *:not(summary), " +
    "[popover]:not(:popover-open)";
  // Text that is not painted by CSS at all: an option is a row in the
  // operating system's popup, so the colours computed for it describe a
  // dropdown nobody has opened.
  const PLATFORM_PAINTED = "select";
  // Inactive controls, which WCAG 1.4.3 exempts. A label faded over its own
  // disabled input is a control saying "unavailable", not illegible text.
  const INACTIVE =
    ":disabled, [aria-disabled='true'], label:has(:disabled), fieldset:disabled";
  const findings: AuditFinding[] = [];
  const root = options.root ?? document.body;
  if (!root) return { findings, unresolved: 0, measured: 0 };

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { findings, unresolved: 0, measured: 0 };

  const resolved = new Map<string, readonly number[]>();
  // An arrow, not a declaration: a hoisted declaration would not inherit the
  // null check above it, and every use site would carry the null with it.
  const toRgba = (color: string): readonly number[] => {
    const hit = resolved.get(color);
    if (hit !== undefined) return hit;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    // An unparsable string leaves fillStyle alone, so a colour that cannot be
    // resolved is measured as the value it actually was.
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    const rgba: readonly number[] = [
      pixel[0],
      pixel[1],
      pixel[2],
      pixel[3] / 255,
    ];
    resolved.set(color, rgba);
    return rgba;
  };

  function over(
    top: readonly number[],
    bottom: readonly number[],
  ): readonly number[] {
    const a = top[3];
    return [
      top[0] * a + bottom[0] * (1 - a),
      top[1] * a + bottom[1] * (1 - a),
      top[2] * a + bottom[2] * (1 - a),
      a + bottom[3] * (1 - a),
    ];
  }

  function luminance(rgb: readonly number[]): number {
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel(rgb[0]) +
      0.7152 * channel(rgb[1]) +
      0.0722 * channel(rgb[2])
    );
  }

  function contrast(
    a: readonly number[],
    b: readonly number[],
  ): number {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /** How transparent the element and everything above it read as. */
  function opacityAt(el: Element): number {
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const value = Number(getComputedStyle(n).opacity);
      opacity *= Number.isFinite(value) ? value : 1;
    }
    return opacity;
  }

  function isPainted(el: Element): boolean {
    if (el.getClientRects().length === 0) return false;
    // Below 0.1 an element is deliberately on its way out of the frame; a
    // transition in flight is not a defect.
    if (opacityAt(el) < 0.1) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }
    return true;
  }

  function isDormant(el: Element): boolean {
    if (el.closest(DORMANT) !== null) return true;
    if (el.closest('[aria-hidden="true"]') !== null) return true;
    return !isPainted(el);
  }

  /**
   * The colour behind an element, composited from the canvas outward, and the
   * last declared layer that got there. `null` when a gradient owns the
   * background: a fill no single colour describes cannot be measured.
   */
  function backdropOf(
    el: Element,
  ): { bg: readonly number[]; declared: string } | null {
    const chain: Element[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.push(n);
    let acc: readonly number[] = [255, 255, 255, 1];
    let declared = "canvas";
    let opacity = 1;
    for (let i = chain.length - 1; i >= 0; i--) {
      const node = chain[i];
      if (node === undefined) continue;
      const style = getComputedStyle(node);
      if (style.backgroundImage !== "none") return null;
      const value = Number(style.opacity);
      opacity *= Number.isFinite(value) ? value : 1;
      const layer = toRgba(style.backgroundColor);
      if (layer[3] > 0) {
        const painted: readonly number[] = [
          layer[0],
          layer[1],
          layer[2],
          Math.min(1, layer[3] * opacity),
        ];
        acc = over(painted, acc);
        declared = style.backgroundColor;
      }
    }
    return { bg: acc, declared };
  }

  function selectorOf(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    for (let depth = 0; node && depth < 3; depth++) {
      const tag = node.tagName.toLowerCase();
      const parent: Element | null = node.parentElement;
      if (parent === null) {
        parts.unshift(tag);
        break;
      }
      const same = [...parent.children].filter((c) =>
        c.tagName === node!.tagName
      );
      const index = same.length > 1
        ? `:nth-of-type(${same.indexOf(node) + 1})`
        : "";
      parts.unshift(`${tag}${index}`);
      node = parent;
    }
    return parts.join(" > ");
  }

  // ── contrast ────────────────────────────────────────────────────────────
  let measured = 0;
  let unresolved = 0;
  const walked = new Set<Element>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      (node.nodeValue ?? "").trim().length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes: Node[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const node of nodes) {
    const el = node.parentElement;
    if (el === null || walked.has(el)) continue;
    if (!isPainted(el)) continue;
    if (
      el.closest(
        `${INACTIVE}, ${PLATFORM_PAINTED}, [aria-hidden="true"]`,
      ) !== null
    ) {
      continue;
    }
    walked.add(el);
    const backdrop = backdropOf(el);
    if (backdrop === null) {
      unresolved++;
      continue;
    }
    const style = getComputedStyle(el);
    const color = toRgba(style.color);
    const effective = over(
      [color[0], color[1], color[2], color[3] * opacityAt(el)],
      backdrop.bg,
    );
    const ratio = contrast(effective, backdrop.bg);
    measured++;
    if (ratio + 0.005 < options.minContrast) {
      findings.push({
        check: "contrast",
        selector: selectorOf(el),
        tag: el.tagName.toLowerCase(),
        sample: (node.nodeValue ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        color: style.color,
        background: backdrop.declared,
        ratio: Math.round(ratio * 100) / 100,
        fontSize: parseFloat(style.fontSize),
      });
    }
  }

  // ── reachability ────────────────────────────────────────────────────────
  for (const el of [...root.querySelectorAll<HTMLElement>(INTERACTIVE)]) {
    if (!isPainted(el)) continue;
    const area = [...el.getClientRects()].reduce(
      (sum, rect) => sum + rect.width * rect.height,
      0,
    );
    if (area > 0) continue;
    if (isDormant(el)) continue;
    if (el.closest('[aria-hidden="true"]') !== null) continue;
    findings.push({
      check: "zero-area-interactive",
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      sample: (el.textContent ?? el.getAttribute("aria-label") ?? "").trim()
        .replace(/\s+/g, " ").slice(0, 60),
    });
  }

  // ── motion ──────────────────────────────────────────────────────────────
  const parseSeconds = (value: string): number | undefined => {
    const text = value.trim();
    if (text === "") return undefined;
    const parsed = parseFloat(text);
    if (!Number.isFinite(parsed)) return undefined;
    return text.endsWith("ms") ? parsed / 1000 : parsed;
  };
  const strobes = new Set<string>();
  for (const el of [...root.querySelectorAll<HTMLElement>("*")]) {
    if (!isPainted(el)) continue;
    const style = getComputedStyle(el);
    if (style.animationName === "none") continue;
    const names = style.animationName.split(",").map((s) => s.trim());
    const durations = style.animationDuration.split(",").map(parseSeconds);
    const iterations = style.animationIterationCount.split(",").map((s) =>
      s.trim()
    );
    for (let i = 0; i < names.length; i++) {
      const duration = durations[i] ?? durations[0];
      if (duration === undefined) continue;
      const endless = (iterations[i] ?? iterations[0]) === "infinite";
      if (!endless || duration * 1000 >= options.strobeMs) continue;
      const key = `${selectorOf(el)}|${names[i]}|${duration}`;
      if (strobes.has(key)) continue;
      strobes.add(key);
      findings.push({
        check: "strobe-animation",
        selector: selectorOf(el),
        tag: el.tagName.toLowerCase(),
        animation: names[i] ?? "?",
        durationMs: Math.round(duration * 1000),
      });
    }
  }

  return { findings, unresolved, measured };
}
