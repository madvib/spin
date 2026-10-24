/**
 * The corpus: what the project's source says, as facts rather than findings.
 *
 * Two questions the rules do not answer, because they are not about one
 * class or one element but about the source as a whole:
 *
 *   - **repetition** — the class lists the source writes over and over. A
 *     composition the author writes thirty times is a composition the
 *     project should declare: a shortcut is a class the project composes
 *     once, and the repetition is the argument for it.
 *
 *   - **class order** — the classes in a file that are not in the order the
 *     stylesheet writes them. Utility against utility is source-order: the
 *     last one in the SHEET wins, so a class list that is not in the sheet's
 *     order reads backwards. A formatter's answer: write the classes in the
 *     order the sheet writes them, and the last class in the list is the
 *     last class in the cascade.
 *
 * Neither is a lint rule. A rule judges one node against the system; these
 * two read the corpus, and the corpus is a fact about the project rather
 * than a fault in a file. So they are reported beside the findings and
 * never beside them in the same list.
 *
 * The order is asked of the generator rather than of a list kept here: the
 * sheet the browser gets is the only order there is, and a second list
 * could only ever agree with it by luck.
 */

import type { ThemeDocument } from "../theme/index.ts";
import { parseFile } from "./engine.ts";
import { classListOf } from "./rules.ts";
import { walk } from "./walk.ts";

/* ------------------------------------------------------------- the classes -- */

/**
 * One class attribute in a file, and where its own text sits.
 *
 * The range is the class list's text in the source's offsets — what a
 * rewrite has to replace, and what says which attribute a report is about.
 */
export interface ClassAttribute {
  /** The file the attribute is in. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one. */
  readonly column: number;
  /** The classes, as the author wrote them. */
  readonly classes: readonly string[];
  /** The class list's own text, in the source's offsets. */
  readonly range: readonly [number, number];
}

/**
 * The class attributes a file carries.
 *
 * The same walk the rules walk: a class list the author computed is not
 * read, because there is no text of it to rewrite and no list of it to
 * count.
 */
export function classAttributesOf(
  file: string,
  code: string,
): ClassAttribute[] {
  const ast = parseFile(code, file);
  const out: ClassAttribute[] = [];
  walk(ast, (node) => {
    if (node.type !== "JSXAttribute") return;
    const list = classListOf(node);
    if (list === undefined) return;
    out.push({
      file,
      line: node.loc?.start.line ?? 0,
      column: (node.loc?.start.column ?? 0) + 1,
      classes: list.classes,
      range: list.range,
    });
  });
  return out;
}

/* ----------------------------------------------------------- the repetition -- */

/**
 * A class list the source writes more than once.
 *
 * The classes are the composition as it is written — the order the author
 * wrote them in, because that is the order they read in.
 */
export interface Repetition {
  /** The classes, as the source writes them. */
  readonly classes: readonly string[];
  /** How many times the source writes that list. */
  readonly count: number;
  /** The files that write it. */
  readonly files: readonly string[];
  /** A name a shortcut for it could take. */
  readonly suggested: string;
}

/**
 * The class lists the source repeats.
 *
 * A list of one class is not a composition: a shortcut that stands for a
 * single class saves nothing but the typing, and the corpus is about what
 * the project composes. So only lists of two or more are counted.
 */
export function repetitionsOf(
  attributes: readonly ClassAttribute[],
): Repetition[] {
  const byList = new Map<
    string,
    { classes: string[]; count: number; files: Set<string> }
  >();
  for (const attribute of attributes) {
    if (attribute.classes.length < 2) continue;
    const key = attribute.classes.join(" ");
    const entry = byList.get(key) ?? {
      classes: [...attribute.classes],
      count: 0,
      files: new Set<string>(),
    };
    entry.count += 1;
    entry.files.add(attribute.file);
    byList.set(key, entry);
  }
  const out: Repetition[] = [];
  for (const entry of byList.values()) {
    if (entry.count < 2) continue;
    out.push({
      classes: entry.classes,
      count: entry.count,
      files: [...entry.files],
      suggested: suggestShortcutName(entry.classes),
    });
  }
  // The most repeated first: the composition worth declaring is the one the
  // author writes most, and the order is the report's own — a list whose
  // order is arbitrary reads as a list nobody ranked.
  return out.toSorted((a, b) =>
    b.count - a.count || a.classes.join(" ").localeCompare(b.classes.join(" "))
  );
}

