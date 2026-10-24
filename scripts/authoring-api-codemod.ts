/**
 * The authoring-API codemod.
 *
 * A machine becomes ONE object whose `on` map is typed over the event
 * MAP, so a transition's KEY narrows the event it receives. The author
 * writes no event union, no event-type guard, and no `Partial<Context>`
 * annotation.
 *
 *   before:  export type XEvent =
 *              | { type: "SET_VALUE"; value: number }
 *              | { type: "PING" };
 *            const config = { on: { SET_VALUE: { actions: [{ assign: "setValue" }] } } };
 *            const implementations = {
 *              assigns: { setValue: (ctx, event) => {
 *                if (event.type !== "SET_VALUE") return {};
 *                return { value: event.value };
 *              } },
 *            };
 *
 *   after:   export interface XEvents {
 *              "SET_VALUE": { value: number };
 *              "PING": {};
 *            }
 *            export type XEvent = EventUnion<XEvents>;
 *            ... createMachine<XContext, XEvents>({
 *              on: { "SET_VALUE": { assign: (_ctx, event) => ({ value: event.value }) } },
 *            })
 *
 * The transforms:
 *
 * - the event UNION becomes an event MAP; the union type is derived.
 * - an assign that answers ONE event moves to its transition, and its
 *   event-type guard goes (the key narrows it).
 * - an assign that answers SEVERAL events stays a named body, above the
 *   spec, typed by the fields it reads.
 * - the `Partial<Context>` return annotations go: the return type is
 *   inferred from the transition.
 * - a cond that answers ONE event moves to its transition; its guard goes.
 *
 * The run is a REPORT: it rewrites the files, and `deno check` referees.
 * It is NOT a parser — the corpus's shapes are regular, and the checker
 * is the arbiter.
 *
 *   deno run -A scripts/authoring-api-codemod.ts [--check]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const COMPONENTS = "packages/components/src";

/** The extent of a balanced expression, stopping at a top-level comma. */
function extent(source: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) break;
    i++;
  }
  return i;
}

/** The brace-matched block that starts at or after `from`. */
function blockOf(
  source: string,
  from: number,
): { readonly text: string; readonly end: number } {
  const start = source.indexOf("{", from);
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { text: source.slice(start, i + 1), end: i + 1 };
    }
    i++;
  }
  throw new Error("unbalanced braces");
}

/**
 * The whole arrow function, from its parameter list: the parameters, the
 * return type, and the body.
 */
function arrowFunction(
  source: string,
  from: number,
): { readonly text: string; readonly end: number } {
  const open = source.indexOf("(", from);
  if (open < 0) throw new Error("no params");
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error("unbalanced params");
  const arrow = source.indexOf("=>", close);
  if (arrow < 0) throw new Error("no arrow");
  let i = arrow + 2;
  while (i < source.length && /\s/.test(source[i] ?? "")) i++;
  if (source[i] === "{") {
    const block = blockOf(source, i);
    return { text: source.slice(open, block.end), end: block.end };
  }
  const end = extent(source, i);
  return { text: source.slice(open, end), end };
}

/** The name of an assign/cond the config refers to, at a reference. */
function referencedName(
  source: string,
  kind: "assign" | "cond",
): string | undefined {
  const match = new RegExp(`${kind}:\\s*"(\\w+)"`).exec(source);
  return match?.[1];
}

/**
 * A parameter list, split on its top-level commas: a type like
 * `XEvent & Record<string, unknown>` has a comma of its own.
 */
function splitParams(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** The context type a machine file names. */
function contextName(source: string): string {
  return /createMachine<(\w+),/.exec(source)?.[1] ?? "object";
}

/** The bracket-matched text that starts at an opening bracket. */
function bracket(
  source: string,
  from: number,
): { readonly text: string; readonly end: number } | undefined {
  const open = source.indexOf("[", from);
  if (open < 0) return undefined;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return { text: source.slice(open, i + 1), end: i + 1 };
    }
  }
  return undefined;
}

/** One member of an event union: its name and its payload. */
interface UnionMember {
  readonly name: string;
  readonly payload: string;
}

/**
 * The union's members, split at the top level. Each is a brace-matched
 * `{ type: "NAME"; ... }`.
 */
