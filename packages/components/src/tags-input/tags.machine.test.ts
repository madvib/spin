import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { tags } from "./tags.presentation.ts";
const createTagsBridge = tags.createBridge;
import type { TagsApi, TagsRow } from "./tags.presentation.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;
globalThis.HTMLInputElement = win.HTMLInputElement;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** Read a callback out of a bag's `use:name` entry, which is data. */
function actionCallback<H>(
  bag: Record<string, unknown>,
  action: string,
  name: string,
): H {
  const params: unknown = bag[action];
  if (typeof params !== "object" || params === null) {
    throw new Error(`no action param at ${action}`);
  }
  return handler<H>(params as Record<string, unknown>, name);
}

/**
 * linkedom ships no InputEvent/KeyboardEvent/FocusEvent constructors, so the
 * events the handlers read are synthesized here — one place, with the minimal
 * field set each handler reads.
 */
const typing = (
  target: HTMLInputElement,
  inputType = "insertText",
): InputEvent =>
  ({ currentTarget: target, inputType }) as unknown as InputEvent;
const keydown = (key: string): KeyboardEvent =>
  ({
    key,
    defaultPrevented: false,
    preventDefault: () => {},
  }) as unknown as KeyboardEvent;
const focusOut = (relatedTarget: unknown): FocusEvent =>
  ({ relatedTarget }) as unknown as FocusEvent;
const pointerDown = (button: number): PointerEvent =>
  ({ button, preventDefault: () => {} }) as unknown as PointerEvent;
const click = (): MouseEvent =>
  ({ defaultPrevented: false }) as unknown as MouseEvent;

/** One macrotask: the inline edit's blur reports on a later task, exactly as
 * in the browser, where a press that moved the highlight has already been
 * seen by the time the blur lands. */
const settle = (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
};

interface Harness {
  readonly api: TagsApi;
  readonly root: HTMLDivElement;
  readonly input: HTMLInputElement;
  readonly changes: {
    value: string[][];
    inputValue: string[];
    highlight: (number | null)[];
    invalid: string[];
  };
  row(value: string, occurrence?: number): TagsRow;
  state(): string;
  caret(atStart: boolean): void;
  /** Press a tag's preview: the pointer path into navigating:tag, which is
   * also how a host highlights a specific tag. */
  pressTag(value: string, occurrence?: number): void;
  bag(): Record<string, unknown>;
  write(name: string, value: unknown): void;
  announce(): string;
  dispose(): void;
}

/**
 * Mounts the bridge the way the element does: props as signals (so a host
 * write re-runs the controlled-channel effect), a root element, and the two
 * nodes the connect reaches for by id — the entry input and the live region.
 * The machine id differs per mount, as the element's `uniqueId` gives it, so
 * a node left behind by an earlier test can never be found by id.
 */
let mounts = 0;

function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const input = document.createElement("input");
  const region = document.createElement("div");
  root.appendChild(input);
  root.appendChild(region);

  const changes = {
    value: [] as string[][],
    inputValue: [] as string[],
    highlight: [] as (number | null)[],
    invalid: [] as string[],
  };
  const values: Record<string, WriteSignal> = {};
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  const authored = new Set<string>();
  for (const name of ["value", "inputValue"]) {
    if (name in overrides) authored.add(name);
  }
  write(
    "onValueChange",
    (change: { value: readonly string[] }) =>
      changes.value.push([...change.value]),
  );
  write(
    "onInputValueChange",
    (change: { inputValue: string }) =>
      changes.inputValue.push(change.inputValue),
  );
  write(
    "onHighlightChange",
    (change: { highlightedValue: number | null }) =>
      changes.highlight.push(change.highlightedValue),
  );
  write(
    "onValueInvalid",
    (change: { reason: string }) => changes.invalid.push(change.reason),
  );

  const bridge = createTagsBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) {
        record[name] = source();
      }
      record["@@authored"] = (name: string) => authored.has(name);
      return record;
    },
    () => root,
    `tags-${++mounts}`,
  );

  const api = bridge.api;
  // The connect resolves parts by id, so the nodes it needs carry the ids the
  // bags hand out — the element's markup provides them for real.
  input.id = String(api.getInputProps()["id"]);
  region.id = String(api.getLiveRegionProps()["id"]);
  const caret = (atStart: boolean): void => {
    const at = atStart ? 0 : 3;
    Object.defineProperty(input, "selectionStart", {
      value: at,
      configurable: true,
    });
    Object.defineProperty(input, "selectionEnd", {
      value: at,
      configurable: true,
    });
  };
  caret(false);

  return {
    api,
    root,
    input,
    changes,
    row: (value: string, occurrence = 0): TagsRow => {
      const found = api.getTags().find((entry) =>
        entry.value === value && entry.occurrence === occurrence
      );
      if (found === undefined) throw new Error(`no row ${value}#${occurrence}`);
      return found;
    },
    state: () => String(api.getControlProps()["data-state"] ?? "idle"),
    caret,
    pressTag: (value: string, occurrence = 0): void => {
      const row = api.getTags().find((entry) =>
        entry.value === value && entry.occurrence === occurrence
      );
      if (row === undefined) throw new Error(`no row ${value}#${occurrence}`);
      handler<(event: PointerEvent) => void>(
        api.getItemPreviewProps(row),
        "onPointerDown",
      )(pointerDown(0));
    },
    bag: () => api.getInputProps(),
    write,
    announce: (): string => {
      const node = document.getElementById(
        String(api.getLiveRegionProps()["id"]),
      );
      return node === null ? "" : (node.textContent ?? "");
    },
    dispose: () => {
      bridge.dispose();
      root.remove();
    },
  };
}

