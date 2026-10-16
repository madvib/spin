import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { fileUpload } from "./file-upload.def.ts";
const createFileUploadBridge = fileUpload.createBridge;
import type { FileUploadApi } from "./file-upload.def.ts";
import type { FileRecord } from "./file-upload.machine.ts";

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
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
    bag["onValueChange"] = (d: { acceptedFiles: readonly FileRecord[] }): void => {
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
      Object.defineProperty(inputNode, "files", { value: files, configurable: true });
      handler<(e: Event) => void>(bridge.api.getHiddenInputProps(), "onChange")({
        target: inputNode,
      } as unknown as Event);
    },
    dispose: () => bridge.dispose(),
  };
}

const file = (name: string, size = 100, type = ""): FileRecord => ({ name, size, type });

const names = (api: FileUploadApi): string[] => api.acceptedFiles.map((entry) => entry.name);

Deno.test("Given an empty dropzone / When files arrive through the input / Then they validate and land", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  assertEquals(names(h.api), ["a.png"], "the accepted file lands");
  assertEquals(h.changes, ["a.png"], "one value-change");
  h.dispose();
});

Deno.test("Given an accept rule / When a mismatched file arrives / Then it is rejected with the rule", () => {
  const h = harness({ multiple: true, accept: "image/*" });
  h.chooseFiles([file("a.png", 4, "image/png"), file("a.txt", 4, "text/plain")]);
  assertEquals(names(h.api), ["a.png"], "the image is accepted");
  assertEquals(h.api.rejectedFiles.map((item) => `${item.file.name}:${item.code}`), ["a.txt:accept"], "the text file names its rule");
  h.dispose();
});

Deno.test("Given a size bound / When a too-large file arrives / Then it is rejected", () => {
  const h = harness({ multiple: true, maxSize: 100 });
  h.chooseFiles([file("big.bin", 101)]);
  assertEquals(names(h.api), [], "nothing accepted");
  assertEquals(h.api.rejectedFiles.map((item) => item.code), ["too-large"], "the rule is the bound");
  h.dispose();
});

Deno.test("Given a single-mode dropzone / When two files arrive / Then only the first lands", () => {
  const h = harness();
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  assertEquals(names(h.api), ["a.png"], "single mode keeps the first");
  h.dispose();
});

Deno.test("Given a filled dropzone / When a drop arrives / Then multiple mode appends", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDrop")({
    preventDefault: () => undefined,
    dataTransfer: { files: [{ name: "b.png", size: 4, type: "image/png" }] },
  } as unknown as DragEvent);
  assertEquals(names(h.api), ["a.png", "b.png"], "the drop appends");
  h.dispose();
});

Deno.test("Given a count cap / When a drop would exceed it / Then the extra is rejected", () => {
  const h = harness({ multiple: true, maxFiles: 2 });
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDrop")({
    preventDefault: () => undefined,
    dataTransfer: { files: [{ name: "c.png", size: 4, type: "image/png" }] },
  } as unknown as DragEvent);
  assertEquals(names(h.api), ["a.png", "b.png"], "the cap holds");
  assertEquals(h.api.rejectedFiles.map((item) => `${item.file.name}:${item.code}`), ["c.png:too-many"], "and reports the rule");
  h.dispose();
});

Deno.test("Given the modes / When focus and drag arrive / Then the dropzone reports them", () => {
  const h = harness();
  const dropzone = h.api.getDropzoneProps();
  assertEquals(dropzone["data-focus"], undefined, "not focused at rest");
  handler<() => void>(dropzone, "onFocus")();
  assertEquals(h.api.getDropzoneProps()["data-focus"], "", "focus is reported");
  handler<() => void>(h.api.getDropzoneProps(), "onBlur")();
  assertEquals(h.api.getDropzoneProps()["data-focus"], undefined, "blur returns to idle");
  handler<(e: DragEvent) => void>(h.api.getDropzoneProps(), "onDragOver")({
    preventDefault: () => undefined,
  } as unknown as DragEvent);
  assertEquals(h.api.getDropzoneProps()["data-dragging"], "", "a drag over enters dragging");
  handler<() => void>(h.api.getDropzoneProps(), "onDragLeave")();
  assertEquals(h.api.getDropzoneProps()["data-dragging"], undefined, "and leaving returns");
  h.dispose();
});

Deno.test("Given a filled dropzone / When removeFile is called / Then the row leaves", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png"), file("b.png", 4, "image/png")]);
  h.api.removeFile("a.png");
  assertEquals(names(h.api), ["b.png"], "the named file leaves");
  h.dispose();
});

Deno.test("Given a seeded value / When the host alternates it / Then the machine follows", () => {
  const h = harness({
    value: "[{\"name\":\"a.png\",\"size\":4,\"type\":\"image/png\"}]",
    multiple: true,
  });
  assertEquals(names(h.api), ["a.png"], "the seed lands");
  const cell = h.props["value"];
  if (cell === undefined) throw new Error("no value cell");
  cell("[{\"name\":\"b.png\",\"size\":4,\"type\":\"image/png\"}]");
  assertEquals(names(h.api), ["b.png"], "the host's write alternates the selection");
  h.dispose();
});

Deno.test("Given the item bags / When read / Then the size text is the human form", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 2048, "image/png")]);
  const row = h.api.getAcceptedRows()[0];
  if (row === undefined) throw new Error("no row");
  assertEquals(h.api.getItemSizeText(row), "2 KB", "the row shows bytes as KB");
  assertEquals(h.api.getItemSizeText({ value: "a.png", file: file("a.png", 4) }), "4 B", "small files stay in bytes");
  const bag = h.api.getItemDeleteTriggerProps(row);
  assertEquals(bag["aria-label"], "Remove a.png", "the delete trigger names its row");
  h.dispose();
});

Deno.test("Given an imperative clear / When called / Then the selection empties", () => {
  const h = harness({ multiple: true });
  h.chooseFiles([file("a.png", 4, "image/png")]);
  h.api.clear();
  assertEquals(names(h.api), [], "clear empties");
  h.dispose();
});
