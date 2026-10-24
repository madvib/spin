import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import {
  type TreeApi,
  treeView,
  type VisibleRow,
} from "./tree-view.presentation.ts";
import type {
  TreeCheckedChange,
  TreeExpandedChange,
  TreeFocusChange,
  TreeLoadComplete,
  TreeNodeShape,
  TreeSelectionChange,
} from "./tree-view.state.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

const SAMPLE_TREE: readonly TreeNodeShape[] = [
  {
    value: "src",
    label: "src",
    children: [
      {
        value: "components",
        label: "components",
        children: [
          { value: "button.ts", label: "button.ts" },
        ],
      },
      { value: "index.ts", label: "index.ts" },
    ],
  },
  {
    value: "README.md",
    label: "README.md",
  },
];

function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

function keydown(
  key: string,
  modifiers: Readonly<{ shift?: boolean; ctrl?: boolean; meta?: boolean }> = {},
): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: modifiers.shift === true,
    ctrlKey: modifiers.ctrl === true,
    metaKey: modifiers.meta === true,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  made["stopPropagation"] = (): void => {};
  return made as unknown as KeyboardEvent;
}

function click(
  modifiers: Readonly<{ shift?: boolean; ctrl?: boolean }> = {},
): MouseEvent {
  return {
    shiftKey: modifiers.shift === true,
    ctrlKey: modifiers.ctrl === true,
    defaultPrevented: false,
  } as unknown as MouseEvent;
}

function setup(initialProps: Record<string, unknown> = {}) {
  const expandedChanges: TreeExpandedChange[] = [];
  const selectionChanges: TreeSelectionChange[] = [];
  const focusChanges: TreeFocusChange[] = [];
  const checkedChanges: TreeCheckedChange[] = [];
  const loadCompletes: TreeLoadComplete[] = [];

  const authoredSet = new Set(Object.keys(initialProps));
  const store = signal<Record<string, unknown>>({
    nodes: SAMPLE_TREE,
    ...initialProps,
    "@@authored": (name: string) => authoredSet.has(name) || name === "nodes",
    onExpandedChange: (e: TreeExpandedChange) => expandedChanges.push(e),
    onSelectionChange: (e: TreeSelectionChange) => selectionChanges.push(e),
    onFocusChange: (e: TreeFocusChange) => focusChanges.push(e),
    onCheckedChange: (e: TreeCheckedChange) => checkedChanges.push(e),
    onLoadComplete: (e: TreeLoadComplete) => loadCompletes.push(e),
  });

  const root = (win.document as Document).createElement("div");
  const bridge = treeView.createBridge(() => store(), () => root, "test");
  const api: TreeApi = bridge.api;

  const rowOf = (value: string): VisibleRow => {
    const found = api.getVisibleRows().find((r) => r.node.value === value);
    if (found === undefined) throw new Error(`row ${value} is not visible`);
    return found;
  };

  return {
    api,
    root,
    expandedChanges,
    selectionChanges,
    focusChanges,
    checkedChanges,
    loadCompletes,
    rowOf,
    setProps(patch: Record<string, unknown>) {
      for (const k of Object.keys(patch)) authoredSet.add(k);
      store({ ...store(), ...patch });
    },
    dispose: () => bridge.dispose(),
  };
}

Deno.test("tree-view: collapsed start exposes top-level rows with branch and leaf kinds", () => {
  const h = setup();
  assertEquals(
    h.api.getVisibleRows().map((r) => ({
      value: r.node.value,
      depth: r.depth,
    })),
    [
      { value: "src", depth: 0 },
      { value: "README.md", depth: 0 },
    ],
  );
  const srcRow = h.rowOf("src");
  const readmeRow = h.rowOf("README.md");
  assertEquals(h.api.isBranch(srcRow), true);
  assertEquals(h.api.isBranch(readmeRow), false);
  assertEquals(h.api.getItemIconProps(srcRow)["data-kind"], "branch-closed");
  assertEquals(h.api.getItemIconProps(readmeRow)["data-kind"], "leaf");
  assertEquals(h.api.getRailProps(srcRow)["hidden"], true);
  h.dispose();
});