/** The machine's state, read through a bag the markup paints. */
const dataFocus = (h: Harness): boolean =>
  h.api.getControlProps()["data-focus"] === "";
const editingRow = (h: Harness): number | null => h.api.editedIndex;

test("Given a fresh tags input / When nothing is authored / Then idle and empty are the reachable start", () => {
  const h = mount();
  deepStrictEqual(h.api.value, [], "no tags at the start");
  deepStrictEqual(h.api.count, 0, "the count is zero");
  deepStrictEqual(h.api.empty, true, "the api reports empty");
  deepStrictEqual(
    h.api.getRootProps()["data-empty"],
    "",
    "the root reports empty",
  );
  deepStrictEqual(h.api.atMax, false, "an unlimited input is never at max");
  h.dispose();
});

test("Given defaultValue / When the input mounts / Then the value seeds and no change event fires", () => {
  const h = mount({ defaultValue: ["react", "solid"] });
  deepStrictEqual(h.api.value, ["react", "solid"], "the seed lands");
  deepStrictEqual(h.api.count, 2, "the count follows the seed");
  deepStrictEqual(
    h.api.valueAsString,
    "react, solid",
    "the joined string is comma-spaced",
  );
  deepStrictEqual(
    h.api.getRootProps()["data-empty"],
    undefined,
    "the root reports not empty",
  );
  deepStrictEqual(h.changes.value, [], "seeding is not a change");
  h.dispose();
});

test("Given defaultInputValue / When the input mounts / Then the entry field carries the seed", () => {
  const h = mount({ defaultInputValue: "typed" });
  deepStrictEqual(h.api.inputValue, "typed", "the input value seeds");
  deepStrictEqual(h.bag()["value"], "typed", "the input bag carries the seed");
  deepStrictEqual(h.changes.inputValue, [], "seeding is not a change");
  h.dispose();
});

test("Given autoFocus / When the input mounts / Then focused:input is the reachable start state", () => {
  const h = mount({ autoFocus: true, defaultValue: ["a"] });
  deepStrictEqual(dataFocus(h), true, "the focused tag is set at start");
  deepStrictEqual(
    h.api.getRootProps()["data-focus"],
    "",
    "the root reports focus",
  );
  h.dispose();
});

test("Given idle / When the entry field receives focus / Then the machine takes focused:input", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  deepStrictEqual(dataFocus(h), true, "focus moves the machine on");
  h.dispose();
});

test("Given idle / When the root takes a pointer press / Then the machine takes focused:input", () => {
  const h = mount();
  handler<() => void>(h.api.getRootProps(), "onPointerDown")();
  deepStrictEqual(dataFocus(h), true, "a press on the control focuses the field");
  h.dispose();
});

test("Given idle with a highlighted tag / When the root takes a pointer press / Then the machine stays idle", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  h.api.addValue("c");
  // Pointer down on a tag highlights it and navigates, so a later root press
  // must not strip that highlight by re-entering focused:input.
  handler<() => void>(h.api.getRootProps(), "onPointerDown")();
  deepStrictEqual(dataFocus(h), true, "the press focuses the field anyway");
  h.dispose();
});

test("Given focused:input / When text is typed / Then the input value follows and reports", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "re";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  deepStrictEqual(h.api.inputValue, "re", "the machine holds the typed text");
  deepStrictEqual(
    h.changes.inputValue,
    ["re"],
    "input-value-change reports the write",
  );
  deepStrictEqual(h.bag()["value"], "re", "the input bag carries the text back");
  h.dispose();
});

test("Given typed text / When Enter arrives / Then the sanitized value is added and the field clears", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "  Elm  ";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.value, ["Elm"], "trimmed text becomes the tag");
  deepStrictEqual(h.api.inputValue, "", "the field clears after the add");
  deepStrictEqual(h.changes.value, [["Elm"]], "value-change reports the add");
  h.dispose();
});

test("Given an empty field / When Enter arrives / Then nothing is added", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.value, [], "the empty insert is refused");
  deepStrictEqual(h.changes.value, [], "no change event for a refused insert");
  h.dispose();
});

test("Given the field at max / When Enter arrives / Then the text survives and the count holds", () => {
  const h = mount({ max: 1 });
  h.api.setValue(["one"]);
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "two";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.value, ["one"], "the insert is refused at the cap");
  deepStrictEqual(h.api.inputValue, "two", "the typed text survives the refusal");
  deepStrictEqual(h.api.atMax, true, "the api reports at max");
  h.dispose();
});

test("Given the field at max with allowOverflow / When Enter arrives / Then the tag is added and the root goes invalid", () => {
  const h = mount({ max: 1, allowOverflow: true });
  h.api.setValue(["one"]);
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "two";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.value, ["one", "two"], "overflow lets the tag through");
  deepStrictEqual(
    h.api.getRootProps()["data-invalid"],
    "",
    "the root reports invalid",
  );
  deepStrictEqual(
    h.api.getInputProps()["aria-invalid"],
    true,
    "the field reports invalid",
  );
  h.dispose();
});

