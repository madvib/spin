/**
 * The twin gate: a scope's DECLARED DEFAULT must reach the machine.
 *
 * The `value`/`defaultValue` twin is the framework's convention: the host
 * writes `value` to OWN a value, and `defaultValue` to SEED it once. A
 * scope's declared default (`props={ defaultValue: string = "[50]" }`) is
 * that seed, so it must land in the machine exactly as an authored `value`
 * of the same value lands.
 *
 * This is the blind spot the 36 e2e suites had: every assertion was about
 * a gesture, so a component whose default never reached its machine passed
 * all of them. The number-input read `""` where its scope declared `"3"`.
 *
 * The table is the corpus's own — read from each component's scope decls
 * and coerced by the runtime's own grammar — so a component's declared
 * default is checked against the machine it actually ships, and a new
 * component is covered the moment it declares a default.
 */

import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { coerceProps, parseScope } from "@spin/runtime";
import type { PropDecl } from "@spin/syntax";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * linkedom, not happy-dom: the runtime's own test shim, so the DOM here is
 * the DOM the unit tests use.
 */
const { window } = parseHTML("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  document: window.document,
  CustomEvent: window.CustomEvent,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
});

/** A component's bridge, as the framework hands it out. */
interface Bridge {
  createBridge(
    props: () => Record<string, unknown>,
    root: () => Element,
    id: string,
  ): { readonly api: Record<string, unknown> };
}

/** The api's data fields: the readers a consumer can see. */
function readersOf(api: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(api)) {
    if (typeof value === "function") continue;
    out[name] = value;
  }
  return out;
}

/** The twin of a declared default: `defaultValue` is the twin of `value`. */
function twinOf(declared: string): string {
  const rest = declared.slice("default".length);
  return rest.charAt(0).toLowerCase() + rest.slice(1);
}

/** The declared props of one component, read from its scope decls. */
function declaredProps(name: string): PropDecl[] {
  const here = import.meta.dirname ?? ".";
  const examples = join(here, `spin-${name}`, "examples");
  const decls = new Map<string, PropDecl>();
  for (const file of readdirSync(examples)) {
    if (!file.endsWith(".html")) continue;
    for (const decl of parseScope(readFileSync(join(examples, file), "utf8")).props) {
      if (!decls.has(decl.name)) decls.set(decl.name, decl);
    }
  }
  return [...decls.values()];
}

/**
 * Mount a component with a prop bag, the way the element's own store does:
 * the bag is read live, and the props the host wrote are AUTHORED.
 */
function mount(
  component: Bridge,
  props: Record<string, unknown>,
  authored: readonly string[],
): Record<string, unknown> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bridge = component.createBridge(
    () => {
      const bag: Record<string, unknown> = { ...props };
      bag["@@authored"] = (name: string): boolean => authored.includes(name);
      return bag;
    },
    () => root,
    "gate",
  );
  return readersOf(bridge.api as Record<string, unknown>);
}

/** The components under test, with the bridge each ships. */
const COMPONENTS: Readonly<Record<string, Bridge>> = {
  "angle-slider": (await import("./spin-angle-slider/angle-slider.bindings.ts")).angleSlider,
  "cascade-select": (await import("./spin-cascade-select/cascade.bindings.ts")).cascade,
  "color-picker": (await import("./spin-color-picker/color-picker.bindings.ts")).colorPicker,
  "date-input": (await import("./spin-date-input/date-input.bindings.ts")).dateInput,
  "date-picker": (await import("./spin-date-picker/date-picker.bindings.ts")).datePicker,
  "editable": (await import("./spin-editable/editable.bindings.ts")).editable,
  "file-upload": (await import("./spin-file-upload/file-upload.bindings.ts")).fileUpload,
  "floating-panel": (await import("./spin-floating-panel/floating-panel.bindings.ts")).floatingPanel,
  "listbox": (await import("./spin-listbox/listbox.bindings.ts")).listbox,
  menu: (await import("./spin-menu/menu.bindings.ts")).menu,
  "navigation-menu": (await import("./spin-navigation-menu/navigation-menu.bindings.ts"))
    .navigationMenu,
  "number-input": (await import("./spin-number-input/number-input.machine-def.ts")).numberInput,
  pagination: (await import("./spin-pagination/pagination.bindings.ts")).pagination,
  "pin-input": (await import("./spin-pin-input/pin-input.bindings.ts")).pinInput,
  "rating-group": (await import("./spin-rating-group/rating-group.bindings.ts")).ratingGroup,
  select: (await import("./spin-select/select.bindings.ts")).select,
  "signature-pad": (await import("./spin-signature-pad/signature-pad.bindings.ts")).signaturePad,
  slider: (await import("./spin-slider/slider.bindings.ts")).slider,
  splitter: (await import("./spin-splitter/splitter.bindings.ts")).splitter,
  steps: (await import("./spin-steps/steps.bindings.ts")).steps,
  tabs: (await import("./spin-tabs/tabs.bindings.ts")).tabs,
  "tags-input": (await import("./spin-tags-input/tags.bindings.ts")).tags,
  "toggle-group": (await import("./spin-toggle-group/toggle-group.bindings.ts")).toggleGroup,
  "tree-view": (await import("./spin-tree-view/tree-view.bindings.ts")).treeView,
} as unknown as Readonly<Record<string, Bridge>>;

for (const [name, component] of Object.entries(COMPONENTS)) {
  for (const decl of declaredProps(name)) {
    if (!decl.name.startsWith("default")) continue;
    // The declared default, coerced by the runtime's own grammar — the
    // value the element's own store would hold.
    const value = coerceProps([decl], {})[decl.name];
    // An empty default asserts nothing: the declared and the authored
    // bags would both read empty, so the comparison could not fail.
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    const twin = twinOf(decl.name);

    Deno.test(`${name}: the declared ${decl.name} reaches the machine`, () => {
      const declared = mount(component, { [decl.name]: value }, []);
      const authored = mount(component, { [twin]: value }, [twin]);
      const differing: string[] = [];
      for (const key of new Set([...Object.keys(declared), ...Object.keys(authored)])) {
        if (JSON.stringify(declared[key]) !== JSON.stringify(authored[key])) {
          differing.push(`${key}: ${JSON.stringify(declared[key])} != ${JSON.stringify(authored[key])}`);
        }
      }
      assertEquals(
        differing,
        [],
        `the declared ${decl.name} must reach the machine as the authored ${twin} does`,
      );
    });
  }
}