Deno.test("tree-view: clicking a branch selects and toggles expansion when expandOnClick is true", () => {
  const h = setup();
  const srcRow = h.rowOf("src");
  const onClick = handler<(e: MouseEvent) => void>(
    h.api.getBranchControlProps(srcRow),
    "onClick",
  );
  onClick(click());

  assertEquals(h.api.expandedValue, ["src"]);
  assertEquals(h.api.selectedValue, ["src"]);
  assertEquals(
    h.api.getVisibleRows().map((r) => r.node.value),
    ["src", "components", "index.ts", "README.md"],
  );
  assertEquals(
    h.api.getItemIconProps(h.rowOf("src"))["data-kind"],
    "branch-open",
  );
  assertEquals(h.api.getRailProps(h.rowOf("components"))["hidden"], false);
  assertEquals(h.expandedChanges, [{ expandedValue: ["src"] }]);
  assertEquals(h.selectionChanges, [{ selectedValue: ["src"] }]);
  h.dispose();
});

Deno.test("tree-view: expandOnClick false selects a clicked branch without expanding it", () => {
  const h = setup({ expandOnClick: false });
  const onClick = handler<(e: MouseEvent) => void>(
    h.api.getBranchControlProps(h.rowOf("src")),
    "onClick",
  );
  onClick(click());

  assertEquals(h.api.selectedValue, ["src"]);
  assertEquals(h.api.expandedValue, []);
  assertEquals(h.api.getVisibleRows().map((r) => r.node.value), [
    "src",
    "README.md",
  ]);
  h.dispose();
});

Deno.test("tree-view: ArrowRight expands a closed branch, then moves into its first child, and ArrowLeft walks back to parent", () => {
  const h = setup();
  const press = (value: string, key: string, mods?: { shift?: boolean }) => {
    const fn = handler<(e: KeyboardEvent) => void>(
      h.api.getBranchControlProps(h.rowOf(value)),
      "onKeydown",
    );
    fn(keydown(key, mods));
  };

  // Expand "src" via ArrowRight
  press("src", "ArrowRight");
  assertEquals(h.api.expandedValue, ["src"]);

  // Second ArrowRight on expanded "src" focuses first child "components"
  press("src", "ArrowRight");
  assertEquals(h.api.focusedValue, "components");

  // ArrowDown moves to "index.ts" (depth 1, after sibling branch "components")
  press("components", "ArrowDown");
  assertEquals(h.api.focusedValue, "index.ts");

  // ArrowLeft from "index.ts" (depth 1) focuses its parent "src" (depth 0),
  // NOT its preceding sibling branch "components" (depth 1)
  press("index.ts", "ArrowLeft");
  assertEquals(h.api.focusedValue, "src");

  // ArrowLeft on expanded "src" collapses it
  press("src", "ArrowLeft");
  assertEquals(h.api.expandedValue, []);
  h.dispose();
});

Deno.test("tree-view: Home, End, and star (*) navigation across visible rows", () => {
  const h = setup({ defaultExpandedValue: ["src"] });
  const press = (value: string, key: string) => {
    const fn = handler<(e: KeyboardEvent) => void>(
      h.api.getBranchControlProps(h.rowOf(value)),
      "onKeydown",
    );
    fn(keydown(key));
  };

  press("src", "End");
  assertEquals(h.api.focusedValue, "README.md");

  press("README.md", "Home");
  assertEquals(h.api.focusedValue, "src");

  // Star expands all visible branches ("src" and "components")
  press("src", "*");
  assertEquals(h.api.expandedValue, ["src", "components"]);
  assertEquals(
    h.api.getVisibleRows().map((r) => r.node.value),
    ["src", "components", "button.ts", "index.ts", "README.md"],
  );
  h.dispose();
});

