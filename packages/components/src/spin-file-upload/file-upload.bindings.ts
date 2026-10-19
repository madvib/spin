import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import { coerceJsonArray } from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  type FileRecord,
  type FileRejection,
  type FileUploadContext,
  type FileUploadEvent,
  type FileUploadInitial,
  type FileUploadValueChange,
} from "./file-upload.machine.ts";

/**
 * File-upload definition: the DOM contract as data. The machine owns the
 * modes (idle/focused/dragging) and the validation split; this file maps
 * props to channels, parts to attribute bags, commands to sends, and value
 * transitions to their event.
 *
 * Everything that needs the platform lives here: the dropzone's drag
 * listeners (which report `DRAG_OVER`/`DROP`/`DRAG_LEAVE` and read the
 * dropped `FileList`), the hidden input the picker writes through
 * (`INPUT.CHANGE` with its records), and the row list.
 *
 * Files cross this boundary as records, never as live `File` handles: the
 * input's `files` are read into `{ name, size, type }` at the event, and
 * the rows show that metadata. The picker opens on a rAF, not inline, so
 * the press that opened it is never re-read by the input's click.
 */

export type { FileRecord, FileRejection, FileUploadValueChange };

export interface FileUploadCommands {
  openFilePicker(): void;
  removeFile(name: string): void;
  clear(): void;
}

/** One row: the file's record behind the stable key its name is. */
export interface FileRow {
  readonly value: string;
  readonly file: FileRecord;
}

export interface FileUploadApi extends FileUploadCommands {
  readonly acceptedFiles: readonly FileRecord[];
  readonly rejectedFiles: readonly FileRejection[];
  readonly focused: boolean;
  readonly dragging: boolean;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getDropzoneProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  /** The accepted files as rows, for the recipe's iteration. */
  getAcceptedRows(): readonly FileRow[];
  getItemGroupProps(): Record<string, unknown>;
  getItemProps(row: FileRow): Record<string, unknown>;
  getItemNameProps(row: FileRow): Record<string, unknown>;
  getItemSizeText(row: FileRow): string;
  getItemPathText(row: FileRow): string;
  getItemDeleteTriggerProps(row: FileRow): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
}

/**
 * The JSON transport for a seeded selection: `[{"name":"a.png","size":4,
 * "type":"image/png"}]`. Live files cannot travel as attributes; the
 * seeded channel carries their records.
 */
const isRecord = (entry: unknown): entry is Record<string, unknown> =>
  typeof entry === "object" && entry !== null && !Array.isArray(entry);

/** The seeded selection off the JSON transport: live files cannot travel
 * as attributes, so the seeded channel carries their records. Well-shaped
 * entries survive; anything else is no seed, not a throw. */
const parseFiles = (raw: unknown): FileRecord[] | null => {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : (typeof raw === "string" && raw.length > 0 ? coerceJsonArray(raw, []) : []);
  if (list.length === 0) return null;
  const files: FileRecord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name: unknown = entry["name"];
    const size: unknown = entry["size"];
    if (typeof name !== "string" || typeof size !== "number" || !Number.isFinite(size)) continue;
    const type: unknown = entry["type"];
    const path: unknown = entry["path"];
    files.push({ name, size, type: typeof type === "string" ? type : "", path: typeof path === "string" ? path : "" });
  }
  return files;
};

/** A raw array into records: well-shaped entries survive, the rest drop. */
const shapeFiles = (list: readonly unknown[]): FileRecord[] => {
  const files: FileRecord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name: unknown = entry["name"];
    const size: unknown = entry["size"];
    if (typeof name !== "string" || typeof size !== "number" || !Number.isFinite(size)) continue;
    const type: unknown = entry["type"];
    const path: unknown = entry["path"];
    files.push({ name, size, type: typeof type === "string" ? type : "", path: typeof path === "string" ? path : "" });
  }
  return files;
};

const readInt = (parsed: Record<string, unknown>, name: string): number => {
  const value = parsed[name];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

interface ScopeLike extends PartScope<unknown, FileUploadContext> {}

interface SlotLike<R> extends SlotScope<R, FileUploadContext> {}

/** The hidden input picker: opening it is a view reflex, not a machine
 * move — the press that opened it must not be re-read by the input's own
 * click handling, so the click waits a frame. Reads the node through the
 * framework id path, never a held reference. */
const openPicker = (id: (part: string, slot?: unknown) => string): void => {
  if (typeof document === "undefined") return;
  const node = document.getElementById(id("hiddenInput"));
  if (!(node instanceof HTMLInputElement)) return;
  const request = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn: () => void): number => {
      fn();
      return 0;
    };
  request(() => node.click());
};

