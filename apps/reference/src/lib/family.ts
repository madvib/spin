import { SECTIONS, utilitiesFor } from "@spin/preset/organization.ts";
import { buildScale, type BuiltScale, EDGE_AXES, scaleClass } from "@spin/preset/reference/build.ts";
import { type Demo, DEMO_SAMPLE, demoClass, demoFor, noteFor } from "./demos.ts";
import { escapeHtml } from "@spin/preset/reference/surface.ts";
import { CHROME } from "./chrome.ts";
import { mechanismOf, MECHANISMS, CAP } from "./mechanisms.ts";
import { catalogSections, cell, PREFIX_TARGET, sampleElement } from "./specimen.ts";

/**
 * Which catalog groups are SCALES, and how each is shaped.
 *
 * The shape is a prefix and its axes, which is what lets a group be split into
 * steps and modifiers without anyone listing forty-two names. A group absent
 * from this table is not a scale and gets the family treatment instead.
 *
 * `border` is deliberately NOT here: its group is forty-four names of which
 * thirty-four are colours, and thirty-four colour buttons is a palette wearing
 * a scale's clothes. Colours are demonstrated as swatches, in the family block
 * that already knows how to render a fill.
 */
const SCALE_SHAPES: Record<
  string,
  {
    title: string;
    blurb: string;
    axes?: readonly { key: string; label: string }[];
  }
> = {
  padding: {
    title: "Padding",
    blurb:
      "Space inside an element. Seven steps, and each step applies to any edge.",
    axes: EDGE_AXES,
  },
  margin: {
    title: "Margin",
    blurb: "Space outside an element. Same steps as padding, the same edges.",
    axes: EDGE_AXES,
  },
  gap: {
    title: "Gap",
    blurb:
      "Space between items in a flex or grid row, or between rows. The x and " +
      "y axes live below the preview, because a single value cannot name both.",
  },
  "type-size": {
    title: "Font size",
    blurb: "The type scale, in steps. A step is a size, not a weight.",
  },
  radius: {
    title: "Radius",
    blurb: "Corner rounding, from square to a full pill.",
  },
  opacity: {
    title: "Opacity",
    blurb: "How solid an element is. Read against stripes, because a partial " +
      "opacity over a flat fill looks like a bug rather than a step.",
  },
};

export const SCALE_PREFIX: Record<string, string> = {
  padding: "p",
  margin: "m",
  gap: "gap",
  "type-size": "text",
  radius: "rounded",
  opacity: "opacity",
};

/** The axis a scale with no modifiers is drawn on: the prefix itself. */
const ONE_AXIS: readonly { key: string; label: string }[] = [
  { key: "", label: "only" },
];

