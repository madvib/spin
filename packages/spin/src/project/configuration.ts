/**
 * The Uno options a project's build configuration declares.
 *
 * A build configuration is a MODULE: it imports its bundler, its plugins and
 * its icon catalogues — none of which a reader can load, and a reader that
 * tried would run a build to answer a question about a class name. So the
 * declaration is read as TEXT, the way the project has always read it.
 *
 * What it declares is the project's own vocabulary and reach: the shortcuts it
 * composes, the content it scans, and the app it mounts. Those are facts about
 * the project, so they are read here — the module that owns the project.
 *
 * Reading is best-effort and says so. A declaration this cannot read is
 * reported as unreadable rather than guessed at: a vocabulary it could not
 * read is one it must not enforce.
 */

import type {
  ExtendsDeclaration,
  ImportedValue,
  ProjectConfiguration,
  ThemeRecordDeclaration,
  VerbatimThemeRef,
} from "./types.ts";

/**
 * The shortcuts a configuration's text declares.
 *
 * `unreadable` is the answer "there is a declaration here and I could not
 * read it". It is not the same as "there are no shortcuts": one is a project
 * that composes nothing, the other is a vocabulary this cannot see.
 */
export interface ShortcutDeclaration {
  /** Each shortcut's name, and the classes it expands to. */
  readonly shortcuts: Readonly<Record<string, readonly string[]>>;
  /** Whether a declaration was found that could not be read. */
  readonly unreadable: boolean;
}

/** The content globs a configuration's text declares. */
export interface ContentDeclaration {
  /** The globs the configuration scans. */
  readonly globs: readonly string[];
  /** Whether a declaration was found that could not be read. */
  readonly unreadable: boolean;
}

/**
 * The configuration a project's text declares.
 *
 * The reader is pure: the text in, the declaration out. The file the text
 * came from is the caller's fact, and it is carried along so a consumer can
 * say which file it read.
 */
