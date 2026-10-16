import { createMemo, createSignal } from "solid-js";
import { editTokens } from "./editing.ts";
import type { TokenEdit } from "./editing.ts";
import { paintPreview } from "./preview.ts";
import { lockstepEdits } from "./scale.ts";
import type { TokenRow } from "./tokens.ts";

/**
 * A group moving together, and the word it waits for.
 *
 * A linked group is one decision, so one gesture owns all of it: a row's
 * track measures the ratio it produced and proposes every sibling's new
 * value. The proposals are PAINTED — every custom property the family
 * spends lands on the preview surface, so bars and specimens travel under
 * the finger without a single re-render. On release the proposals land as
 * ONE edit, one snapshot of undo; refused, the document's word stands. An
 * abandoned gesture takes its paint with it.
 *
 * The rows themselves are never overlaid with in-flight proposals. A
 * re-render mid-gesture replaces the element under the pointer and kills
 * the drag — the gesture is the thing being protected. Readouts, thumbs
 * and computed geometry follow the document, and the document moves once.
 *
 * The link is the author's and not the theme's, so it lives here rather
 * than in the document: a session's preference, per token group, linked
 * until an author says otherwise.
 */

/** Each group's link, as an author left it this session. */
const [links, setLinks] = createSignal<Readonly<Record<string, boolean>>>({});

/** Whether this group's values currently move together. */
export function linkedFor(group: string): boolean {
  return links()[group] ?? true;
}

/** Set a group's link. */
export function setLinked(group: string, linked: boolean): void {
  setLinks((prev) => ({ ...prev, [group]: linked }));
}

let paint: (() => void) | undefined;

/** The gesture abandoned: nothing painted. */
export function abandon(): void {
  paint?.();
  paint = undefined;
}

function propose(
  steps: readonly TokenRow[],
  path: string,
  next: string,
  linked: boolean,
): void {
  const vars: Record<string, string> = {};
  for (const edit of lockstepEdits(steps, path, next, linked)) {
    const row = steps.find((step) => step.path === edit.path.join("."));
    if (row !== undefined) vars[row.variable] = edit.value;
  }
  paint?.();
  paint = paintPreview(vars);
}

function commit(
  steps: readonly TokenRow[],
  path: string,
  next: string,
  linked: boolean,
): boolean {
  const edits: readonly TokenEdit[] = lockstepEdits(steps, path, next, linked);
  abandon();
  return editTokens(edits);
}

/** One group: its rows as the document holds them, and a gesture's handlers. */
export interface Lockstep {
  /** The token group this lockstep belongs to, named for its controls. */
  readonly name: string;
  /**
   * The group's rows, as the document holds them. Deliberately NOT overlaid
   * with in-flight proposals: see the module note. The paint is the live
   * layer; the rows land with the edit.
   */
  readonly rows: () => readonly TokenRow[];
  /**
   * One row dragged: every linked value proposed and painted, nothing
   * written. A token's own property is painted by this call and not by the
   * control, so the family holds one painter per variable.
   */
  readonly preview: (path: string, next: string) => void;
  /** The gesture's end: the group as ONE edit, or the document's refusal. */
  readonly commit: (path: string, next: string) => boolean;
  /** The gesture abandoned: nothing painted. */
  readonly abandon: () => void;
  /** Whether this group's values currently move together. */
  readonly linked: () => boolean;
}

/**
 * Bind the handlers to one group of rows.
 *
 * The rows are re-read per gesture rather than captured at build: a commit
 * measures its ratio against what the document holds, never against a
 * gesture already in flight.
 */
export function createLockstep(
  group: () => readonly TokenRow[],
  name: string,
): Lockstep {
  const raw = createMemo(group);
  return {
    name,
    rows: raw,
    preview: (path, next) => propose(raw(), path, next, linkedFor(name)),
    commit: (path, next) => commit(raw(), path, next, linkedFor(name)),
    abandon,
    linked: () => linkedFor(name),
  };
}