test("Given a list past the cap / When every part is read / Then all four carry invalid", () => {
  const h = mount({ max: 2, allowOverflow: true, defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "c";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.value, ["a", "b", "c"], "overflow lets the chip through");
  // `invalid = prop("invalid") || computed("isOverflowing")`: one derived
  // boolean flowing to root, control, label and input alike.
  for (
    const read of [
      () => h.api.getRootProps(),
      () => h.api.getControlProps(),
      () => h.api.getLabelProps(),
      () => h.api.getInputProps(),
    ]
  ) {
    deepStrictEqual(read()["data-invalid"], "", "each part carries the flag");
  }
  deepStrictEqual(
    h.api.getInputProps()["aria-invalid"],
    true,
    "the field announces it",
  );
  h.dispose();
});

test("Given a host-authored invalid prop / When every part is read / Then all four carry invalid", () => {
  const h = mount({ invalid: true, defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  deepStrictEqual(
    h.api.getRootProps()["data-invalid"],
    "",
    "the root reports invalid",
  );
  deepStrictEqual(
    h.api.getControlProps()["data-invalid"],
    "",
    "the control reports invalid",
  );
  deepStrictEqual(
    h.api.getLabelProps()["data-invalid"],
    "",
    "the label reports invalid",
  );
  deepStrictEqual(
    h.api.getInputProps()["data-invalid"],
    "",
    "the field reports invalid",
  );
  deepStrictEqual(
    h.api.getInputProps()["aria-invalid"],
    true,
    "the field announces it",
  );
  h.dispose();
});

test("Given a list at the cap without overflow / When the parts are read / Then none reports invalid", () => {
  const h = mount({ max: 2, defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  deepStrictEqual(
    h.api.getRootProps()["data-invalid"],
    undefined,
    "the cap alone is not invalid",
  );
  deepStrictEqual(
    h.api.getControlProps()["data-invalid"],
    undefined,
    "neither is the control",
  );
  deepStrictEqual(
    h.api.getLabelProps()["data-invalid"],
    undefined,
    "nor the label",
  );
  deepStrictEqual(
    h.api.getInputProps()["data-invalid"],
    undefined,
    "nor the field",
  );
  deepStrictEqual(
    h.api.getInputProps()["aria-invalid"],
    false,
    "the field announces false",
  );
  h.dispose();
});

test("Given a host-authored invalid that clears / When the parts are read / Then invalid leaves every part", () => {
  const h = mount({ invalid: true, defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  deepStrictEqual(
    h.api.getRootProps()["data-invalid"],
    "",
    "the root reports invalid while set",
  );
  h.write("invalid", false);
  deepStrictEqual(
    h.api.getRootProps()["data-invalid"],
    undefined,
    "and drops it when the host clears it",
  );
  deepStrictEqual(
    h.api.getInputProps()["aria-invalid"],
    false,
    "the field follows",
  );
  h.dispose();
});

test("Given typed text ending in the delimiter / When the input fires / Then the tag is added without the delimiter", () => {
  const h = mount({ delimiter: ";" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "one";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  h.input.value = "one;";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  deepStrictEqual(h.api.value, ["one"], "the delimiter key inserts");
  deepStrictEqual(h.api.inputValue, "", "the field clears");
  h.dispose();
});

test("Given a caret at the start with tags / When ArrowLeft arrives / Then the machine takes navigating:tag on the last tag", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(h.api.highlightedIndex, 1, "the last tag is highlighted");
  deepStrictEqual(h.changes.highlight, [1], "highlight-change reports the move");
  deepStrictEqual(
    h.api.getItemPreviewProps(h.row("b"))["data-highlighted"],
    "",
    "the preview is highlighted",
  );
  deepStrictEqual(
    h.api.getItemPreviewProps(h.row("a"))["data-highlighted"],
    undefined,
    "the other preview is not",
  );
  h.dispose();
});

test("Given a caret mid-text / When ArrowLeft arrives / Then the machine stays in focused:input", () => {
  const h = mount({ defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(false);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "the caret position blocks the walk",
  );
  h.dispose();
});

test("Given no tags / When ArrowLeft arrives / Then the machine stays in focused:input", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(h.api.highlightedIndex, null, "no tags means no walk");
  h.dispose();
});

test("Given a caret at the start with tags / When Backspace arrives / Then the machine navigates to the last tag", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    1,
    "backspace enters navigation without deleting",
  );
  h.dispose();
});

test("Given a highlighted middle tag / When Delete arrives in focused:input / Then it removes and highlights the slid-in tag", () => {
  const h = mount({ defaultValue: ["a", "b", "c"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("b");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Delete"),
  );
  deepStrictEqual(h.api.value, ["a", "c"], "the highlighted tag is removed");
  deepStrictEqual(
    h.api.highlightedIndex,
    1,
    "the focus lands on the tag that slid in",
  );
  h.dispose();
});

test("Given the last tag highlighted / When Delete arrives / Then the highlight clears rather than pointing at a ghost", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("b");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Delete"),
  );
  deepStrictEqual(h.api.value, ["a"], "the last tag is removed");
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "no tag slid into its slot, so nothing is highlighted",
  );
  h.dispose();
});

test("Given typed text / When a paste arrives without addOnPaste / Then only the input value moves", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "a,b";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(
    typing(h.input, "insertFromPaste"),
  );
  deepStrictEqual(h.api.value, [], "no tags are added");
  deepStrictEqual(h.api.inputValue, "a,b", "the pasted text lands in the field");
  h.dispose();
});

test("Given a paste with addOnPaste / When the input fires / Then the delimiter splits it into tags", () => {
  const h = mount({ addOnPaste: true, defaultValue: ["keep"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = " a , b ,a";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(
    typing(h.input, "insertFromPaste"),
  );
  deepStrictEqual(
    h.api.value,
    ["keep", "a", "b"],
    "each sanitized part becomes a tag, duplicates dropped",
  );
  deepStrictEqual(h.api.inputValue, "", "the field clears after the paste");
  h.dispose();
});

test("Given blurBehavior add / When the field blurs / Then the text becomes a tag and the machine idles", () => {
  const h = mount({ blurBehavior: "add" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "leftover";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<() => void>(h.api.getRootProps(), "onPointerDown")();
  h.api.setValue([]);
  handler<() => void>(h.api.getRootProps(), "onPointerDown")();
  h.input.value = "leftover";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  actionCallback<(event: PointerEvent) => void>(
    h.bag(),
    "use:dismissable",
    "onOutside",
  )(pointerDown(0));
  deepStrictEqual(h.api.value, ["leftover"], "the blur-added tag lands");
  deepStrictEqual(dataFocus(h), false, "the machine idles after the blur");
  h.dispose();
});

test("Given blurBehavior clear / When the field blurs / Then the text is discarded and the machine idles", () => {
  const h = mount({ blurBehavior: "clear" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "leftover";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  actionCallback<(event: PointerEvent) => void>(
    h.bag(),
    "use:dismissable",
    "onOutside",
  )(pointerDown(0));
  deepStrictEqual(h.api.value, [], "nothing is added");
  deepStrictEqual(h.api.inputValue, "", "the text is discarded");
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

test("Given no blurBehavior / When the field blurs / Then the machine idles and the text stays", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "leftover";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  actionCallback<(event: PointerEvent) => void>(
    h.bag(),
    "use:dismissable",
    "onOutside",
  )(pointerDown(0));
  deepStrictEqual(h.api.value, [], "nothing is added");
  deepStrictEqual(h.api.inputValue, "leftover", "the text stays");
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

test("Given blurBehavior add / When focus leaves the field for the body / Then the text becomes a tag", () => {
  const h = mount({ blurBehavior: "add" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "onblur";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  // The label-click case: a press on a non-focusable part of the page
  // moves focus to the body, so the focusout carries no relatedTarget.
  handler<(event: FocusEvent) => void>(h.bag(), "onFocusOut")(focusOut(null));
  deepStrictEqual(h.api.value, ["onblur"], "the blur-added tag lands");
  deepStrictEqual(h.api.inputValue, "", "the field clears");
  deepStrictEqual(dataFocus(h), false, "the machine idles after the blur");
  h.dispose();
});

test("Given blurBehavior clear / When focus leaves the field for the body / Then the text is discarded", () => {
  const h = mount({ blurBehavior: "clear" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "onblur";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: FocusEvent) => void>(h.bag(), "onFocusOut")(focusOut(null));
  deepStrictEqual(h.api.value, [], "nothing is added");
  deepStrictEqual(h.api.inputValue, "", "the text is discarded");
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

test("Given no blurBehavior / When focus leaves the field for the body / Then the text stays", () => {
  const h = mount();
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "onblur";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: FocusEvent) => void>(h.bag(), "onFocusOut")(focusOut(null));
  deepStrictEqual(h.api.value, [], "nothing is added");
  deepStrictEqual(h.api.inputValue, "onblur", "the text stays");
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

test("Given a field with text / When the window drops focus / Then nothing reports and the text stays", () => {
  const h = mount({ blurBehavior: "add" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "onblur";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  // A window blur leaves the focused element alone — there is no new
  // element to read as outside the component, so nothing reports.
  const original = Object.getOwnPropertyDescriptor(document, "hasFocus");
  Object.defineProperty(document, "hasFocus", {
    value: () => false,
    configurable: true,
  });
  handler<(event: FocusEvent) => void>(h.bag(), "onFocusOut")(focusOut(null));
  if (original === undefined) {
    delete (document as { hasFocus?: unknown }).hasFocus;
  } else Object.defineProperty(document, "hasFocus", original);
  deepStrictEqual(h.api.value, [], "nothing is added");
  deepStrictEqual(h.api.inputValue, "onblur", "the text stays");
  deepStrictEqual(dataFocus(h), true, "the machine keeps the field");
  h.dispose();
});

test("Given navigating:tag / When ArrowRight arrives / Then the highlight advances and the last step returns to the field", () => {
  const h = mount({ defaultValue: ["a", "b", "c"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  deepStrictEqual(h.api.highlightedIndex, 0, "the pressed tag is highlighted");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(h.api.highlightedIndex, 1, "the first press advances one tag");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    2,
    "the second press advances to the last",
  );
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(dataFocus(h), true, "past the last tag the field takes over");
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "the field's entry clears the highlight",
  );
  h.dispose();
});

test("Given navigating:tag on the first tag / When ArrowLeft arrives / Then the highlight clears", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  deepStrictEqual(h.api.highlightedIndex, 0, "the first tag is highlighted");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "there is no tag before the first",
  );
  h.dispose();
});

test("Given navigating:tag with a caret mid-text / When ArrowLeft arrives / Then the field takes over", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  deepStrictEqual(h.api.highlightedIndex, 0, "the first tag is highlighted");
  h.caret(false);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(dataFocus(h), true, "the walk hands back to the caret");
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "entering the field clears the highlight",
  );
  h.dispose();
});

test("Given navigating:tag / When ArrowDown or Escape arrives / Then the field takes over", () => {
  const h = mount({ defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(h.api.highlightedIndex, 0, "navigating");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowDown"),
  );
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "arrow down returns to the field",
  );
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Escape"),
  );
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "escape returns to the field too",
  );
  h.dispose();
});

test("Given navigating:tag / When a character is typed / Then the field takes over with the text", () => {
  const h = mount({ defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  h.input.value = "x";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  deepStrictEqual(h.api.inputValue, "x", "the typed text lands");
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "the field takes over",
  );
  h.dispose();
});

test("Given navigating:tag on the first tag / When Backspace arrives / Then it deletes and highlights the new first", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  deepStrictEqual(h.api.highlightedIndex, 0, "on the first tag");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(h.api.value, ["b"], "the first tag is deleted");
  deepStrictEqual(
    h.api.highlightedIndex,
    0,
    "the next tag slides into the first slot and is highlighted",
  );
  h.dispose();
});

test("Given navigating:tag mid-list / When Backspace arrives / Then it deletes and highlights the previous tag", () => {
  const h = mount({ defaultValue: ["a", "b", "c"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowRight"),
  );
  deepStrictEqual(h.api.highlightedIndex, 1, "on the middle tag");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(h.api.value, ["a", "c"], "the middle tag is deleted");
  deepStrictEqual(h.api.highlightedIndex, 0, "the previous tag is highlighted");
  h.dispose();
});

test("Given navigating:tag with no highlight / When Backspace arrives / Then the last tag is highlighted", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    null,
    "the highlight cleared at the first tag",
  );
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(
    h.api.highlightedIndex,
    1,
    "backspace from nothing highlights the last tag",
  );
  h.dispose();
});

test("Given navigating:tag with a caret mid-text / When Backspace arrives / Then the field takes over", () => {
  const h = mount({ defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  h.caret(false);
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(h.api.value, ["a"], "nothing is deleted");
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "the field takes over",
  );
  h.dispose();
});

test("Given navigating:tag / When Delete arrives / Then it deletes and returns to the field", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("b");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Delete"),
  );
  deepStrictEqual(h.api.value, ["a"], "the highlighted tag is deleted");
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "the field takes over",
  );
  h.dispose();
});

test("Given navigating:tag / When Enter arrives / Then the highlighted tag opens for editing", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("b");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.editing, true, "the machine takes editing:tag");
  deepStrictEqual(editingRow(h), 1, "the last tag is the one being edited");
  deepStrictEqual(
    h.api.getItemInputProps(h.row("b"))["hidden"],
    false,
    "the inline input shows",
  );
  deepStrictEqual(
    h.api.getItemInputProps(h.row("a"))["hidden"],
    true,
    "the other inline input stays hidden",
  );
  deepStrictEqual(
    h.api.getItemPreviewProps(h.row("b"))["hidden"],
    true,
    "the preview hides while editing",
  );
  h.dispose();
});

test("Given editable false / When Enter arrives on a highlighted tag / Then the machine stays navigating", () => {
  const h = mount({ defaultValue: ["a"], editable: false });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Enter"),
  );
  deepStrictEqual(h.api.editing, false, "editing is refused");
  deepStrictEqual(h.api.highlightedIndex, 0, "the highlight stays");
  h.dispose();
});

test("Given navigating:tag / When the field blurs / Then the machine idles and the highlight clears", () => {
  const h = mount({ defaultValue: ["a"] });
  handler<() => void>(h.bag(), "onFocus")();
  h.caret(true);
  h.pressTag("a");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("ArrowLeft"),
  );
  actionCallback<(event: PointerEvent) => void>(
    h.bag(),
    "use:dismissable",
    "onOutside",
  )(pointerDown(0));
  deepStrictEqual(h.api.highlightedIndex, null, "the highlight clears");
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

// ---- editing:tag ----------------------------------------------------------

/** Enter editing on a tag: the double-click path, which is what a pointer
 * user takes. */
function edit(h: Harness, value: string, occurrence = 0): void {
  const row = h.row(value, occurrence);
  handler<() => void>(h.api.getItemPreviewProps(row), "onDblclick")();
}

test("Given editing:tag / When the inline field types / Then the edited value follows", () => {
  const h = mount({ defaultValue: ["a"] });
  edit(h, "a");
  deepStrictEqual(h.api.editedIndex, 0, "the tag is open for editing");
  deepStrictEqual(
    h.api.getItemInputProps(h.row("a"))["value"],
    "a",
    "the inline field carries the tag",
  );
  h.input.value = "b";
  handler<(event: InputEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onInput",
  )(typing(h.input));
  deepStrictEqual(
    h.api.getItemInputProps(h.row("a"))["value"],
    "b",
    "the inline field follows the typing",
  );
  h.dispose();
});

test("Given editing:tag / When Escape arrives / Then the edit is abandoned and the tag keeps its value", () => {
  const h = mount({ defaultValue: ["a"] });
  edit(h, "a");
  h.input.value = "scratch";
  handler<(event: InputEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onInput",
  )(typing(h.input));
  handler<(event: KeyboardEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onKeydown",
  )(keydown("Escape"));
  deepStrictEqual(h.api.value, ["a"], "the original value survives");
  deepStrictEqual(h.api.editing, false, "the machine leaves editing:tag");
  deepStrictEqual(h.api.highlightedIndex, 0, "the tag stays highlighted");
  h.dispose();
});

test("Given editing:tag / When the inline field blurs toward the entry field / Then the machine navigates", async () => {
  const h = mount({ defaultValue: ["a"] });
  edit(h, "a");
  const blur = handler<(event: FocusEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onBlur",
  );
  blur(focusOut(h.input));
  await settle();
  deepStrictEqual(h.api.editing, false, "the machine leaves editing:tag");
  deepStrictEqual(h.api.highlightedIndex, null, "the highlight clears");
  deepStrictEqual(dataFocus(h), true, "the machine stays in the focused tier");
  h.dispose();
});

test("Given editing:tag / When the inline field blurs elsewhere / Then the machine idles and the blur behavior runs", async () => {
  const h = mount({ defaultValue: ["a"], blurBehavior: "add" });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "pending";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  edit(h, "a");
  h.input.value = "pending";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(typing(h.input));
  handler<(event: FocusEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onBlur",
  )(focusOut(null));
  await settle();
  deepStrictEqual(
    h.api.value,
    ["a", "pending"],
    "the blur behavior added the entry text",
  );
  deepStrictEqual(dataFocus(h), false, "the machine idles");
  h.dispose();
});

test("Given editing:tag with an empty inline field / When Enter arrives / Then the tag is removed", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  h.pressTag("a");
  edit(h, "a");
  h.input.value = "  ";
  handler<(event: InputEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onInput",
  )(typing(h.input));
  handler<(event: KeyboardEvent) => void>(
    h.api.getItemInputProps(h.row("a")),
    "onKeydown",
  )(keydown("Enter"));
  deepStrictEqual(h.api.value, ["b"], "an emptied tag is deleted");
  deepStrictEqual(h.api.editing, false, "the machine leaves editing:tag");
  h.dispose();
});

test("Given editing:tag / When Enter arrives with a new value / Then the tag is rewritten in place", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  edit(h, "b");
  h.input.value = "beta";
  handler<(event: InputEvent) => void>(
    h.api.getItemInputProps(h.row("b")),
    "onInput",
  )(typing(h.input));
  handler<(event: KeyboardEvent) => void>(
    h.api.getItemInputProps(h.row("b")),
    "onKeydown",
  )(keydown("Enter"));
  deepStrictEqual(
    h.api.value,
    ["a", "beta"],
    "the value is rewritten at its index",
  );
  deepStrictEqual(h.api.highlightedIndex, 1, "the tag stays highlighted");
  h.dispose();
});

test("Given editing:tag with a duplicate value / When Enter arrives / Then the rewrite is refused", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  edit(h, "b");
  h.input.value = "a";
  handler<(event: InputEvent) => void>(
    h.api.getItemInputProps(h.row("b")),
    "onInput",
  )(typing(h.input));
  handler<(event: KeyboardEvent) => void>(
    h.api.getItemInputProps(h.row("b")),
    "onKeydown",
  )(keydown("Enter"));
  deepStrictEqual(h.api.value, ["a", "b"], "the duplicate rewrite is refused");
  h.dispose();
});

test("Given editable false / When a tag is double-clicked / Then it does not open for editing", () => {
  const h = mount({ defaultValue: ["a"], editable: false });
  handler<() => void>(h.api.getItemPreviewProps(h.row("a")), "onDblclick")();
  deepStrictEqual(h.api.editing, false, "editing is refused");
  h.dispose();
});

// ---- root-level commands and tag gestures ---------------------------------

test("Given idle / When a tag preview is pressed / Then the machine navigates to that tag", () => {
  const h = mount({ defaultValue: ["a", "b", "c"] });
  h.pressTag("b");
  deepStrictEqual(h.api.highlightedIndex, 1, "the pressed tag is highlighted");
  deepStrictEqual(dataFocus(h), true, "the machine is in the focused tier");
  deepStrictEqual(
    h.api.getControlProps()["data-focus"],
    "",
    "the control reports focus",
  );
  h.dispose();
});

test("Given a tag / When its delete trigger is clicked / Then the tag is removed and the field takes focus", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<(event: MouseEvent) => void>(
    h.api.getItemDeleteTriggerProps(h.row("a")),
    "onClick",
  )(click());
  deepStrictEqual(h.api.value, ["b"], "the tag is removed");
  deepStrictEqual(dataFocus(h), true, "the field takes focus");
  h.dispose();
});

test("Given an inert input / When the delete trigger is pressed / Then the press is swallowed and the click does nothing", () => {
  const h = mount({ defaultValue: ["a"], disabled: true });
  let prevented = false;
  handler<(event: PointerEvent) => void>(
    h.api.getItemDeleteTriggerProps(h.row("a")),
    "onPointerDown",
  )({
    button: 0,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as PointerEvent);
  deepStrictEqual(prevented, true, "the press is swallowed while inert");
  handler<(event: MouseEvent) => void>(
    h.api.getItemDeleteTriggerProps(h.row("a")),
    "onClick",
  )(click());
  deepStrictEqual(h.api.value, ["a"], "the tag survives");
  h.dispose();
});

test("Given the clear trigger / When it is clicked / Then every tag is cleared and the announcement fires", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  handler<() => void>(h.api.getClearTriggerProps(), "onClick")();
  deepStrictEqual(h.api.value, [], "the tags clear");
  deepStrictEqual(
    h.api.getClearTriggerProps()["hidden"],
    true,
    "the trigger hides on the empty state",
  );
  deepStrictEqual(h.announce(), "No tags selected", "the clear is announced");
  h.dispose();
});

test("Given the hidden input / When a form reset is reported / Then the seeded value returns", () => {
  const h = mount({ defaultValue: ["a"] });
  h.api.addValue("b");
  deepStrictEqual(h.api.value, ["a", "b"], "the tag was added");
  actionCallback<() => void>(
    h.api.getHiddenInputProps(),
    "use:form-control",
    "onFormReset",
  )();
  deepStrictEqual(h.api.value, ["a"], "the reset restores the seed");
  h.dispose();
});

test("Given a value / When setValue runs / Then the whole list is replaced and reports", () => {
  const h = mount({ defaultValue: ["a"] });
  h.api.setValue(["x", "y"]);
  deepStrictEqual(h.api.value, ["x", "y"], "the list is replaced");
  deepStrictEqual(h.changes.value, [["x", "y"]], "value-change reports the write");
  h.dispose();
});

test("Given setValueAtIndex / When the index is out of range or the value empty / Then the list is untouched", () => {
  const h = mount({ defaultValue: ["a"] });
  h.api.setValueAtIndex(5, "x");
  deepStrictEqual(h.api.value, ["a"], "an out-of-range index is refused");
  h.api.setValueAtIndex(0, "");
  deepStrictEqual(h.api.value, ["a"], "an empty value is refused");
  h.api.setValueAtIndex(0, "a");
  deepStrictEqual(h.api.value, ["a"], "an unchanged value is a no-op");
  h.api.setValueAtIndex(0, "z");
  deepStrictEqual(h.api.value, ["z"], "a real rewrite lands");
  h.dispose();
});

test("Given addValue with a duplicate / When it runs / Then the list is unchanged", () => {
  const h = mount({ defaultValue: ["a"] });
  h.api.addValue("a");
  deepStrictEqual(h.api.value, ["a"], "duplicates are dropped by default");
  h.dispose();
});

test("Given allowDuplicates / When addValue runs with a duplicate / Then both instances are kept", () => {
  const h = mount({ defaultValue: ["a"], allowDuplicates: true });
  h.api.addValue("a");
  deepStrictEqual(h.api.value, ["a", "a"], "both instances survive");
  deepStrictEqual(h.api.getTags().length, 2, "two rows exist");
  deepStrictEqual(
    h.api.indexOfRow(h.row("a", 1)),
    1,
    "the second instance is its own row",
  );
  deepStrictEqual(
    h.api.getItemPreviewProps(h.row("a", 1))["id"],
    "tags-input:" + id2(h) + ":tag:a:1",
    "ids stay unique",
  );
  h.dispose();
});

/** The machine id the mount was handed, read back off a part id. */
function id2(h: Harness): string {
  const id = String(h.api.getRootProps()["id"]);
  return id.slice("tags-input:".length);
}

test("Given clearValue with an id / When it runs / Then only that tag is removed", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  h.api.clearValue(String(h.api.getItemPreviewProps(h.row("b"))["id"]));
  deepStrictEqual(h.api.value, ["a"], "the named tag is removed");
  h.api.clearValue(String(h.api.getItemDeleteTriggerProps(h.row("a"))["id"]));
  deepStrictEqual(h.api.value, [], "the delete trigger's id resolves too");
  h.api.clearValue("tags-input:missing");
  deepStrictEqual(h.api.value, [], "an unknown id is a no-op");
  h.dispose();
});

test("Given the commands / When they run / Then the entry field and focus follow", () => {
  const h = mount();
  h.api.setInputValue("draft");
  deepStrictEqual(h.api.inputValue, "draft", "setInputValue writes");
  h.api.clearInputValue();
  deepStrictEqual(h.api.inputValue, "", "clearInputValue clears");
  let focused = 0;
  h.input.addEventListener("focus", () => {
    focused++;
  });
  h.api.focus();
  deepStrictEqual(focused, 1, "focus lands on the entry field");
  h.dispose();
});

// ---- controlled channels --------------------------------------------------

test("Given an authored value / When the host writes it / Then the machine follows without an event", () => {
  const h = mount({ value: ["a"] });
  deepStrictEqual(h.api.value, ["a"], "the host's list is the machine's list");
  h.api.addValue("b");
  deepStrictEqual(
    h.changes.value,
    [["a", "b"]],
    "the machine's move composes on the host's list and reports",
  );
  deepStrictEqual(h.api.value, ["a", "b"], "the move lands");
  h.write("value", ["z"]);
  deepStrictEqual(h.api.value, ["z"], "a later host write re-imposes the list");
  deepStrictEqual(
    h.changes.value,
    [["a", "b"]],
    "a host write is not a change event",
  );
  h.dispose();
});

test("Given an un-authored value / When the host writes it / Then the machine ignores it", () => {
  const h = mount();
  h.api.addValue("a");
  h.write("value", ["z"]);
  deepStrictEqual(
    h.api.value,
    ["a"],
    "a default-shaped write is not a host write",
  );
  h.dispose();
});

test("Given an authored inputValue / When the host writes it / Then the entry field follows", () => {
  const h = mount({ inputValue: "a" });
  deepStrictEqual(h.api.inputValue, "a", "the authored value seeds the field");
  h.write("inputValue", "ab");
  deepStrictEqual(h.api.inputValue, "ab", "a host write moves the field");
  h.dispose();
});

// ---- the live region and host behavior functions --------------------------

test("Given a mutation / When it lands / Then the live region announces it", () => {
  const h = mount();
  h.api.addValue("react");
  deepStrictEqual(h.announce(), "Added tag react", "an add is announced");
  h.api.clearValue(0);
  deepStrictEqual(h.announce(), "Tag react deleted", "a delete is announced");
  h.api.setValue(["react"]);
  h.api.setValueAtIndex(0, "solid");
  deepStrictEqual(h.announce(), "Tag update to solid", "an update is announced");
  h.api.clearValue();
  deepStrictEqual(h.announce(), "No tags selected", "a clear is announced");
  h.dispose();
});

test("Given a delete then a highlight / When the highlight lands / Then both sentences announce", () => {
  const h = mount({ defaultValue: ["a", "b"] });
  h.caret(true);
  h.pressTag("a");
  handler<(event: KeyboardEvent) => void>(h.bag(), "onKeydown")(
    keydown("Backspace"),
  );
  deepStrictEqual(
    h.announce(),
    "Tag a deleted. Tag b selected. Press enter to edit, delete or backspace to remove.",
    "the delete and the selection announce together",
  );
  h.dispose();
});

test("Given a paste / When it lands / Then the region announces the count", () => {
  const h = mount({ addOnPaste: true });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "a,b,c";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(
    typing(h.input, "insertFromPaste"),
  );
  deepStrictEqual(h.announce(), "Pasted 3 tags", "the paste count is announced");
  h.dispose();
});

test("Given a repeated identical mutation / When it lands / Then the region node is replaced so it announces again", () => {
  const h = mount({ addOnPaste: true });
  handler<() => void>(h.bag(), "onFocus")();
  h.input.value = "a,b";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(
    typing(h.input, "insertFromPaste"),
  );
  const first = h.announce();
  h.api.clearValue();
  h.api.setValue([]);
  h.input.value = "a,b";
  handler<(event: InputEvent) => void>(h.bag(), "onInput")(
    typing(h.input, "insertFromPaste"),
  );
  const node = document.getElementById(
    String(h.api.getLiveRegionProps()["id"]),
  );
  const second = node === null ? "" : (node.textContent ?? "");
  deepStrictEqual(first, "Pasted 2 tags", "the first paste announces");
  deepStrictEqual(
    second,
    "Pasted 2 tags",
    "the identical repeat still lands in the live tree",
  );
  h.dispose();
});

test("Given host translations / When a mutation lands / Then the overridden message announces", () => {
  const h = mount();
  const root = h.root as unknown as Record<string, unknown>;
  root["translations"] = { tagAdded: (value: string) => `Added ${value}` };
  h.api.addValue("elm");
  deepStrictEqual(h.announce(), "Added elm", "the host override wins");
  h.dispose();
});

test("Given a host sanitizeValue and validate / When a tag is added / Then they decide the value", () => {
  const h = mount();
  const root = h.root as unknown as Record<string, unknown>;
  root["sanitizeValue"] = (value: string): string => value.trim().toLowerCase();
  root["validate"] = ({ inputValue }: { inputValue: string }) =>
    inputValue !== "banned";
  h.api.addValue("  Elm  ");
  deepStrictEqual(h.api.value, ["elm"], "the host sanitizer ran");
  h.api.addValue("banned");
  deepStrictEqual(h.api.value, ["elm"], "the host validator refused the tag");
  deepStrictEqual(
    h.changes.invalid,
    ["invalidTag"],
    "value-invalid reports the refusal",
  );
  h.dispose();
});

test("Given a max / When the list passes it / Then value-invalid reports the overflow once", () => {
  const h = mount({ max: 2 });
  h.api.setValue(["a", "b"]);
  deepStrictEqual(h.changes.invalid, [], "at the cap is not over it");
  h.api.addValue("c");
  deepStrictEqual(h.api.value, ["a", "b", "c"], "addValue is unguarded");
  deepStrictEqual(
    h.changes.invalid,
    ["rangeOverflow"],
    "the overflow reports once",
  );
  h.api.addValue("d");
  deepStrictEqual(
    h.changes.invalid,
    ["rangeOverflow"],
    "still over, no second report",
  );
  h.dispose();
});

// ---- the row model --------------------------------------------------------

test("Given a middle tag removed / When the rows are read / Then a surviving row keeps its identity", () => {
  const h = mount({ defaultValue: ["a", "b", "c"] });
  const before = h.api.getItemPreviewProps(h.row("c"))["id"];
  h.api.clearValue(1);
  deepStrictEqual(h.api.value, ["a", "c"], "the middle tag is gone");
  const after = h.api.getItemPreviewProps(h.row("c"))["id"];
  deepStrictEqual(after, before, "the surviving row's part id is unchanged");
  deepStrictEqual(
    h.api.indexOfRow(h.row("c")),
    1,
    "its index moved to where it now sits",
  );
  h.dispose();
});

test("Given getItemState / When a tag is highlighted / Then the state reads through the api", () => {
  const h = mount({ defaultValue: ["a"] });
  h.pressTag("a");
  const state = h.api.getItemState(h.row("a"));
  deepStrictEqual(state.index, 0, "the index is reported");
  deepStrictEqual(state.highlighted, true, "the highlight is reported");
  deepStrictEqual(state.editing, false, "editing is off");
  deepStrictEqual(state.disabled, false, "an interactive input reads enabled");
  deepStrictEqual(
    state.id,
    String(h.api.getItemPreviewProps(h.row("a"))["id"]),
    "the id matches the preview's",
  );
  h.dispose();
});

test("Given a disabled input / When an item state is read / Then the disabled prop reads through", () => {
  const h = mount({ defaultValue: ["a"], disabled: true });
  deepStrictEqual(
    h.api.getItemState(h.row("a")).disabled,
    true,
    "the disabled prop reads through",
  );
  h.api.addValue("b");
  deepStrictEqual(
    h.api.getItemState(h.row("b")).disabled,
    true,
    "every item is disabled with the input",
  );
  h.dispose();
});