function unionMembers(body: string): UnionMember[] {
  const members: UnionMember[] = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("{", i);
    if (open < 0) break;
    // the member's own brace-matched text
    let depth = 0;
    let close = -1;
    for (let j = open; j < body.length; j++) {
      const ch = body[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close < 0) break;
    const text = body.slice(open, close + 1);
    const name = /type:\s*"([^"]+)"/.exec(text)?.[1] ?? "";
    if (name.length > 0) {
      const payload = text
        .replace(/^\{\s*type:\s*"[^"]+";?\s*/, "")
        .replace(/\s*\}$/, "")
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join("; ");
      members.push({ name, payload });
    }
    i = close + 1;
  }
  return members;
}

/**
 * The event union becomes an event MAP.
 *
 *   export type XEvent =
 *     | { type: "SET_VALUE"; value: number }
 *     | { type: "PING" };
 *
 * becomes
 *
 *   export interface XEvents {
 *     "SET_VALUE": { value: number };
 *     "PING": {};
 *   }
 *   export type XEvent = EventUnion<XEvents>;
 *
 * An event name with TWO payload shapes (the pin-input's `VALUE.SET`)
 * becomes a union of payloads under the one name.
 */
function eventMap(
  source: string,
): {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly unionName: string;
} | undefined {
  const head = /\nexport type (\w+)Event =\n/.exec(source);
  if (head === null) return undefined;
  const name = head[1] ?? "";
  const start = head.index + head[0].length;
  // the union runs to the `;` that ends it — at the top level, and NOT
  // inside a comment (a comment's `;` would end it early).
  let depth = 0;
  let i = start;
  let end = -1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? source.length : close + 2;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      const close = source.indexOf("\n", i);
      i = close < 0 ? source.length : close;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      end = i;
      break;
    }
    i++;
  }
  if (end < 0) return undefined;
  const body = source.slice(start, end);
  // the members are found by the splitter; the body is the union alone

  // each member: `| { type: "NAME"; ... }` — with the comments between
  const members: { readonly name: string; readonly payload: string }[] = [];
  // The union's members, split at the top level: each is a brace-matched
  // `{ type: "NAME"; ... }`. A member with two shapes under one name
  // stays two members, and the map's entry becomes a union of payloads.
  for (const member of unionMembers(body)) {
    const name = member.name;
    const payload = member.payload;
    const existing = members.find((m) => m.name === name);
    if (existing === undefined) {
      members.push({ name, payload });
    } else {
      // two shapes under one name: the payloads become a union, each
      // shape braced so the union reads as a union of objects
      members[members.indexOf(existing)] = {
        name: existing.name,
        payload: `{ ${existing.payload} } | { ${payload} }`,
      };
    }
  }
  if (process.argv.slice(2).includes("--verbose")) {
    console.log(`  members: ${members.length}`);
  }
  if (members.length === 0) return undefined;

  const lines = members.map((member) => {
    const payload = member.payload;
    // a UNION of shapes: each shape is already braced
    if (payload.startsWith("{") && payload.includes("} | {")) {
      return `  ${JSON.stringify(member.name)}: ${payload};`;
    }
    return `  ${JSON.stringify(member.name)}: {${
      payload.length > 0 ? ` ${payload} ` : ""
    }};`;
  });
  const text = `\nexport interface ${name}Events {\n${lines.join("\n")}\n}\n` +
    `\nexport type ${name}Event = EventUnion<${name}Events>;\n`;
  return { text, start: head.index, end: end + 1, unionName: `${name}Event` };
}

/** The named bodies of one machine: its assigns and its conds. */
interface Bodies {
  readonly assigns: Map<string, string>;
  readonly conds: Map<string, string>;
}

/** Read a table of named bodies out of a machine file. */
function readBodies(source: string): Bodies {
  const assigns = new Map<string, string>();
  const conds = new Map<string, string>();
  // The tables live in two shapes: inside the spec (4 spaces), or in a
  // separate `implementations` object (2 spaces). Both are read.
  for (
    const [kind, into] of [["assigns", assigns], ["conds", conds]] as const
  ) {
    for (const indent of [4, 2]) {
      const head = new RegExp(`\\n {${indent}}${kind}:\\s*\\{`).exec(source);
      if (head === null) continue;
      const table = blockOf(source, head.index + head[0].length - 1);
      const entry = new RegExp(
        `\\n {${indent + 2}}(\\w+):\\s*(\\(|async|\\w+\\b)`,
        "g",
      );
      for (const match of table.text.matchAll(entry)) {
        const name = match[1] ?? "";
        if (name.length === 0) continue;
        // an entry may be a NAME (an alias for another body) rather than a
        // function
        const kind = match[2] ?? "";
        if (kind !== "(" && kind !== "async") {
          into.set(name, kind);
          continue;
        }
        const body = arrowFunction(
          table.text,
          match.index + match[0].length - 1,
        );
        into.set(name, body.text);
      }
      break;
    }
  }
  return { assigns, conds };
}