/** Transport guarantees the raw prop bag is a FileUploadInitial-shaped object. */
const isFileUploadInitial = (raw: unknown): raw is FileUploadInitial =>
  raw !== null && typeof raw === "object";

const isDirectoryFile = (file: File): file is File & { readonly webkitRelativePath: unknown } =>
  "webkitRelativePath" in file;

/** The folder-relative path a directory pick carries; empty for flat picks. */
const relativePath = (file: File): string => {
  if (!isDirectoryFile(file)) return "";
  const path: unknown = file.webkitRelativePath;
  return typeof path === "string" ? path : "";
};

/** The records a `FileList` holds, read once at the event. */
const toRecords = (list: FileList | null): readonly FileRecord[] => {
  if (list === null) return [];
  const files: FileRecord[] = [];
  for (let at = 0; at < list.length; at++) {
    const file = list[at];
    if (file === undefined) continue;
    files.push({ name: file.name, size: file.size, type: file.type, path: relativePath(file) });
  }
  return files;
};

/** A byte count as the short human form (420 B, 1.4 KB, 2.1 MB). */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1).replace(/\.0$/, "") : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
};

type IdFn = (part: string, slot?: unknown) => string;

/** Row delete handlers, cached per bridge: the scope reads live through
 * proxies, so a cached closure never goes stale. */
const deleteHandlersByBridge = new WeakMap<IdFn, Map<string, { readonly onClick: () => void }>>();
const deleteHandlerFor = (scope: ScopeLike, row: FileRow): { readonly onClick: () => void } => {
  let byName = deleteHandlersByBridge.get(scope.id);
  if (byName === undefined) {
    byName = new Map();
    deleteHandlersByBridge.set(scope.id, byName);
  }
  const hit = byName.get(row.value);
  if (hit !== undefined) return hit;
  const made = { onClick: (): void => scope.send({ type: "FILE.REMOVE", name: row.value }) };
  byName.set(row.value, made);
  return made;
};