/** The scale for a catalog group, or undefined if it is not one. */
function scaleFor(
  group: string,
  raw: { id: string; utilities: readonly string[] },
): BuiltScale | undefined {
  const shape = SCALE_SHAPES[group];
  const prefix = SCALE_PREFIX[group];
  if (shape === undefined || prefix === undefined) return undefined;
  // A scale with no axes still has one: `buildScale` only accepts an axis it
  // has been told about, so an omitted list matches nothing and the scale
  // renders with zero steps and a preview wearing the bare prefix. Saying so
  // is both the truth and the fix.
  return buildScale(raw, { prefix, axes: shape.axes ?? ONE_AXIS }, {
    title: shape.title,
    blurb: shape.blurb,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE UTILITIES SURFACE.
 *
 * A section is a set of FAMILIES, and a family is a group of utilities with
 * one mechanism between them. Each family gets: what it is, why this sample,
 * a working before-and-after of the idea, and then every one of its names
 * shown. Nothing is summarised away and nothing is listed without
 * being demonstrated.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The class a family's working demonstration wears.
 *
 * Not the first name in the group: `p-0` and `text-sm` are the least legible
 * members of their families and would demonstrate nothing. Each entry is the
 * name that makes the idea visible, and `demoClass` promotes it further where
 * the smallest step is too small to see.
 */
const HEADLINE: Record<string, string> = {
  background: "bg-primary",
  "text-color": "text-primary",
  sizing: "w-1/2",
  divide: "divide-y divide-neutral-300",
  border: "border-4 border-dashed border-primary",
  shadow: "shadow-lg",
  font: "font-mono",
  text: "text-center",
  typography: "uppercase tracking-widest",
  "text-decoration": "underline",
  overflow: "overflow-hidden",
  interactivity: "cursor-grab",
  variants: "hover:bg-primary",
};

/** The page heading every family page carries. */
function pageHead(title: string, sub: string, badge: string): string {
  return `<header class="${CHROME.pageHead}">` +
    `<div><h2 class="${CHROME.title}">${escapeHtml(title)}</h2>` +
    `<div class="${CHROME.kind}">${escapeHtml(sub)}</div></div>` +
    `<span class="${CHROME.badge}">${escapeHtml(badge)}</span></header>`;
}

/**
 * The two boxes a family's idea is shown in: the same element with the class
 * off, and the same element with it on.
 *
 * A before and an after, because a reference entry that shows only the
 * result tells a reader nothing they could not get from the source — they
 * cannot tell which part of what they see is the utility.
 */
function beforeAfter(group: string, demo: Demo, cls: string): string {
  const before = sampleElement("", demo, group);
  const after = sampleElement(cls, demo, group);
  // For the clipped demo, the frame must not clip the inner element's overflow —
  // that would demonstrate the opposite of the utility. overflow-x-auto lets the
  // content scroll within the frame instead.
  const overflow = demo === "clipped" ? "overflow-x-auto" : "overflow-hidden";
  return `<div class="${CHROME.familyDemo}">` +
    `<figure class="${CHROME.pair}">` +
    `<div class="${CHROME.pairBox} ${overflow}">${before}</div>` +
    `<code class="${CHROME.legend}">without</code></figure>` +
    `<figure class="${CHROME.pair}">` +
    `<div class="${CHROME.pairBox} ${overflow}">${after}</div>` +
    `<code class="${CHROME.legend}">${escapeHtml(cls)}</code></figure>` +
    `</div>`;
}

/**
 * The live rail: every one of a family's names, each on its own element.
 *
 * This is where the "one card per utility" failure stops. A card is a border,
 * a heading, a preview box and a copy of the CSS — four things repeated once
 * per name, none of which is the name. A rail is the name on a live element
 * and nothing else, so a hundred and eleven position utilities cost a
 * hundred and eleven small elements instead of a page of furniture.
 */
function nameRail(
  groupId: string,
  demo: Demo,
  names: readonly string[],
): string {
  const shown = names.map((n) => {
    const promoted = demoClass(n);
    return promoted.endsWith(":")
      ? PREFIX_TARGET[promoted] ?? promoted
      : promoted;
  });
  const cells = names.map((name, i) =>
    cell(sampleElement(shown[i], demo, groupId), name, demo)
  );
  return `<div class="${CHROME.railWrap}">${cells.join("")}</div>`;
}

/**
 * What a family cannot be shown in a picture, said where a picture would lie.
 *
 * Rendered INSTEAD of a swatch for the families where the effect only exists
 * while something is happening — a pointer over the element, a selection being
 * dragged, a transition between two states. A rendered swatch for
 * `cursor-not-allowed` would be a picture of a box, which proves nothing and
 * looks like a feature.
 */
function noSampleLead(group: string): string {
  return noteFor(group) ?? "This family has no sample declared.";
}

/**
 * The interactive benches the picture cannot replace.
 *
 * Not decoration: `hover:`, `focus:`, `active:` and `group-hover:` are the
 * whole of the variants family and every one of them applies while the reader
 * is doing something. So the reader is given something to do, and told that
 * the sentence above is the only part of this a screenshot would show.
 */
function variantsBench(): string {
  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">the prefix applies while you are here</div>` +
    `<div class="${CHROME.railWrap}">` +
    `<div class="group flex w-1/3 shrink-0 flex-col items-start gap-2">` +
    `<span class="font-mono text-xs text-text-muted">hover the box, not the label</span>` +
    `<i class="block h-16 w-full rounded-sm bg-neutral-300 transition-colors group-hover:bg-accent"></i>` +
    `</div>` +
    `<button type="button" class="${CHROME.chip} px-4 py-2 transition hover:bg-primary hover:text-on-primary focus:bg-accent focus:text-on-accent active:scale-95">` +
    `hover, focus and press me</button>` +
    `<span class="inline-flex w-1/3 shrink-0 items-start gap-2 rounded-sm border border-dashed border-solid border-border p-2 text-xs text-text-muted">` +
    `nothing here is a still picture: every state below exists only while a ` +
    `pointer is over it, it holds focus, or it is pressed</span>` +
    `</div></div>`;
}

/** The interactivity bench: the utilities that only exist under a pointer. */
function interactivityBench(): string {
  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">try these rather than look at them</div>` +
    `<div class="${CHROME.railWrap}">` +
    `<div class="flex h-16 w-1/3 shrink-0 cursor-grab flex-col gap-1 overflow-auto rounded-md border border-solid border-border bg-surface-raised p-2 select-none resize-y">` +
    `<span class="font-mono text-xs text-text-muted">grab · scroll · resize</span>` +
    Array.from(
      { length: 12 },
      (_, i) =>
        `<span class="shrink-0 rounded-sm bg-neutral-200 px-2 py-1 font-mono text-xs">row ${
          i + 1
        }</span>`,
    ).join("") +
    `</div>` +
    `<div class="w-1/3 shrink-0 rounded-md border border-solid border-border bg-surface-raised p-2 select-text">` +
    `<span class="font-mono text-xs text-text-muted">drag across this text</span>` +
    `<p class="m-0 text-sm">Selection is a property of the pointer and the document, not of a picture.</p>` +
    `</div>` +
    `<span class="pointer-events-none w-1/4 shrink-0 rounded-md border border-dashed border-solid border-border p-2 text-xs text-text-muted">` +
    `pointer-events-none: this box cannot be pointed at, and cannot be proven by a screenshot.</span>` +
    `</div></div>`;
}

/**
 * The transitions bench: the utilities that only exist while something is
 * moving. Three comparisons — what moves, how long it takes, how it travels —
 * each on boxes the reader hovers, because a transition is a property of the
 * change and not of the element.
 */
function transitionsBench(): string {
  // Every box changes the same four things on hover; the class under test
  // decides which of them actually transition. `transition-none` is the
  // control: it snaps, so the others have something to be faster than.
  const property = [
    "transition-all",
    "transition-colors",
    "transition-transform",
    "transition-opacity",
    "transition-shadow",
    "transition-none",
  ].map((cls) =>
    `<div class="flex w-1/3 shrink-0 flex-col items-start gap-1">` +
    `<i class="block h-16 w-16 rounded-sm bg-neutral-300 ${cls} duration-base ease-standard hover:bg-accent hover:translate-x-8 hover:opacity-50 hover:shadow-lg"></i>` +
    `<code class="${CAP}">${cls}</code></div>`
  ).join("");

  // The same movement at three durations: the difference is the arrival, not
  // the destination.
  const duration = ["duration-fast", "duration-base", "duration-slow"].map(
    (cls) =>
      `<div class="flex w-1/3 shrink-0 flex-col items-start gap-1">` +
      `<i class="block h-16 w-16 rounded-sm bg-neutral-300 transition-all ${cls} ease-standard hover:bg-accent hover:translate-x-8"></i>` +
      `<code class="${CAP}">${cls}</code></div>`,
  ).join("");

  // The same movement on four curves: the difference is the travel, not the
  // arrival.
  const easing = [
    "ease-linear",
    "ease-standard",
    "ease-decelerate",
    "ease-accelerate",
  ].map((cls) =>
    `<div class="flex w-1/4 shrink-0 flex-col items-start gap-1">` +
    `<i class="block h-16 w-16 rounded-sm bg-neutral-300 transition-all duration-base ${cls} hover:bg-accent hover:translate-x-8"></i>` +
    `<code class="${CAP}">${cls}</code></div>`
  ).join("");

  return `<div class="${CHROME.panel}">` +
    `<div class="${CHROME.label}">hover a box — the movement is the demonstration</div>` +
    `<div class="flex flex-col gap-6">` +
    `<div><div class="${CHROME.label}">what moves</div>` +
    `<div class="${CHROME.railWrap}">${property}</div></div>` +
    `<div><div class="${CHROME.label}">how long it takes</div>` +
    `<div class="${CHROME.railWrap}">${duration}</div></div>` +
    `<div><div class="${CHROME.label}">how it travels</div>` +
    `<div class="${CHROME.railWrap}">${easing}</div></div>` +
    `</div></div>`;
}

/** The prose that explains why a family's sample is the sample it is. */
function captionFor(demo: Demo): string {
  return DEMO_SAMPLE[demo];
}

/**
 * One family: a scale (steps as controls on one preview) or a prose block with
 * a working demonstration and a live rail.
 */
function family(
  group: { id: string; title: string; utilities: readonly string[] },
): string {
  const demo = demoFor(group.id);
  const scale = scaleFor(group.id, group);

  if (scale !== undefined) return scaleBody(scale, group);

  const note = noteFor(group.id);
  const headline = demoClass(HEADLINE[group.id] ?? group.utilities[0] ?? "");
  const lead = demo === undefined ? noSampleLead(group.id) : captionFor(demo);
  const extra = note !== undefined
    ? `<p class="${CHROME.noteBox}">${escapeHtml(note)}</p>`
    : "";
  const bench = group.id === "variants"
    ? variantsBench()
    : group.id === "interactivity"
    ? interactivityBench()
    : group.id === "transitions"
    ? transitionsBench()
    : "";
  // The transitions stage was a before/after pair on a still box, which
  // demonstrates nothing: the bench above is the demonstration.
  const stage = demo === undefined || group.id === "transitions"
    ? ""
    : beforeAfter(group.id, demo, headline);
  const rail = demo === undefined
    ? `<ul class="${CHROME.nameList}">${
      group.utilities.map((n) =>
        `<li><code class="font-mono text-xs text-text-muted">${
          escapeHtml(n)
        }</code></li>`
      ).join("")
    }</ul>`
    : nameRail(group.id, demo, group.utilities);

  return `<section class="${CHROME.section}">` +
    `<h3 class="${CHROME.subhead}">${escapeHtml(group.title)}` +
    `<span class="${CHROME.railCount} ml-2">${group.utilities.length}</span></h3>` +
    `<p class="${CHROME.prose}">${escapeHtml(lead)}</p>` +
    stage + extra + bench +
    rail +
    `</section>`;
}

/** A scale: one preview, with the steps and the axes as controls on it. */
function scaleBody(
  scale: BuiltScale,
  group: { id: string; utilities: readonly string[] },
): string {
  const step = scale.steps[0]?.key ?? "";
  const axis = scale.axes[0]?.key ?? "";
  // The PREFIX, not the group id: the padding scale is spelled `p-4`, and
  // handing `scaleClass` the group name produced `padding-0` — not a utility,
  // so the preview rendered as an unstyled box that looked like a broken one.
  const prefix = SCALE_PREFIX[group.id] ?? group.id;
  const cls = scaleClass(prefix, axis, step);
  const demo = demoFor(group.id) ?? "inset";
  const shown = demoClass(cls);

  // The names a scale cannot show as steps: `gap-x-4` beside `gap-4`, or
  // `me-auto` on an edge list that has no `me`. They appear in the rail rather
  // than dropped, because a catalogue that hides names is a catalogue that
  // cannot be trusted to be complete.
  const claimed = new Set(
    scale.steps.flatMap((s) =>
      scale.axes.map((a) => scaleClass(prefix, a.key, s.key))
    ),
  );
  const rest = group.utilities.filter((n) => !claimed.has(n));
  const restRail = rest.length === 0
    ? ""
    : `<h4 class="${CHROME.label}">and the names a step cannot reach</h4>` +
      nameRail(group.id, demo, rest);

  // The pressed button is ALSO the aria-current one, because the selected
  // state is drawn by the theme's own text-on-surface pair through the
  // `aria-[current]:` utilities — and a state the stylesheet cannot see is a
  // state it cannot draw.
  const buttons = (
    items: readonly { key: string; label?: string }[],
    kind: string,
  ) =>
    items.map((it) => {
      const pressed = it.key === (kind === "step" ? step : axis);
      return `<button type="button" class="${CHROME.chip}" data-${kind}="${
        escapeHtml(it.key)
      }"` +
        ` aria-pressed="${pressed}"${pressed ? ' aria-current="true"' : ""}>` +
        `${escapeHtml(it.label ?? it.key)}</button>`;
    }).join("");

  return `<section class="${CHROME.section}" data-scale-group="${
    escapeHtml(scale.id)
  }">` +
    `<h3 class="${CHROME.subhead}">${escapeHtml(scale.title)}` +
    `<span class="${CHROME.railCount} ml-2">${group.utilities.length}</span></h3>` +
    `<p class="${CHROME.prose}">${escapeHtml(scale.blurb)}</p>` +
    `<p class="${CHROME.prose}">${escapeHtml(captionFor(demo))}</p>` +
    `<div class="${CHROME.scaleStage}">${sampleElement(shown, demo, group.id)}</div>` +
    `<div class="${CHROME.scaleControls}">` +
    `<div class="${CHROME.scaleGroup}">` +
    `<h4 class="${CHROME.label}">step <span class="${CHROME.railCount}">${scale.steps.length}</span></h4>` +
    `<div class="${CHROME.scaleButtons}">${
      buttons(scale.steps, "step")
    }</div></div>` +
    (scale.axes.length > 1
      ? `<div class="${CHROME.scaleGroup}">` +
        `<h4 class="${CHROME.label}">edge <span class="${CHROME.railCount}">${scale.axes.length}</span></h4>` +
        `<div class="${CHROME.scaleButtons}">${
          buttons(scale.axes, "axis")
        }</div></div>`
      : "") +
    `</div>` +
    `<pre class="${CHROME.decl}"><code class="${CHROME.declName}" data-scale-name>${
      escapeHtml(cls)
    }</code></pre>` +
    restRail +
    `</section>`;
}

/** The layout surface, cut by mechanism rather than by catalog group. */
export function layoutSurface(
  groups: readonly {
    id: string;
    title: string;
    utilities: readonly string[];
  }[],
): string {
  const names = [...new Set(groups.flatMap((g) => g.utilities))];
  const blocks: string[] = [];

  for (const mechanism of MECHANISMS) {
    const mine = names.filter((n) => mechanismOf(n) === mechanism.id);
    if (mine.length === 0) continue;
    const sample = mechanism.sample();
    blocks.push(
      `<section class="${CHROME.section}">` +
        `<h3 class="${CHROME.subhead}">${escapeHtml(mechanism.title)}` +
        `<span class="${CHROME.railCount} ml-2">${mine.length}</span></h3>` +
        `<p class="${CHROME.prose}">${escapeHtml(mechanism.blurb)}</p>` +
        (sample === ""
          ? ""
          : `<div class="${CHROME.familyDemo}">${sample}</div>`) +
        nameRail(mechanism.title, mechanism.demo, mine) +
        `</section>`,
    );
  }

  return blocks.join("");
}

/** One section of the reference, rendered. */
export function utilityGroupPage(sectionId: string, tree: Parameters<typeof catalogSections>[0]): string {
  const catalog = catalogSections(tree);
  const section = SECTIONS.find((x) => x.id === sectionId);
  if (!section) {
    return `<header class="${CHROME.pageHead}"><h2 class="${CHROME.title}">No such section</h2></header>`;
  }

  const groups = section.groups
    .map((id) => catalog.find((g) => g.id === id))
    .filter((g) => g !== undefined);

  const head = pageHead(
    section.title,
    section.blurb,
    `${utilitiesFor(section, catalog).length} names`,
  );

  if (section.id === "layout") return head + layoutSurface(groups);
  return head + groups.map((g) => family(g)).join("");
}