/** The event a body answers, from its guard. */
function answeredEvent(body: string): string | undefined {
  const guard = /event\.type\s*!==\s*"([^"]+)"/.exec(body);
  if (guard !== null) return guard[1];
  const check = /event\.type\s*===\s*"([^"]+)"/.exec(body);
  return check?.[1];
}

/** A body with its event-type guard removed. */
function withoutGuard(body: string): string {
  return body
    .replace(/\n\s*if \(event\.type\s*!==\s*"[^"]+"\) return \{\};/g, "")
    .replace(/\n\s*if \(event\.type\s*===\s*"[^"]+"\) return false;/g, "");
}

/**
 * The spec's `on` map, with its references resolved.
 *
 * A transition's `actions: [{ assign: "name" }]` becomes `assign: <the
 * body>`, and a transition's `cond: "name"` becomes `cond: <the body>`.
 * A body used by ONE transition is inlined; a body used by SEVERAL stays
 * a named body above the spec, typed by the fields it reads.
 */
interface Plan {
  /** The bodies used more than once, by name. */
  readonly shared: Map<string, string>;
  /** The bodies used once, by the transition that uses them. */
  readonly inline: Map<string, string>;
  /** How many times each body is used. */
  readonly uses: Map<string, number>;
  /** The body a name ALIASES, when the table entry is only a name. */
  readonly aliases: Map<string, string>;
}

function planBodies(source: string, bodies: Bodies): Plan {
  const uses = new Map<string, number>();
  const aliases = new Map<string, string>();
  for (const match of source.matchAll(/\b(?:assign|cond):\s*"(\w+)"/g)) {
    const name = match[1] ?? "";
    uses.set(name, (uses.get(name) ?? 0) + 1);
  }
  const shared = new Map<string, string>();
  const inline = new Map<string, string>();
  // The bodies another body CALLS must stay named consts: the call names
  // them, and an inlined body has no name to call.
  const called = new Set<string>();
  for (const body of bodies.assigns.values()) {
    // the call names the body directly (the table is already gone from
    // the text): `updateToast(ctx, e)`.
    for (const name of bodies.assigns.keys()) {
      if (new RegExp(`\\b${name}\\(`).test(body)) called.add(name);
    }
  }

  for (const [name, body] of bodies.assigns) {
    // A body that CALLS another body stays a named const: the call names
    // the table, and the table goes.
    const callsAnother = /\b(?:implementations|impl|assignments)\.\w+\.(\w+)\(/
      .test(body);
    if (callsAnother || called.has(name) || (uses.get(name) ?? 0) > 1) {
      shared.set(name, body);
    } else inline.set(name, body);
  }
  for (const [name, body] of bodies.conds) {
    // A cond may be an ALIAS for another body: `isOutOfRange: outOfRange`.
    // The alias resolves to its target, so the transition names the target.
    const alias = /^(\w+)$/.exec(body.trim());
    const aliasName = alias?.[1] ?? "";
    // the alias may name a table entry OR a module-level function
    const target = aliasName.length === 0
      ? undefined
      : bodies.conds.get(aliasName) ?? bodies.assigns.get(aliasName) ??
        (new RegExp(`^(?:export )?const ${aliasName}\\b`, "m").test(source)
          ? aliasName
          : undefined);
    if (target !== undefined) {
      // the transition names the TARGET: an alias is a name, not a body
      aliases.set(name, target);
      if ((uses.get(name) ?? 0) > 1) shared.set(name, target);
      else inline.set(name, target);
      continue;
    }
    if ((uses.get(name) ?? 0) > 1) shared.set(name, body);
    else inline.set(name, body);
  }
  return { shared, inline, uses, aliases };
}

/**
 * A shared body: it answers SEVERAL events, so its event parameter is
 * the map's UNION, and its guard stays.
 */
function typedBody(body: string, eventUnion: string): string {
  const open = body.indexOf("(");
  let depth = 0;
  let close = -1;
  for (let i = open; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (open < 0 || close < 0) return body;
  const params = splitParams(body.slice(open + 1, close) ?? "");
  const typed = params.map((part) => {
    const name = part.split(":")[0]?.trim() ?? "";
    // the event param takes the map's union: a shared body answers several
    // events, and the map is where they live.
    if (/^event$/i.test(name)) return `${name}: ${eventUnion}`;
    if (part.includes(":")) return part;
    return `${name}: unknown`;
  });
  const after = body.slice(close + 1);
  const arrow = after.indexOf("=>");
  if (arrow < 0) return body;
  // The parameter types stay: a shared body answers several events, so
  // it needs the union. The return type stays too: it names a field
  // whose type is narrower than a literal, and the annotation is what
  // keeps it narrow.
  const head = after.slice(0, arrow).trim();
  const rest = after.slice(arrow + 2).trim();
  const block = rest.startsWith("{") ? rest : `{ return ${rest}; }`;
  return `(${typed.join(", ")})${head === "" ? "" : ` ${head}`} => ${block}`;
}

/**
 * A body, as the spec wants it: the parameters lose their types, the
 * return type goes (the transition's type infers it), and the event-type
 * guard goes (the key narrows the event).
 */
function bareBody(body: string): string {
  // a body that is a NAME (an alias to a module-level function) stays a
  // name: there is no function to rewrite.
  if (/^\w+$/.test(body.trim())) return body.trim();
  // the parameter list: `(ctx: X, event: Y)` -> `(ctx, event)`. The list
  // may span lines, so it is matched to its CLOSING paren.
  const open = body.indexOf("(");
  let depth = 0;
  let close = -1;
  for (let i = open; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (open < 0 || close < 0) return body;
  const names = splitParams(body.slice(open + 1, close) ?? "")
    .map((part) => part.split(":")[0]?.trim() ?? "")
    .filter((name) => name.length > 0);
  // the return type: `): Partial<X> =>` -> `) =>`
  const after = body.slice(close + 1);
  const arrow = after.indexOf("=>");
  if (arrow < 0) return body;
  // the return type goes: the transition infers it
  const head = after.slice(0, arrow).replace(/^\s*:\s*[^,]*$/, "").trim();
  const rest = after.slice(arrow + 2).trim();
  // a block body: `{ ... }` — the guard inside goes
  const block = rest.startsWith("{") ? rest : `{ return ${rest}; }`;
  return `(${names.join(", ")})${head === "" ? "" : ` ${head}`} => ${
    withoutGuard(block)
  }`;
}

/**
 * Rewrite a transition's body: its `actions: [{ assign: "x" }]` becomes
 * `assign: <body>`, and its `cond: "x"` becomes `cond: <body>`.
 *
 * The body is INLINED when it answers one transition, and stays a named
 * reference when it answers several. A body that answers one transition
 * has its event-type guard removed: the key narrows the event.
 */
function rewriteTransitions(source: string, plan: Plan): string {
  let out = source;
  // the assigns: `actions: [{ assign: "name" }]` -> `assign: <body>`.
  // a CHAIN of assigns becomes a list.
  // the assigns: `actions: [{ assign: "name" }]` -> `assign: <body>`.
  // a CHAIN of assigns becomes a list. The array is brace-matched, so it
  // may span lines.
  // the actions array, matched to its closing bracket
  let search = 0;
  for (;;) {
    const at = out.indexOf("actions: [", search);
    if (at < 0) break;
    const list = bracket(out, at + "actions: ".length);
    if (list === undefined) break;
    const names = [...list.text.matchAll(/assign:\s*"(\w+)"/g)].map((m) =>
      m[1] ?? ""
    );
    if (names.length === 0) {
      search = at + 1;
      continue;
    }
    const bodies = names.map((name) => {
      const body = plan.inline.get(name);
      return body === undefined ? name : bareBody(body);
    });
    const replacement = bodies.length === 1
      ? `assign: ${bodies[0]}`
      : `assign: [${bodies.join(", ")}]`;
    out = out.slice(0, at) + replacement + out.slice(list.end);
    search = at + replacement.length;
  }
  // the entry and exit: `[{ assign: "name" }]` -> `[{ assign: <body> }]`
  out = out.replace(
    /\b(entry|exit):\s*\[\{[^\]]*\}\]/g,
    (match: string) => {
      const names = [...match.matchAll(/assign:\s*"(\w+)"/g)].map((m) =>
        m[1] ?? ""
      );
      if (names.length === 0) return match;
      const bodies = names.map((name) => {
        const body = plan.inline.get(name);
        return body === undefined ? name : bareBody(body);
      });
      const kind = /^(entry|exit)/.exec(match)?.[1] ?? "entry";
      return `${kind}: [${bodies.map((b) => `{ assign: ${b} }`).join(", ")}]`;
    },
  );
  // an empty `actions: []` goes: the new form has no actions slot
  out = out.replace(/,?\s*actions:\s*\[\]/g, "");

  // the conds: `cond: "name"` -> `cond: <body>`
  out = out.replace(
    /cond:\s*"(\w+)"/g,
    (_match, name: string) => {
      // an ALIAS names its target
      const target = plan.aliases.get(name);
      if (target !== undefined) return `cond: ${target}`;
      const body = plan.inline.get(name);
      if (body === undefined) return `cond: ${name}`;
      return `cond: ${bareBody(body)}`;
    },
  );
  return out;
}

/**
 * The map's entries gain the fields a body reads off its event, when the
 * map does not declare them: the steps' validators, which the bridge
 * attaches at run time.
 */
function withExtraFields(mapText: string, bodies: Bodies): string {
  const extras = new Map<string, Set<string>>();
  for (const body of [...bodies.assigns.values(), ...bodies.conds.values()]) {
    const name = /event\.type\s*!==\s*"([^"]+)"/.exec(body)?.[1] ??
      /event\.type\s*===\s*"([^"]+)"/.exec(body)?.[1];
    if (name === undefined) continue;
    const fields = new Set<string>();
    for (const match of body.matchAll(/event\["(\w+)"\]/g)) {
      fields.add(match[1] ?? "");
    }
    if (fields.size === 0) continue;
    const set = extras.get(name) ?? new Set<string>();
    for (const field of fields) set.add(field);
    extras.set(name, set);
  }
  if (extras.size === 0) return mapText;
  let out = mapText;
  for (const [name, fields] of extras) {
    const entry = new RegExp(`(  ${JSON.stringify(name)}: )\{([^}]*)\}(;)`);
    const found = entry.exec(out);
    if (found === null) continue;
    const declared = [...fields]
      .filter((field) => !(found[2] ?? "").includes(field))
      .map((field) => `${field}?: unknown;`);
    if (declared.length === 0) continue;
    // the existing fields keep their `;` separators
    const existing = (found[2] ?? "").trim();
    const body = existing.length === 0
      ? declared.join(" ")
      : `${existing.replace(/;?$/, "; ")}${declared.join(" ")}`;
    out = out.replace(entry, `$1{ ${body} }$3`);
  }
  return out;
}

