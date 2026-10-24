/**
 * The machine-object codemod.
 *
 * A machine becomes an OBJECT: its contract, and the factory that
 * builds it. The contract travels with the machine, so the framework
 * gates the arguments before the factory is called — and the machine's
 * own gate goes.
 *
 *   before:  export function slider(args, authored): Machine<C, E> {
 *              return createMachine<C, E>({ ...config, context: initial(args, authored) });
 *            }
 *
 *   after:   export const slider: MachineObject<C, E> = {
 *              fields: { value: { event: "SET_VALUE" } },
 *              create: (args: SliderArgs) =>
 *                createMachine<C, E>({ ...config, context: initial(args) }),
 *            };
 *
 * The gate shapes, and what each becomes:
 *
 * - `f(args.x) ?? D`  ->  `f(args.x) ?? D`   (the transform already
 *   handles an absent argument: the legacy seed called it on one)
 * - `args.x === Y`   ->  `args.x === Y`    (an absent argument gives
 *   the default, which is what the else branch held)
 * - `f(args.x)`       ->  `f(args.x) ?? D`  (the transform's nullish
 *   result falls back to the default)
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const COMPONENTS = "packages/components/src";

/** The extent of an expression, stopping at a top-level `,`, `;` or `:`. */
function extent(source: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if ((ch === "," || ch === ";" || ch === ":") && depth === 0) break;
    else if (ch === "\n" && depth === 0) {
      const next = source.slice(i + 1, i + 40);
      if (!/^\s*[)\]},]?/.test(next)) break;
    }
    i += 1;
  }
  return i;
}

/** A ternary's branches. */
function ternary(
  source: string,
  questionMark: number,
): { then: string; other: string; end: number } {
  const thenEnd = extent(source, questionMark + 1);
  const then = source.slice(questionMark + 1, thenEnd).trim();
  let depth = 0;
  let i = questionMark + 1;
  let colon = -1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === ":" && depth === 0) {
      colon = i;
      break;
    }
    i += 1;
  }
  const otherEnd = extent(source, colon + 1);
  const other = source.slice(colon + 1, otherEnd).trim();
  return { then, other, end: otherEnd };
}

/** The `written` helper, with or without its comment. */
const HELPER =
  /\n(?: {2}\/\/[^\n]*\n)? {2}const written = \(field: string\): boolean =>\n(?: {4}[^\n]*\n)+ {2}(?:authored\(defaultTwin\(field\)\)|\);)\n/;

