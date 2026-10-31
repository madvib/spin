import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { signal } from "@spinjs/runtime";
import { fileUpload } from "./file-upload.presentation.ts";
const createFileUploadBridge = fileUpload.createBridge;
import type { FileUploadApi } from "./file-upload.presentation.ts";
import type { FileRecord } from "./file-upload.state.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.HTMLInputElement = win.HTMLInputElement;
globalThis.Element = win.Element;

/** A bag read for one handler, checked and typed in one place. */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

type WriteSignal = { (): unknown; (value: unknown): void };

interface Harness {
  readonly api: FileUploadApi;
  readonly changes: string[];
  readonly props: Record<string, WriteSignal>;
  /** Presents `files` on the hidden input and fires its change handler. */
  chooseFiles(files: readonly FileRecord[]): void;
  dispose(): void;
}

function harness(initial: Record<string, unknown> = {}): Harness {
  const root = document.createElement("div");
  const inputNode = document.createElement("input");
  inputNode.type = "file";
  root.appendChild(inputNode);
  document.body.appendChild(root);
  const changes: string[] = [];
  const store = new Map<string, WriteSignal>();
  const props = (): Record<string, unknown> => {
    const bag: Record<string, unknown> = {};
    for (const [name, cell] of store) bag[name] = cell();
    bag["@@authored"] = (name: string): boolean => store.has(name);
    bag["onValueChange"] = (
      d: { acceptedFiles: readonly FileRecord[] },
    ): void => {
      changes.push(d.acceptedFiles.map((file) => file.name).join(","));
    };
    return bag;
  };
  for (const [name, value] of Object.entries(initial)) {
    store.set(name, signal(value) as unknown as WriteSignal);
  }
  const bridge = createFileUploadBridge(props, () => root, "test");
  return {
    api: bridge.api,
    changes,
    props: Object.fromEntries(store) as Record<string, WriteSignal>,
    chooseFiles: (files) => {
      // The input is the real node (linkedom's HTMLInputElement), and its
      // `files` is stubbed: the handler reads the node's list.
      Object.defineProperty(inputNode, "files", {
        value: files,
        configurable: true,
      });
      handler<(e: Event) => void>(bridge.api.getHiddenInputProps(), "onChange")(
        {
          target: inputNode,
        } as unknown as Event,
      );
    },
    dispose: () => bridge.dispose(),
  };
}

const file = (name: string, size = 100, type = ""): FileRecord => ({
  name,
  size,
  type,
  path: "",
});

const names = (api: FileUploadApi): string[] =>
  api.acceptedFiles.map((entry) => entry.name);

test("Given an empty dropzone / When files arrive through the input / Then they validate and land", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  deepStrictEqual(names(h.api), ["a.png"], "the accepted file lands");
  deepStrictEqual(h.changes, ["a.png"], "one value-change");
  h.dispose();
});

test("Given an accept rule / When a mismatched file arrives / Then it is rejected with the rule", () => {
  const h = harness({ multiple: true, accept: "image/*" });
  h.chooseFiles([
    file("a.png", 4, "image/png"),
    file("a.txt", 4, "text/plain"),
  ]);
  deepStrictEqual(names(h.api), ["a.png"], "the image is accepted");
  deepStrictEqual(
    h.api.rejectedFiles.map((item) => `${item.file.name}:${item.code}`),
    ["a.txt:accept"],
    "the text file names its rule",
  );
  h.dispose();
});

test("Given a size bound / When a too-large file arrives / Then it is rejected", () => {
  const h = harness({ multiple: true, maxSize: 100 });
  h.chooseFiles([file("big.bin", 101)]);
  deepStrictEqual(names(h.api), [], "nothing accepted");
  deepStrictEqual(
    h.api.rejectedFiles.map((item) => item.code),
    ["too-large"],
    "the rule is the bound",
  );
  h.dispose();
});

test("Given a single-mode dropzone / When two files arrive / Then only the first lands", () => {
  const h = harness();
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  deepStrictEqual(names(h.api), ["a.png"], "single mode keeps the first");
  h.dispose();
});

test("Given a filled dropzone / When a drop arrives / Then multiple mode appends", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDrop")({
    preventDefault: () => undefined,
    dataTransfer: {
      files: [{ name: "b.png", size: 4, type: "image/png", path: "" }],
    },
  } as unknown as DragEvent);
  deepStrictEqual(names(h.api), ["a.png", "b.png"], "the drop appends");
  h.dispose();
});