/**
 * The per-file pass.
 *
 * 1. the event union becomes an event map;
 * 2. the named bodies become inline transitions (or named bodies above
 *    the spec, when a body answers several transitions);
 * 3. the spec's `assigns`/`conds` tables go.
 */
function convert(source: string): string {
  let out = source;

  // 1. the event map
  const map = eventMap(out);
  if (map !== undefined) {
    // the union's text is REPLACED by the map
    out = out.slice(0, map.start) + map.text + out.slice(map.end);
  }

  // 1a. a const that holds transitions is typed, so its bodies get the
  // narrowing the key gives.
  if (map !== undefined) {
    const mapName = map.unionName.replace(/Event$/, "Events");
    out = out.replace(
      /^const (\w*EVENTS\w*) = \{/m,
      `const $1: Transitions<${contextName(out)}, ${mapName}> = {`,
    );
  }

  // 1a. the `config` const is typed, so its transitions get the narrowing
  if (map !== undefined) {
    const mapName = map.unionName.replace(/Event$/, "Events");
    // the `config` const's type: the full spec, unless it has no context
    // of its own (the call site adds it).
    const configBlock = blockOf(
      out,
      out.indexOf("const config = {") + "const config = ".length,
    );
    const hasContext = /\n {2}context[:,]/.test(configBlock.text);
    const specType = hasContext
      ? `MachineSpec<${contextName(out)}, ${mapName}>`
      : `Omit<MachineSpec<${contextName(out)}, ${mapName}>, "context">`;
    out = out.replace(
      /^const config = \{/m,
      `const config: ${specType} = {`,
    );
  }

  // 1b. the file imports what the new shape needs
  if (map !== undefined) {
    out = out.replace(
      /import \{([^}]*)\} from "@spin\/runtime\/fsm";/,
      (match: string, names: string) => {
        const list = names.split(",").map((n) => n.trim()).filter((n) =>
          n.length > 0
        );
        if (!list.some((n) => n === "type EventUnion")) {
          list.push("type EventUnion");
        }
        if (
          out.includes("MachineSpec<") &&
          !list.some((n) => n === "type MachineSpec")
        ) {
          list.push("type MachineSpec");
        }
        if (
          out.includes("Transitions<") &&
          !list.some((n) => n === "type Transitions")
        ) {
          list.push("type Transitions");
        }
        return `import { ${list.join(", ")} } from "@spin/runtime/fsm";`;
      },
    );
  }

  // 1c. the spec names the MAP, not the union
  if (map !== undefined) {
    const unionName = map.unionName;
    const mapName = unionName.replace(/Event$/, "Events");
    out = out.replace(
      new RegExp(`createMachine<(\\w+), ${unionName}>`, "g"),
      `createMachine<$1, ${mapName}>`,
    );
    out = out.replace(
      new RegExp(`Machine<(\\w+), ${unionName}>`, "g"),
      `Machine<$1, ${mapName}>`,
    );
  }

  // 2. the bodies. A body's call to another body names the table: the
  // table goes, so the call names the body — and the rewrite happens
  // before the bodies are read, so a shared body carries it.
  out = out.replace(
    /\b(?:implementations|impl|assignments)\.\w+\.(\w+)\(/g,
    "$1(",
  );
  const bodies = readBodies(out);
  // the map's entries gain the fields a body reads off its event
  if (map !== undefined) {
    const from = out.indexOf(map.text);
    if (from >= 0) {
      const widened = withExtraFields(map.text, bodies);
      out = out.slice(0, from) + widened + out.slice(from + map.text.length);
    }
  }
  if (process.argv.slice(2).includes("--verbose")) {
    console.log(
      `  bodies: assigns=${bodies.assigns.size} conds=${bodies.conds.size}`,
    );
  }
  const plan = planBodies(out, bodies);
  if (process.argv.slice(2).includes("--verbose")) {
    console.log(`  inline: ${[...plan.inline.keys()].join(",")}`);
  }
  out = rewriteTransitions(out, plan);

  // 3. an alias's target: a module-level function the alias names must
  //    be declared before the spec that uses it.
  for (const [alias, target] of plan.aliases) {
    if (!/^\w+$/.test(target)) continue;
    const decl = new RegExp(`^(?:export )?const ${target}\\b`, "m");
    const at = out.search(decl);
    if (at < 0) continue;
    const use = out.indexOf(`cond: ${target}`);
    if (use < 0 || use > at) continue;
    // The declaration moves to the MODULE's top: the use may sit inside
    // an object literal, where a declaration cannot go. The declaration
    // may span lines, so it runs to its `;`.
    const lineStart = out.lastIndexOf("\n", at) + 1;
    let lineEnd = out.indexOf("\n", at) + 1;
    if (!out.slice(lineStart, lineEnd).trimEnd().endsWith(";")) {
      const semi = out.indexOf(";", lineEnd);
      if (semi > 0) lineEnd = semi + 1;
    }
    const declText = out.slice(lineStart, lineEnd);
    out = out.slice(0, lineStart) + out.slice(lineEnd);
    // the module's top: after the imports and after the file's leading
    // declarations (the types), so the declaration is not spliced into
    // one of them.
    const imports = [...out.matchAll(/^import [\s\S]*?;$/gm)];
    const last = imports[imports.length - 1];
    const afterImports = last === undefined ? 0 : last.index + last[0].length;
    // the first top-level `export` after the imports
    const afterTypes = out.slice(afterImports).search(/^export /m);
    const top = afterTypes < 0 ? afterImports : afterImports + afterTypes;
    out = out.slice(0, top) + declText + "\n" + out.slice(top);
    void alias;
  }

  // 3. the calls are already rewritten (above, before the bodies were read)

  // 3. the spec's references to the tables go
  out = out.replace(/\n {4}(assigns|conds): implementations\.\1,/g, "");
  out = out.replace(/\n {4}(assigns|conds): implementations\.\1\n/g, "\n");
  out = out.replace(/\n {4}\.\.\.implementations,/g, "");

  // 4. the tables become named consts ABOVE the spec
  for (
    const [kind, table] of [["assigns", "assigns"], ["conds", "conds"]] as const
  ) {
    for (const indent of [4, 2]) {
      out = out.replace(
        new RegExp(`\\n {${indent}}${table}: \\{`),
        `\n${" ".repeat(indent)}__${kind.toUpperCase()}__: {`,
      );
    }
  }
  const union = map === undefined
    ? "EventObject"
    : `EventUnion<${map.unionName.replace(/Event$/, "Events")}>`;
  out = hoistTables(out, plan, bodies, union);
  return out;
}

/**
 * The named tables become consts above the spec, and the spec's reference
 * to them is the const's name.
 *
 * A body that answers ONE transition is INLINED at that transition, and
 * its event-type guard goes: the key narrows the event. A body that
 * answers SEVERAL stays a const, above the spec.
 */
function hoistTables(
  source: string,
  plan: Plan,
  bodies: Bodies,
  eventUnion: string,
): string {
  let out = source;
  const consts: string[] = [];

  // the tables go, from the LAST to the first: removing the first would
  // shift the second's position.
  const markers = [...out.matchAll(/\n {2,4}__(ASSIGNS|CONDS)__: \{/g)]
    .reverse();
  for (const marker of markers) {
    const kind = marker[1] === "ASSIGNS" ? "assigns" : "conds";
    const tableStart = marker.index + marker[0].length - 1;
    const block = blockOf(out, tableStart);
    const names = kind === "assigns" ? bodies.assigns : bodies.conds;
    // the SHARED bodies become consts: a body another body calls, or a
    // body that answers several transitions.
    for (const [name, body] of plan.shared) {
      if (!names.has(name)) continue;
      consts.push(`const ${name} = ${typedBody(body, eventUnion)};`);
    }
    // the table goes, and the comma that followed it
    let after = block.end;
    while (after < out.length && /[\s,]/.test(out[after] ?? "")) after++;
    out = out.slice(0, marker.index) + out.slice(after);
  }

  if (consts.length > 0) {
    // The consts go above the machine's spec — and above the `config`
    // const, which the spec spreads and whose transitions use them.
    // The consts go at the MODULE's top level, before the machine's
    // spec: a spec may live in its own const, and a body used inside an
    // object literal cannot be declared there.
    const firstUse = consts
      .map((c) => /^const (\w+)/.exec(c)?.[1] ?? "")
      .map((name) => (name.length === 0 ? -1 : out.indexOf(name)))
      .filter((at) => at >= 0)
      .sort((a, b) => a - b)[0] ?? -1;
    if (firstUse > 0) {
      // the module's top: after the LAST import statement
      // The module's top: after the last import. The import block is
      // found by its LAST statement, which is the one that ends with `;`.
      const imports = [...out.matchAll(/^import [\s\S]*?;$/gm)];
      const last = imports[imports.length - 1];
      const importEnd = last === undefined ? 0 : last.index + last[0].length;
      const block = consts.join("\n\n");
      out = out.slice(0, importEnd) + "\n" + block + "\n\n" +
        out.slice(importEnd);
    }
  }
  return out;
}

if (import.meta.main) {
  const check = process.argv.slice(2).includes("--check");
  const only = process.argv.slice(2).find((arg) => arg.startsWith("--only="))?.slice(
    "--only=".length,
  );
  const files: string[] = [];
  for (const dir of readdirSync(COMPONENTS, { withFileTypes: true })) {
    if (!dir.isDirectory) continue;
    if (
      only !== undefined && !dir.name.includes(only) &&
      !dir.name.replace(/^spin-/, "").includes(only)
    ) {
      continue;
    }
    // the machine file: the component's own name, which is not always the
    // directory's (the cascade-select's is `cascade`).
    const machines = [...readdirSync(`${COMPONENTS}/${dir.name}`, { withFileTypes: true })]
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".machine.ts"));
    if (machines.length === 0) continue;
    const path = `${COMPONENTS}/${dir.name}/${machines[0] ?? ""}`;
    files.push(path);
  }
  for (const path of files) {
    const source = readFileSync(path, "utf8");
    const out = convert(source);
    if (out === source) continue;
    if (check) {
      console.log(`would rewrite ${path}`);
    } else {
      writeFileSync(path, out);
      console.log(`rewrote ${path}`);
    }
    // the test file names the map too
    const test = path.replace(/\.machine\.ts$/, ".machine.test.ts");
    let testSource: string;
    try {
      testSource = readFileSync(test, "utf8");
    } catch {
      testSource = "";
    }
    if (testSource !== "") {
      const unionName =
        /export type (\w+)Event = EventUnion</.exec(out)?.[1] !== undefined
          ? `${/export type (\w+)Event = EventUnion</.exec(out)?.[1]}Event`
          : undefined;
      if (unionName !== undefined) {
        const mapName = unionName.replace(/Event$/, "Events");
        const testOut = testSource
          .replace(new RegExp(`\\btype ${unionName},`, "g"), `type ${mapName},`)
          .replace(
            new RegExp(`Service<(\\w+), ${unionName}>`, "g"),
            `Service<$1, ${mapName}>`,
          )
          .replace(
            new RegExp(`Machine<(\\w+), ${unionName}>`, "g"),
            `Machine<$1, ${mapName}>`,
          );
        if (testOut !== testSource) {
          if (check) console.log(`would rewrite ${test}`);
          else {
            writeFileSync(test, testOut);
            console.log(`rewrote ${test}`);
          }
        }
      }
    }

    // the legacy bridge: it names the union where the map belongs
    const legacy = path.replace(/\.machine\.ts$/, ".bridge.ts");
    let legacySource: string;
    try {
      legacySource = readFileSync(legacy, "utf8");
    } catch {
      legacySource = "";
    }
    if (legacySource !== "") {
      const legacyStem = /export type (\w+)Event = EventUnion</.exec(out)?.[1];
      const legacyUnion = legacyStem === undefined
        ? undefined
        : `${legacyStem}Event`;
      if (legacyUnion !== undefined) {
        const legacyMap = legacyUnion.replace(/Event$/, "Events");
        const legacyOut = legacySource
          .replace(
            new RegExp(`\\btype ${legacyUnion},`, "g"),
            `type ${legacyMap},`,
          )
          .replace(
            new RegExp(`Service<(\\w+), ${legacyUnion}>`, "g"),
            `Service<$1, ${legacyMap}>`,
          )
          .replace(
            new RegExp(`function send\\(event: ${legacyUnion}\\)`, "g"),
            `function send(event: EventUnion<${legacyMap}>)`,
          )
          .replace(
            /import \{([^}]*)\} from "@spin\/runtime\/fsm";/,
            (match: string, names: string) => {
              const list = names.split(",").map((n) => n.trim()).filter((n) =>
                n.length > 0
              );
              if (!list.some((n) => n === "type EventUnion")) {
                list.push("type EventUnion");
              }
              return `import { ${list.join(", ")} } from "@spin/runtime/fsm";`;
            },
          );
        if (legacyOut !== legacySource) {
          if (check) console.log(`would rewrite ${legacy}`);
          else {
            writeFileSync(legacy, legacyOut);
            console.log(`rewrote ${legacy}`);
          }
        }
      }
    }

    // the bindings name the map too
    const bindings = path.replace(/\.machine\.ts$/, ".bindings.ts");
    let bindingSource: string;
    try {
      bindingSource = readFileSync(bindings, "utf8");
    } catch {
      continue;
    }
    const unionName =
      /export type (\w+)Event = EventUnion</.exec(out)?.[1] !== undefined
        ? `${/export type (\w+)Event = EventUnion</.exec(out)?.[1]}Event`
        : /export type (\w+)Event =\n/.exec(source)?.[1];
    if (unionName === undefined) {
      if (process.argv.slice(2).includes("--verbose")) {
        console.log(`  no union name for ${path}`);
      }
      continue;
    }
    if (process.argv.slice(2).includes("--verbose")) {
      console.log(`  union name: ${unionName}`);
    }
    const bindingOut = convertBindings(bindingSource, unionName);
    if (process.argv.slice(2).includes("--verbose")) {
      console.log(`  binding changed: ${bindingOut !== bindingSource}`);
    }
    if (bindingOut === bindingSource) {
      if (process.argv.slice(2).includes("--verbose")) {
        console.log(`  bindings unchanged: ${bindings}`);
      }
      continue;
    }
    if (check) {
      console.log(`would rewrite ${bindings}`);
    } else {
      writeFileSync(bindings, bindingOut);
      console.log(`rewrote ${bindings}`);
    }
  }
}

/**
 * The bindings name the MAP, where they used to name the union: the
 * component's event type parameter is the map, so the component's
 * `ComponentDef` and `defineComponent` take the map.
 */
function convertBindings(source: string, unionName: string): string {
  const mapName = unionName.replace(/Event$/, "Events");
  let out = source.replace(
    new RegExp(`\\btype ${unionName},`, "g"),
    `type ${mapName},`,
  );
  out = out.replace(
    new RegExp(`\\b${unionName}, ${unionName}\\b`, "g"),
    `${unionName}, ${mapName}`,
  );
  out = out.replace(
    new RegExp(`(ComponentDef<\\w+, )${unionName}(>)`, "g"),
    `$1${mapName}$2`,
  );
  out = out.replace(
    new RegExp(`(defineComponent<\\w+, )${unionName}(,)`, "g"),
    `$1${mapName}$2`,
  );
  // the re-export at the end
  out = out.replace(
    new RegExp(`\\n {2}${unionName},`, "g"),
    `\n  ${mapName},`,
  );
  return out;
}