Deno.test("tree-view: multiple selection supports Ctrl toggle, Shift extend, and checkboxes", () => {
  const h = setup({
    selectionMode: "multiple",
    defaultExpandedValue: ["src"],
  });

  const clickRow = (
    value: string,
    mods?: { shift?: boolean; ctrl?: boolean },
  ) => {
    const fn = handler<(e: MouseEvent) => void>(
      h.api.getBranchControlProps(h.rowOf(value)),
      "onClick",
    );
    fn(click(mods));
  };

  clickRow("index.ts");
  assertEquals(h.api.selectedValue, ["index.ts"]);

  // Ctrl+click adds README.md
  clickRow("README.md", { ctrl: true });
  assertEquals(h.api.selectedValue, ["index.ts", "README.md"]);

  // Shift+ArrowUp from README.md focuses index.ts and keeps multi-selection
  const onKeydown = handler<(e: KeyboardEvent) => void>(
    h.api.getBranchControlProps(h.rowOf("components")),
    "onKeydown",
  );
  onKeydown(keydown("ArrowDown", { shift: true }));
  assertEquals(h.api.focusedValue, "index.ts");

  // Checkbox toggle
  const onCheck = handler<(e: MouseEvent) => void>(
    h.api.getCheckboxProps(h.rowOf("index.ts")),
    "onClick",
  );
  onCheck(click());
  assertEquals(h.api.checkedValue, ["index.ts"]);
  assertEquals(h.checkedChanges, [{ checkedValue: ["index.ts"] }]);
  h.dispose();
});

Deno.test("tree-view: renaming a node submits on Enter and cancels on Escape", () => {
  const h = setup({ rename: true });
  h.api.startRenaming("README.md");
  assertEquals(h.api.state, "renaming");
  assertEquals(h.api.renamingValue, "README.md");
  assertEquals(h.api.focusedValue, "README.md");

  const renameBag = h.api.getRenameInputProps(h.rowOf("README.md"));
  const onRenameKey = handler<(e: KeyboardEvent) => void>(
    renameBag,
    "onKeydown",
  );

  // Escape cancels without changing label
  onRenameKey(keydown("Escape"));
  assertEquals(h.api.state, "idle");
  assertEquals(h.api.renamingValue, null);
  assertEquals(h.rowOf("README.md").node.label, "README.md");

  // Start renaming again and submit via Enter
  h.api.startRenaming("README.md");
  const submitEvent = keydown("Enter") as unknown as Record<string, unknown>;
  submitEvent["target"] = { value: "CONTRIBUTING.md" };
  const onRenameKey2 = handler<(e: KeyboardEvent) => void>(
    h.api.getRenameInputProps(h.rowOf("README.md")),
    "onKeydown",
  );
  onRenameKey2(submitEvent as unknown as KeyboardEvent);

  assertEquals(h.api.state, "idle");
  assertEquals(h.api.renamingValue, null);
  assertEquals(h.rowOf("README.md").node.label, "CONTRIBUTING.md");
  h.dispose();
});

Deno.test("tree-view: lazy branch loading grafts children and emits load-complete", async () => {
  const lazyTree: readonly TreeNodeShape[] = [
    { value: "remote", label: "remote" },
  ];
  const h = setup({
    nodes: lazyTree,
    loadChildren: async (value: string) => {
      await Promise.resolve();
      return [{ value: `${value}/child.ts`, label: "child.ts" }];
    },
  });

  // With loadChildren present, a childless node without `children: []` is a loadable branch
  assertEquals(h.api.isBranch(h.rowOf("remote")), true);

  const onClick = handler<(e: MouseEvent) => void>(
    h.api.getBranchControlProps(h.rowOf("remote")),
    "onClick",
  );
  onClick(click());

  await new Promise((r) => setTimeout(r, 10));
  assertEquals(h.api.loadingStatus["remote"], "loaded");
  assertEquals(
    h.api.getVisibleRows().map((r) => r.node.value),
    ["remote", "remote/child.ts"],
  );
  assertEquals(h.loadCompletes, [{ value: "remote" }]);
  h.dispose();
});