test("Given a count cap / When a drop would exceed it / Then the extra is rejected", () => {
  const h = harness({ multiple: true, maxFiles: 2 });
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDrop")({
    preventDefault: () => undefined,
    dataTransfer: {
      files: [{ name: "c.png", size: 4, type: "image/png", path: "" }],
    },
  } as unknown as DragEvent);
  deepStrictEqual(names(h.api), ["a.png", "b.png"], "the cap holds");
  deepStrictEqual(
    h.api.rejectedFiles.map((item) => `${item.file.name}:${item.code}`),
    ["c.png:too-many"],
    "and reports the rule",
  );
  h.dispose();
});

test("Given a dropzone / When files arrive through paste / Then they validate and land", () => {
  const h = harness({ multiple: true });
  handler<(e: ClipboardEvent) => void>(h.api.getDropzoneProps(), "onPaste")({
    preventDefault: () => undefined,
    clipboardData: { files: [file("shot.png", 7, "image/png")] },
  } as unknown as ClipboardEvent);
  deepStrictEqual(names(h.api), ["shot.png"], "the pasted file lands");
  deepStrictEqual(h.changes, ["shot.png"], "one value-change");
  h.dispose();
});

test("Given a dropzone with files / When a fileless paste arrives / Then the selection holds", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  handler<(e: ClipboardEvent) => void>(h.api.getDropzoneProps(), "onPaste")({
    preventDefault: () => undefined,
    clipboardData: { files: [] },
  } as unknown as ClipboardEvent);
  deepStrictEqual(names(h.api), ["a.png"], "a text paste changes nothing");
  h.dispose();
});

test("Given the modes / When focus and drag arrive / Then the dropzone reports them", () => {
  const h = harness();
  const dropzone = h.api.getDropzoneProps();
  deepStrictEqual(dropzone["data-focus"], undefined, "not focused at rest");
  handler<() => void>(dropzone, "onFocus")();
  deepStrictEqual(h.api.getDropzoneProps()["data-focus"], "", "focus is reported");
  handler<() => void>(h.api.getDropzoneProps(), "onBlur")();
  deepStrictEqual(
    h.api.getDropzoneProps()["data-focus"],
    undefined,
    "blur returns to idle",
  );
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDragOver")({
    preventDefault: () => undefined,
  } as unknown as DragEvent);
  deepStrictEqual(
    h.api.getDropzoneProps()["data-dragging"],
    "",
    "a drag over enters dragging",
  );
  handler<() => void>(h.api.getDropzoneProps(), "onDragLeave")();
  deepStrictEqual(
    h.api.getDropzoneProps()["data-dragging"],
    undefined,
    "and leaving returns",
  );
  h.dispose();
});

test("Given a filled dropzone / When removeFile is called / Then the row leaves", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  h.api.removeFile("a.png");
  deepStrictEqual(names(h.api), ["b.png"], "the named file leaves");
  h.dispose();
});

test("Given a seeded value / When the host alternates it / Then the machine follows", () => {
  const h = harness({
    value: '[{"name":"a.png","size":4,"type":"image/png"}]',
    multiple: true,
  });
  deepStrictEqual(names(h.api), ["a.png"], "the seed lands");
  const cell = h.props["value"];
  if (cell === undefined) throw new Error("no value cell");
  cell('[{"name":"b.png","size":4,"type":"image/png"}]');
  deepStrictEqual(
    names(h.api),
    ["b.png"],
    "the host's write alternates the selection",
  );
  h.dispose();
});

test("Given the item bags / When read / Then the size text is the human form", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 2048, "image/png")]);
  const row = h.api.getAcceptedRows()[0];
  if (row === undefined) throw new Error("no row");
  deepStrictEqual(h.api.getItemSizeText(row), "2 KB", "the row shows bytes as KB");
  deepStrictEqual(
    h.api.getItemSizeText({ value: "a.png", file: file("a.png", 4) }),
    "4 B",
    "small files stay in bytes",
  );
  const bag = h.api.getItemDeleteTriggerProps(row);
  deepStrictEqual(
    bag["aria-label"],
    "Remove a.png",
    "the delete trigger names its row",
  );
  h.dispose();
});

test("Given an imperative clear / When called / Then the selection empties", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  h.api.clear();
  deepStrictEqual(names(h.api), [], "clear empties");
  h.dispose();
});
