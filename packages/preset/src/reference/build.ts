import { EDGES, type Axis, type Scale } from "./scale.ts";
import type { Sample } from "../organization.ts";

/**
 * The scales, built from the catalog.
 *
 * A reference that enumerates tells a reader nothing: forty-two `p-*` names in
 * a column is a list of the same thing forty-two times. What a scale actually
 * has is a STEPS axis — seven values — and a MODIFIER axis — seven edges — and
 * that product is one thing to look at with a control on it, not a page of
 * rows.
 *
 * So each scale is shown once. The reader picks a step, picks an edge, and
 * watches one preview move. That is the information the forty-two rows were
 * hiding: that `px-8` and `pb-8` are the same value on different edges, and
 * that the steps are a geometric ramp.
 *
 * Derived from `describeCatalog`, so a step the theme adds appears here without
 * anyone editing this file. A group whose names do not fit the pattern is
 * reported rather than dropped — a utility that silently disappears from the
 * reference is the bug this surface was built to end.
 */

/** The theme's own scale, so a step can show what it resolves to. */
type Values = Readonly<Record<string, string>>;

export interface ScaleSource {
  readonly id: string;
  readonly utilities: readonly string[];
}

/** How a scale's group is named, so `px-4` splits into an axis and a step. */
export interface Shape {
  readonly prefix: string;
  readonly axes?: readonly Axis[];
}

const EDGE_AXES: readonly Axis[] = EDGES;

/**
 * Split `px-4` into the axis `px` and the step `4`; `p-4` into `` and `4`.
 *
 * A single dash means a bare step, two means a modifier. Anything deeper is not
 * a step — `gap-x-4` is an axis and a step on a different prefix — and is
 * reported rather than guessed at.
 */
function split(
  name: string,
  prefix: string,
): { axis: string; step: string } | undefined {
  if (!name.startsWith(`${prefix}-`)) return undefined;
  const rest = name.slice(prefix.length + 1);
  const dash = rest.indexOf("-");
  if (dash === -1) return { axis: "", step: rest };
  const axis = rest.slice(0, dash);
  const step = rest.slice(dash + 1);
  if (axis === "" || step === "" || step.includes("-")) return undefined;
  return { axis, step };
}

/**
 * Steps sort by their numeric value, because that IS the scale.
 *
 * Alphabetical would give `p-0 p-1 p-16 p-2 p-4 p-8`, which destroys the only
 * thing a scale communicates. Fractional and suffixed steps sort after their
 * numeric neighbours rather than before them.
 */
function compareSteps(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return a.localeCompare(b);
}

export interface BuiltScale extends Scale {
  /** Names that fit neither the step nor the axis pattern. */
  readonly unmatched: readonly string[];
}

export function buildScale(
  group: ScaleSource,
  shape: Shape,
  meta: { title: string; blurb: string; sample?: Sample; values?: Values },
): BuiltScale {
  const axes = shape.axes ?? [];
  const known = new Set(axes.map((a) => a.key));
  const steps = new Set<string>();
  const unmatched: string[] = [];

  for (const name of group.utilities) {
    const parts = split(name, shape.prefix);
    // A name that is not this prefix at all is ANOTHER scale that happens to
    // share the group — `gap-x-4` in the `gap` group alongside `gap-4`. It
    // belongs to its own entry, not here, so it is not an error.
    if (parts === undefined) {
      if (name.startsWith(shape.prefix)) unmatched.push(name);
      continue;
    }
    if (!known.has(parts.axis)) {
      unmatched.push(name);
      continue;
    }
    steps.add(parts.step);
  }

  return {
    id: group.id,
    title: meta.title,
    blurb: meta.blurb,
    steps: [...steps].sort(compareSteps).map((key) => ({
      key,
      value: meta.values?.[key],
    })),
    axes: axes.length > 0 ? axes : [{ key: "", label: "only" }],
    sample: meta.sample ?? "box",
    unmatched,
  };
}

/**
 * The class a step and axis produce together: `p-4`, or `px-4`.
 *
 * An axis is the SUFFIX of the prefix, not a segment of it — `split` reads
 * `px-4` as the axis `x` on the prefix `p`, so it is written back with no
 * dash between them. Joining with a dash produced `p-x-4`, which no rule
 * matches: the preview silently lost its styling the moment an edge other
 * than `all` was chosen.
 */
export function scaleClass(
  prefix: string,
  axis: string,
  step: string,
): string {
  return axis === "" ? `${prefix}-${step}` : `${prefix}${axis}-${step}`;
}

export { EDGES, EDGE_AXES };
export type { Axis, Sample, Scale };