export function configurationIn(
  text: string,
  file: string | null,
): ProjectConfiguration {
  const source = withoutComments(text);
  const shortcuts = shortcutsIn(text);
  const content = contentIn(text);
  const themesDirValue = propertyValue(source, "themesDir");
  const componentsDirValue = propertyValue(source, "componentsDir");
  const prefixValue = propertyValue(source, "prefix");
  const unreadableFields: string[] = [];
  const literalOf = (field: string, raw: string | undefined): string | null => {
    if (raw === undefined) return null;
    const text = raw.trim();
    if (
      (text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
      (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
    ) {
      return text.slice(1, -1);
    }
    unreadableFields.push(field);
    return null;
  };
  const themesDir = literalOf("themesDir", themesDirValue?.text) ?? "spin";
  const componentsDir = literalOf("componentsDir", componentsDirValue?.text) ?? "lib/components";
  let prefix: string | null = null;
  if (prefixValue !== undefined) {
    const prefixRaw = prefixValue.text.trim();
    if (prefixRaw !== "null") {
      prefix = literalOf("prefix", prefixValue.text);
    }
  }
  const followed = extendsIn(text);
  return {
    file,
    shortcuts: shortcuts.shortcuts,
    content: content.globs,
    mount: mountIn(text),
    themesDir,
    componentsDir,
    prefix,
    extends: followed,
    verbatimThemes: themesIn(text),
    unreadableFields,
    unreadable: shortcuts.unreadable || content.unreadable,
  };
}

/**
 * The shortcuts a configuration's text declares.
 *
 * Every `shortcuts` property in the text is read: a project may compose more
 * than one table, and each is part of the vocabulary.
 */
export function shortcutsIn(text: string): ShortcutDeclaration {
  const source = withoutComments(text);
  const property = propertyValue(source, "shortcuts");
  if (property === undefined) return { shortcuts: {}, unreadable: false };
  const literal = objectLiteralFor(source, property.text);
  if (literal === undefined) return { shortcuts: {}, unreadable: true };
  const shortcuts: Record<string, string[]> = {};
  let unreadable = false;
  for (const entry of objectEntries(literal)) {
    const classes = classesOf(entry.value);
    if (classes === undefined) {
      // The name is known; its expansion is not. The vocabulary is partial,
      // and a consumer that enforces it must know that.
      unreadable = true;
      continue;
    }
    shortcuts[entry.name] = classes;
  }
  return { shortcuts, unreadable };
}

/**
 * The content globs a configuration's text declares.
 *
 * The `filesystem` entries written as strings: a glob the configuration
 * computes rather than writes is not one this can read, and it says so.
 */
export function contentIn(text: string): ContentDeclaration {
  const source = withoutComments(text);
  const property = propertyValue(source, "content");
  if (property === undefined) return { globs: [], unreadable: false };
  const literal = property.text.trim();
  if (!literal.startsWith("{")) return { globs: [], unreadable: true };
  const filesystem = propertyValue(literal, "filesystem", 0, literal.length);
  if (filesystem === undefined) return { globs: [], unreadable: false };
  const array = filesystem.text.trim();
  if (!array.startsWith("[")) return { globs: [], unreadable: true };
  const globs: string[] = [];
  let unreadable = false;
  for (const entry of arrayEntries(array)) {
    const item = entry.trim();
    if (item.startsWith('"') || item.startsWith("'")) {
      const end = stringEnd(item, 0);
      globs.push(item.slice(1, end - 1));
      continue;
    }
    unreadable = true;
  }
  return { globs, unreadable };
}

/**
 * The app a configuration mounts, as the configuration names it.
 *
 * The argument of the `mount` option: `mountSpinApp(root)` names `root`, and
 * `mountSpinApp(resolve(import.meta.dirname, "../app"))` names the call it
 * passes. The declaration is reported as written — a path is often computed,
 * and a computed path cannot be read without running the module.
 */
export function mountIn(text: string): string | null {
  const source = withoutComments(text);
  const property = propertyValue(source, "mount");
  if (property === undefined) return null;
  const declaration = callArgument(property.text) ?? property.text.trim();
  return declaration === "" ? null : declaration;
}


/**
 * The `extends` value a configuration declares, as the daemon can follow it.
 *
 * The brand is a value the configuration imports: a bare identifier
 * (`extends: acmeBrand`) whose `themes` record is the layer, or an
 * inline `themes` in the same shapes a verbatim map takes. A declared
 * value in none of those shapes answers `unresolved`, and no `extends`
 * at all answers `null`.
 */
export function extendsIn(text: string): ExtendsDeclaration | null {
  const source = withoutComments(text);
  const property = topLevelProperty(source, "extends", "themes");
  if (property === undefined) return null;
  const raw = property.text.trim();
  if (/^[A-Za-z_$][\w$]*$/.test(raw)) {
    const value = importOf(source, raw);
    return value === null ? { kind: "unresolved" } : { kind: "brand", value };
  }
  if (!raw.startsWith("{")) return { kind: "unresolved" };
  const themes = objectEntries(raw).find((entry) => entry.name === "themes");
  if (themes === undefined) return { kind: "unresolved" };
  return { kind: "inline", record: recordOf(source, themes.value) };
}

/**
 * The verbatim `themes:` map a configuration declares, as the daemon can
 * load it.
 *
 * `null` when the configuration declares no `themes:` at all — the
 * daemon then serves the brand layer forked by the local disk. A
 * declared map (even an empty one) replaces the whole stack exactly as
 * the plugin does: the daemon serves what this loads and nothing else.
 */
export function themesIn(text: string): ThemeRecordDeclaration | null {
  const source = withoutComments(text);
  const property = topLevelProperty(source, "themes", "extends");
  if (property === undefined) return null;
  return recordOf(source, property.text);
}

/**
 * The property called `name` that is not nested inside the rival
 * option's value.
 *
 * A theme can be named `extends`, and `extends: { themes: ... }` nests
 * a `themes` of its own: the first textual match is not always the
 * option. Matches inside the rival's span are skipped until one stands
 * outside it — the option the configuration declares.
 */
function topLevelProperty(
  source: string,
  name: string,
  rival: string,
): Value | undefined {
  let from = 0;
  for (;;) {
    const self = propertyValue(source, name, from);
    if (self === undefined) return undefined;
    const other = propertyValue(source, rival, from);
    if (
      other !== undefined && self.start >= other.start && self.end <= other.end
    ) {
      from = other.end;
      continue;
    }
    return self;
  }
}

/**
 * A themes record expression, as the daemon can load it.
 *
 * An object literal is a per-key map; a bare identifier is one import
 * that IS the record. Anything else — a call, a spread-only literal, a
 * name with no import — is a record with no import, which the daemon
 * skips loudly. Entries whose value is not a bare imported identifier
 * are kept with a `null` import so the daemon can say which entry it
 * could not follow.
 */
function recordOf(source: string, expression: string): ThemeRecordDeclaration {
  const raw = expression.trim();
  if (raw.startsWith("{")) {
    if (raw.replace(/\s/g, "") !== "{}") {
      const entries = entriesOf(source, raw);
      if (entries.length > 0) return { kind: "entries", entries };
      return { kind: "record", value: null };
    }
    return { kind: "entries", entries: [] };
  }
  if (/^[A-Za-z_$][\w$]*$/.test(raw)) {
    return { kind: "record", value: importOf(source, raw) };
  }
  return { kind: "record", value: null };
}

/** The entries of a themes object literal, each with its import or none. */
function entriesOf(
  source: string,
  literal: string,
): VerbatimThemeRef[] {
  const entries: VerbatimThemeRef[] = [];
  for (const { name, value } of objectEntries(literal)) {
    const identifier = value.trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(identifier)) {
      entries.push({ key: name, value: null });
      continue;
    }
    entries.push({ key: name, value: importOf(source, identifier) });
  }
  return entries;
}

/**
 * The static value import that binds `name`, if one does.
 *
 * Default, named, and aliased imports resolve to the export to read;
 * namespace imports, type imports, and names bound nowhere answer
 * `null`. Strings are blanked before the scan so an import spelled
 * inside one cannot resolve.
 */
function importOf(source: string, name: string): ImportedValue | null {
  const code = blankStrings(source);
  const pattern = /import\s+([\s\S]*?)\s+from\s*(["'])([^"']*)\2/g;
  for (const match of code.matchAll(pattern)) {
    const clause = (match[1] as string).trim();
    // The source is blanked in the scan text, so it is read back from
    // the original at the same indexes, which blanking preserves.
    const at = (match.index ?? 0) + match[0].length - match[3].length - 1;
    const moduleSource = source.slice(at, at + match[3].length);
    if (clause.startsWith("type ") || clause.startsWith("*")) continue;
    const brace = clause.match(/\{([\s\S]*)\}/);
    if (brace !== null) {
      for (const member of (brace[1] as string).split(",")) {
        const cleaned = member.trim().replace(/^type\s+/, "");
        const aliased = cleaned.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        if (aliased !== null && aliased[2] === name) {
          return { source: moduleSource, exportName: aliased[1] as string };
        }
        if (aliased === null && cleaned === name) {
          return { source: moduleSource, exportName: name };
        }
      }
      continue;
    }
    const head = clause.split(",")[0]!.trim();
    if (head === name) return { source: moduleSource, exportName: "default" };
  }
  return null;
}

/** The text with its strings blanked out. Lengths stay, so indexes hold. */
function blankStrings(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = stringEnd(text, i);
      // The quotes stay so `from "..."` still matches; the contents go.
      out += ch + " ".repeat(Math.max(0, end - i - 2)) + (end - i >= 2 ? text[end - 1] : "");
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
/* ------------------------------------------------------------- the scanner -- */

/** The text with its comments blanked out. The strings stay. */
function withoutComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** The index just past the string that starts at `start`. */
function stringEnd(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    i += 1;
    if (ch === quote) break;
  }
  return i;
}

/** Whether a character can start a name. */
function isNameStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

/** Whether a character can be part of a name. */
function isWordChar(ch: string): boolean {
  return /[\w$]/.test(ch);
}

/** Whether a character is whitespace. */
function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

/** The index just past the literal that starts at `start`. */
function balancedEnd(text: string, start: number, to: number): number {
  const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
  const stack: string[] = [];
  let i = start;
  while (i < to) {
    const ch = text[i] as string;
    if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(text, i);
      continue;
    }
    const close = pairs[ch];
    if (close !== undefined) {
      stack.push(close);
      i += 1;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      if (stack.pop() !== ch) return to;
      i += 1;
      if (stack.length === 0) return i;
      continue;
    }
    i += 1;
  }
  return to;
}

/** The index where an expression ends: a delimiter outside every bracket. */
function expressionEnd(text: string, start: number, to: number): number {
  let i = start;
  while (i < to) {
    const ch = text[i] as string;
    if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(text, i);
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      i = balancedEnd(text, i, to);
      continue;
    }
    if (ch === "," || ch === ";" || ch === ")" || ch === "}" || ch === "]") {
      break;
    }
    if (ch === "\n") break;
    i += 1;
  }
  return i;
}

/** A value, as the text it was written as. */
interface Value {
  /** The value's text. */
  readonly text: string;
  /** The index where the property's key starts. */
  readonly start: number;
  /** The index just past the value. */
  readonly end: number;
}

/** The value that follows a property's colon. */
function expressionAt(
  source: string,
  start: number,
  to: number,
  key: number,
): Value | undefined {
  let i = start;
  while (i < to && isSpace(source[i] as string)) i += 1;
  if (i >= to) return undefined;
  const ch = source[i] as string;
  if (ch === "{" || ch === "[" || ch === "(") {
    const end = balancedEnd(source, i, to);
    if (end <= i) return undefined;
    return { text: source.slice(i, end), start: key, end };
  }
  const end = expressionEnd(source, i, to);
  const text = source.slice(i, end).trim();
  if (text === "") return undefined;
  return { text, start: key, end };
}

/** The value of the property called `name`, as the text it was written as. */
function propertyValue(
  source: string,
  name: string,
  from = 0,
  to = source.length,
): Value | undefined {
  let i = from;
  while (i < to) {
    const ch = source[i] as string;
    if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(source, i);
      continue;
    }
    if (!isNameStart(ch)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < to && isWordChar(source[j] as string)) j += 1;
    const word = source.slice(i, j);
    let k = j;
    while (k < to && isSpace(source[k] as string)) k += 1;
    // A member of something else is not a property of the configuration.
    const previous = i > 0 ? source[i - 1] as string : "";
    if (word === name && source[k] === ":" && previous !== ".") {
      return expressionAt(source, k + 1, to, i);
    }
    i = j;
  }
  return undefined;
}