/**
 * A name a shortcut for these classes could take.
 *
 * The shapes are named the way a project names them — a column is a stack,
 * a row is a row — and a composition with no shape of its own is named
 * after what it is made of, so the name says what the shortcut stands for
 * rather than where it came from.
 */
export function suggestShortcutName(classes: readonly string[]): string {
  if (classes.includes("flex-col")) return "stack";
  if (classes.includes("flex-row")) return "row";
  if (classes.includes("justify-between")) return "split";
  if (classes.includes("grid")) return "grid";
  return classes.join("-");
}

/* ------------------------------------------------------------ the class order -- */

/**
 * A class attribute whose classes are not in the order the sheet writes
 * them.
 */
export interface ClassOrder {
  /** The file the attribute is in. */
  readonly file: string;
  /** The line, counted from one. */
  readonly line: number;
  /** The column, counted from one. */
  readonly column: number;
  /** The classes, as the author wrote them. */
  readonly classes: readonly string[];
  /** The same classes, in the order the sheet writes them. */
  readonly ordered: readonly string[];
}

/**
 * The class attributes that are not in the sheet's order.
 *
 * A class the sheet does not write — a shortcut the project declares, a
 * glyph from the icon catalogue — has no place in the order, so it stays
 * where the author put it and the classes the sheet DOES write are ordered
 * around it.
 */
export function classOrderOf(
  attributes: readonly ClassAttribute[],
  order: ReadonlyMap<string, number>,
): ClassOrder[] {
  const out: ClassOrder[] = [];
  for (const attribute of attributes) {
    if (attribute.classes.length < 2) continue;
    const positions = attribute.classes
      .map((cls) => order.get(cls))
      .filter((position): position is number => position !== undefined);
    if (positions.length < 2) continue;
    const ascending = positions.every((position, index) =>
      index === 0 || (positions[index - 1] as number) <= position
    );
    if (ascending) continue;
    out.push({
      file: attribute.file,
      line: attribute.line,
      column: attribute.column,
      classes: attribute.classes,
      ordered: orderedClasses(attribute.classes, order),
    });
  }
  return out;
}

/**
 * The classes in the order the sheet writes them.
 *
 * The classes the sheet knows about fill the slots they already occupied,
 * in the sheet's order; the ones it does not know about stay where the
 * author put them.
 */
export function orderedClasses(
  classes: readonly string[],
  order: ReadonlyMap<string, number>,
): readonly string[] {
  const known: number[] = [];
  const slots: number[] = [];
  classes.forEach((cls, index) => {
    if (!order.has(cls)) return;
    known.push(index);
    slots.push(index);
  });
  const sorted = known
    .map((index) => ({
      cls: classes[index] as string,
      position: order.get(classes[index] as string) as number,
      index,
    }))
    .toSorted((a, b) => a.position - b.position || a.index - b.index);
  const out = [...classes];
  sorted.forEach((entry, at) => {
    out[slots[at] as number] = entry.cls;
  });
  return out;
}

/* ---------------------------------------------------------------- the order -- */

/**
 * The order the preset writes its classes in.
 *
 * Asked of the generator: the sheet the browser gets is the only order
 * there is. The classes are read out of the sheet in the order it writes
 * them, and the first mention of a class is its place — a class the sheet
 * writes twice (a variant and its base) has one place, the earlier one.
 *
 * A generator that cannot be built — a theme the preset will not accept —
 * answers with no order at all, and the caller reports no class order
 * rather than a wrong one.
 */
export async function sheetOrder(
  classes: readonly string[],
  themes: Record<string, ThemeDocument>,
): Promise<ReadonlyMap<string, number>> {
  const out = new Map<string, number>();
  if (classes.length === 0) return out;
  try {
    const { createGenerator } = await import("@unocss/core");
    const { spinPreset } = await import("../preset/index.ts");
    const generator = await createGenerator({
      presets: [spinPreset({ themes })],
    });
    const { css } = await generator.generate(new Set(classes));
    for (
      const match of css.matchAll(/(?<![\w-])\.((?:[a-zA-Z0-9_-]|\\.)+)/g)
    ) {
      const name = (match[1] as string).replace(/\\(.)/g, "$1");
      if (out.has(name)) continue;
      out.set(name, out.size);
    }
  } catch {
    // No order to report: a sheet that cannot be built says nothing about
    // how its classes would be written.
  }
  return out;
}