let done = 0;
let skipped: string[] = [];
for (const entry of readdirSync(COMPONENTS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = `${COMPONENTS}/${entry.name}`;
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".machine.ts")) continue;
    if (file.name.endsWith(".machine.test.ts")) continue;
    const path = `${dir}/${file.name}`;
    let source = readFileSync(path, "utf8");

    // 1. the factory header -> the machine object
    const head =
      /export function (\w+)\(\s*\n(\s*)args: (\w+) = \{\},\s*\n(\s*)authored: \(name: string\) => boolean,\s*\n\): Machine<([^>]*)> \{\n(\s*)return createMachine<([^>]*)>\(\{\n/
        .exec(source);
    if (head === null) {
      skipped.push(path);
      continue;
    }
    const fn = head[1]!;
    const indent = head[2]!;
    const argsType = head[3]!;
    const ret = head[5]!;

    // 2. the contract: the `fields:` block, hoisted out of the call
    const fieldsAt = source.indexOf(
      "    fields: {",
      head.index + head[0].length,
    );
    if (fieldsAt < 0) {
      skipped.push(path);
      continue;
    }
    const fieldsOpen = source.indexOf("{", fieldsAt);
    let depth = 0;
    let fieldsEnd = fieldsOpen;
    for (let i = fieldsOpen; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          fieldsEnd = i + 1;
          break;
        }
      }
    }
    const fieldsBody = source.slice(fieldsOpen + 1, fieldsEnd - 1);
    // the call's body, without the fields block
    const callBody = source.slice(head.index + head[0].length, fieldsAt) +
      source.slice(fieldsEnd + 1);

    const ctx = /export interface (\w*Context)\b/.exec(source)?.[1];
    const evt = /export type (\w*Event)\b/.exec(source)?.[1];
    if (ctx === undefined || evt === undefined) {
      skipped.push(path);
      continue;
    }

    // the object
    const object = `export const ${fn}: MachineObject<${ctx}, ${evt}> = {\n` +
      `${indent}fields: {${fieldsBody}\n${indent}},\n` +
      `${indent}create: (args: ${argsType}) =>\n` +
      `${indent}${indent}createMachine<${ret}>({${callBody}`;

    // the tail: the call's `});` -> `})`, then the object's `};`
    // The tail: the createMachine call's closing brace, its `);`, and
    // the function's `}`. The call's brace is found by matching, so the
    // tail is exact whatever the file's shape.
    const callOpen = head.index + head[0].length - 2;
    let d = 0;
    let callClose = callOpen;
    for (let i = callOpen; i < source.length; i += 1) {
      if (source[i] === "{") d += 1;
      else if (source[i] === "}") {
        d -= 1;
        if (d === 0) {
          callClose = i;
          break;
        }
      }
    }
    const afterCall = source.indexOf(";", callClose);
    const afterFn = source.indexOf("\n}", afterCall);
    if (afterCall < 0 || afterFn < 0) {
      skipped.push(path);
      continue;
    }
    const rest = source.slice(afterFn + 2);
    source = source.slice(0, head.index) + object + "\n  })\n};" + rest;

    // 3. the `written` helper and the `authored` parameter go
    source = source.replace(HELPER, "\n");
    source = source.replace(
      /export function initial\(\s*\n(\s*)args: (\w+),\s*\n\s*authored: \(name: string\) => boolean,\s*\n\):/,
      "export function initial(\n$1args: $2,\n):",
    );
    source = source.replace(
      /export function initial\(args: (\w+), authored: \(name: string\) => boolean\):/,
      "export function initial(args: $1):",
    );
    source = source.replace("initial(args, authored)", "initial(args)");

    // 4. the gates go
    let guard = 0;
    while (guard < 40) {
      guard += 1;
      const m = /written\("([A-Za-z]+)"\)\s*\?/.exec(source);
      if (m === null) break;
      const { then, other, end } = ternary(source, m.index + m[0].length - 1);
      let replacement: string;
      if (then.includes("??")) {
        replacement = then;
      } else if (/^args\.[A-Za-z]+ (===|!==) /.test(then)) {
        replacement = then;
      } else if (then.includes("?")) {
        // A nested ternary already holds the default.
        replacement = then;
      } else {
        replacement = `${then} ?? ${other}`;
      }
      source = source.slice(0, m.index) + replacement + source.slice(end);
    }
    if (source.includes("written(") || source.includes("authored(")) {
      skipped.push(path);
      continue;
    }

    // 5. the import
    if (!/type MachineObject/.test(source.slice(0, 3000))) {
      if (/import \{([^}]*)\} from "@spin\/runtime";/.test(source)) {
        source = source.replace(
          /import \{([^}]*)\} from "@spin\/runtime";/,
          (_m, names: string) => {
            const list = sorted(
              names.split(",").map((n) => n.trim()).filter(Boolean),
            );
            list.push("type MachineObject");
            return `import { ${
              sorted(list).join(", ")
            } } from "@spinjs/runtime";`;
          },
        );
      } else {
        const at = /^\*\/\n/m.exec(source)?.index ?? 0;
        const at2 = at > 0 ? at + 3 : 0;
        source = source.slice(0, at2) +
          '\nimport type { MachineObject } from "@spinjs/runtime";\n' +
          source.slice(at2);
      }
    }

    writeFileSync(path, source);
    done += 1;
  }
}
console.log(`converted ${done} machines`);
for (const path of skipped) console.log(`  SKIPPED: ${path}`);

function sorted(items: string[]): string[] {
  return [...new Set(items)].sort();
}