/** The entries of an object literal: each name, and the text of its value. */
function objectEntries(
  literal: string,
): Array<{ readonly name: string; readonly value: string }> {
  const out: Array<{ readonly name: string; readonly value: string }> = [];
  let i = 1;
  while (i < literal.length) {
    const ch = literal[i] as string;
    if (ch === "}") break;
    if (ch === ",") {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = stringEnd(literal, i);
      let k = end;
      while (k < literal.length && isSpace(literal[k] as string)) k += 1;
      if (literal[k] === ":") {
        const value = expressionAt(literal, k + 1, literal.length, i);
        if (value !== undefined) {
          out.push({ name: literal.slice(i + 1, end - 1), value: value.text });
          i = value.end;
          continue;
        }
      }
      i = end;
      continue;
    }
    if (!isNameStart(ch)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < literal.length && isWordChar(literal[j] as string)) j += 1;
    let k = j;
    while (k < literal.length && isSpace(literal[k] as string)) k += 1;
    if (literal[k] === ":") {
      const value = expressionAt(literal, k + 1, literal.length, i);
      if (value !== undefined) {
        out.push({ name: literal.slice(i, j), value: value.text });
        i = value.end;
        continue;
      }
    }
    // Shorthand: `{ theme }` names the value it spells. Only when the name
    // stands alone — a spread's member is not an entry of this object.
    if (literal[k] === "," || literal[k] === "}" || k >= literal.length) {
      out.push({ name: literal.slice(i, j), value: literal.slice(i, j) });
    }
    i = j;
  }
  return out;
}