const def: ComponentDef<FileUploadContext, FileUploadEvent> = {
  name: "file-upload",
  config,
  implementations,
  seed: (raw) => {
    const props: FileUploadInitial = isFileUploadInitial(raw) ? raw : {};
    const shaped = initial(props);
    return { ...shaped, acceptedFiles: [], rejectedFiles: [] };
  },
  establish: (raw, authored) => {
    // The CLEAR detaches the fork's shared initial context (two dropzones
    // on a page would otherwise share one context until the first drop),
    // and the SET validates the seed.
    const props: FileUploadInitial = isFileUploadInitial(raw) ? raw : {};
    const seeded: unknown = authored("value") ? props.value : props.defaultValue;
    const files = Array.isArray(seeded) ? shapeFiles(seeded) : parseFiles(seeded) ?? [];
    return files.length > 0
      ? [{ type: "VALUE.CLEAR" }, { type: "VALUE.SET", files: [...files] }]
      : [{ type: "VALUE.CLEAR" }];
  },
  reconcile: ({ context, parsed, authored, send }) => {
    if (!authored("value")) return false;
    const raw: unknown = parsed["value"];
    const outer = Array.isArray(raw) ? shapeFiles(raw) : parseFiles(raw) ?? [];
    const names = (list: readonly FileRecord[]): string => list.map((file) => file.name).join(",");
    if (names(context.acceptedFiles) === names(outer)) return false;
    send({ type: "VALUE.CLEAR" });
    if (outer.length > 0) send({ type: "VALUE.SET", files: [...outer] });
    return true;
  },
  scalars: ["multiple", "accept", "directory", "maxFiles", "maxSize", "minSize", "disabled"],
  parts: {
    root: {
      sig: (scope) => [`${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        dir: "ltr",
      }),
    },
    label: {
      sig: (scope) => [`${scope.props["label"]}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
      }),
    },
    dropzone: {
      sig: (scope) => [scope.state, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => {
        const focused = scope.state === "focused";
        const dragging = scope.state === "dragging";
        const disabled = scope.props["disabled"] === true;
        return {
          id: scope.id("dropzone"),
          tabIndex: disabled ? undefined : 0,
          role: "button",
          "aria-labelledby": scope.id("label"),
          "aria-disabled": disabled ? true : undefined,
          "data-focus": dataAttr(focused),
          "data-dragging": dataAttr(dragging),
          "data-disabled": dataAttr(disabled),
          onClick: (): void => {
            if (disabled) return;
            openPicker(scope.id);
          },
          onFocus: (): void => scope.send({ type: "DROPZONE.FOCUS" }),
          onBlur: (): void => scope.send({ type: "DROPZONE.BLUR" }),
          onDragOver: (event: DragEvent): void => {
            event.preventDefault();
            if (disabled) return;
            if (!dragging) scope.send({ type: "DROPZONE.DRAG_OVER" });
          },
          onDragLeave: (): void => scope.send({ type: "DROPZONE.DRAG_LEAVE" }),
          onDrop: (event: DragEvent): void => {
            event.preventDefault();
            if (disabled) return;
            scope.send({ type: "DROP", files: toRecords(event.dataTransfer?.files ?? null) });
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => {
        const ctx = scope.context;
        return [`${ctx.multiple}`, ctx.accept, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("hiddenInput"),
          type: "file",
          multiple: ctx.multiple,
          webkitdirectory: ctx.directory ? true : undefined,
          accept: ctx.accept.length > 0 ? ctx.accept : undefined,
          disabled: scope.props["disabled"],
          hidden: true,
          onChange: (event: Event): void => {
            const node = event.target;
            if (!(node instanceof HTMLInputElement)) return;
            scope.send({ type: "INPUT.CHANGE", files: toRecords(node.files) });
          },
        };
      },
    },
    itemGroup: {
      id: "items",
      sig: (scope) => scope.context.acceptedFiles.map((file) => file.name).join(","),
      attrs: (scope) => ({
        id: scope.id("itemGroup"),
        role: "list",
      }),
    },
    clearTrigger: {
      id: "clear",
      sig: (scope) => [`${scope.context.acceptedFiles.length}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("clearTrigger"),
        "aria-label": "Clear",
        hidden: scope.context.acceptedFiles.length === 0,
        onClick: (): void => scope.send({ type: "VALUE.CLEAR" }),
      }),
    },
  },
  slots: {
    item: {
      indexes: (context: FileUploadContext) =>
        context.acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope: SlotLike<FileRow>) => `${scope.slot.value}`,
      attrs: (scope: SlotLike<FileRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("item", row.value),
          role: "listitem",
        };
      },
    },
    itemName: {
      id: "name",
      indexes: (context: FileUploadContext) =>
        context.acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope: SlotLike<FileRow>) => `${scope.slot.value}`,
      attrs: (scope: SlotLike<FileRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("itemName", row.value),
        };
      },
    },
    itemDeleteTrigger: {
      id: "delete",
      indexes: (context: FileUploadContext) =>
        context.acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope: SlotLike<FileRow>) => `${scope.slot.value} ${scope.props["disabled"] === true}`,
      attrs: (scope: SlotLike<FileRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("itemDeleteTrigger", row.value),
          "aria-label": `Remove ${row.value}`,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          ...deleteHandlerFor(scope, row),
        };
      },
    },
  },
  commands: {
    openFilePicker: {
      view: ({ id }) => {
        openPicker(id);
      },
    },
    removeFile: { event: (args) => ({ type: "FILE.REMOVE", name: typeof args[0] === "string" ? args[0] : "" }) },
    clear: { event: () => ({ type: "VALUE.CLEAR" }) },
  },
  readers: {
    acceptedFiles: { read: (context) => context.acceptedFiles },
    rejectedFiles: { read: (context) => context.rejectedFiles },
    focused: { read: (_context, state) => state === "focused" },
    dragging: { read: (_context, state) => state === "dragging" },
  },
  methods: {
    getAcceptedRows: {
      call: (context: FileUploadContext) =>
        context.acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
    },
    getItemSizeText: {
      call: (_context, _state, args) => {
        const row = args[0];
        if (!isRecord(row)) return formatBytes(0);
        const file: unknown = row["file"];
        if (!isRecord(file)) return formatBytes(0);
        const size: unknown = file["size"];
        return formatBytes(typeof size === "number" && Number.isFinite(size) ? size : 0);
      },
    },
    getItemPathText: {
      call: (_context, _state, args) => {
        const row = args[0];
        if (!isRecord(row)) return "";
        const file: unknown = row["file"];
        if (!isRecord(file)) return "";
        const path: unknown = file["path"];
        const name: unknown = file["name"];
        if (typeof path === "string" && path.length > 0) return path;
        return typeof name === "string" ? name : "";
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => {
        const ctx = context;
        return [
          ctx.acceptedFiles.map((file) => file.name).join(","),
          ctx.rejectedFiles.map((item) => `${item.file.name}:${item.code}`).join(","),
        ];
      },
      detail: (_watched, _event, _props, context: FileUploadContext) => ({
        acceptedFiles: [...context.acceptedFiles],
        rejectedFiles: [...context.rejectedFiles],
      }),
    },
  },
};

export const fileUpload = defineComponent<FileUploadContext, FileUploadEvent, FileUploadApi>(def);