/** The entries of an array literal, as the text each was written as. */
function arrayEntries(array: string): string[] {
  const out: string[] = [];
  let i = 1;
  while (i < array.length) {
    const ch = array[i] as string;
    if (ch === "]") break;
    if (ch === "," || isSpace(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = stringEnd(array, i);
      out.push(array.slice(i, end));
      i = Math.max(end, i + 1);
      continue;
    }
    const end = expressionEnd(array, i, array.length);
    const text = array.slice(i, end).trim();
    if (text !== "") out.push(text);
    i = Math.max(end, i + 1);
  }
  return out;
}

/** The classes a shortcut's value expands to, when it says so. */
function classesOf(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const end = stringEnd(trimmed, 0);
    return trimmed.slice(1, end - 1).split(/\s+/).filter(Boolean);
  }
  if (trimmed.startsWith("[")) {
    const out: string[] = [];
    for (const entry of arrayEntries(trimmed)) {
      const item = entry.trim();
      if (!item.startsWith('"') && !item.startsWith("'")) return undefined;
      const end = stringEnd(item, 0);
      out.push(...item.slice(1, end - 1).split(/\s+/).filter(Boolean));
    }
    return out;
  }
  return undefined;
}

/**
 * The object literal a value is, when it names one.
 *
 * A value that is a table kept in a constant of the configuration's own is
 * followed to its declaration: `const studioShortcuts = { … }`. A name
 * declared in another module is not followed — reading it would mean
 * resolving imports, and a table this cannot see is one it must not guess at.
 */
function objectLiteralFor(source: string, value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) return trimmed;
  if (!/^[A-Za-z_$][\w$]*$/.test(trimmed)) return undefined;
  const declaration = new RegExp(
    `\\b(?:const|let|var)\\s+${trimmed}\\s*(?::[^=]*?)?=\\s*\\{`,
  );
  const match = declaration.exec(source);
  if (match === null) return undefined;
  const start = match.index + match[0].length - 1;
  return source.slice(start, balancedEnd(source, start, source.length));
}

/** The argument of a call, when the value is one. */
function callArgument(value: string): string | undefined {
  const match = /^[A-Za-z_$][\w$]*\s*\(([\s\S]*)\)$/.exec(value.trim());
  if (match === null) return undefined;
  return (match[1] as string).trim();
}
