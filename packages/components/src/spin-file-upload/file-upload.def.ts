import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type FileRecord,
  type FileRejection,
  type FileUploadContext,
  type FileUploadEvent,
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
  getItemDeleteTriggerProps(row: FileRow): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
}

/**
 * The JSON transport for a seeded selection: `[{"name":"a.png","size":4,
 * "type":"image/png"}]`. Live files cannot travel as attributes; the
 * seeded channel carries their records.
 */
const parseFiles = (raw: unknown): FileRecord[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const files: FileRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const name = bag["name"];
    const size = bag["size"];
    const type = bag["type"];
    if (typeof name !== "string" || typeof size !== "number") continue;
    files.push({ name, size, type: typeof type === "string" ? type : "" });
  }
  return files;
};

const readInt = (parsed: Record<string, unknown>, name: string): number => {
  const value = parsed[name];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

type Ctx = FileUploadContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

/** The records a `FileList` holds, read once at the event. */
const toRecords = (list: FileList | null): readonly FileRecord[] => {
  if (list === null) return [];
  const files: FileRecord[] = [];
  for (let at = 0; at < list.length; at++) {
    const file = list[at];
    if (file === undefined) continue;
    files.push({ name: file.name, size: file.size, type: file.type });
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
  seed: (props) => ({
    multiple: props["multiple"] === true,
    accept: typeof props["accept"] === "string" ? props["accept"] : "",
    maxFiles: readInt(props, "maxFiles"),
    maxSize: readInt(props, "maxSize"),
    minSize: readInt(props, "minSize"),
    disabled: props["disabled"] === true,
    acceptedFiles: [],
    rejectedFiles: [],
  }),
  establish: (props, authored) => {
    // Already parsed by the `value` channel; the CLEAR detaches the fork's
    // shared initial context (two dropzones on a page would otherwise share
    // one context until the first drop), and the SET validates the seed.
    const seeded = (authored("value") ? props["value"] : props["defaultValue"]) as readonly FileRecord[];
    const files = Array.isArray(seeded) ? seeded : parseFiles(seeded) ?? [];
    return files.length > 0
      ? [{ type: "VALUE.CLEAR" }, { type: "VALUE.SET", files: [...files] }]
      : [{ type: "VALUE.CLEAR" }];
  },
  channels: {
    value: {
      controlled: true,
      parse: (raw) => {
        if (Array.isArray(raw)) {
          return (raw as readonly unknown[]).filter(
            (entry): entry is FileRecord =>
              typeof entry === "object" && entry !== null &&
              typeof (entry as Record<string, unknown>)["name"] === "string",
          );
        }
        return parseFiles(raw) ?? [];
      },
      event: (value: readonly FileRecord[]) => ({ type: "VALUE.SET", files: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) &&
        (current as readonly FileRecord[]).map((file) => file.name).join(",") ===
          (outer as readonly FileRecord[]).map((file) => file.name).join(","),
    },
    defaultValue: {
      parse: (raw) => (typeof raw === "string" ? raw : ""),
    },
    files: { parse: (raw) => raw },
    multiple: { parse: (raw) => raw === true },
    accept: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    maxFiles: { parse: (raw) => readInt({ value: raw }, "value") },
    maxSize: { parse: (raw) => readInt({ value: raw }, "value") },
    minSize: { parse: (raw) => readInt({ value: raw }, "value") },
    disabled: { parse: (raw) => raw === true },
    label: { parse: (raw) => (typeof raw === "string" ? raw : "") },
  },
  scalars: ["multiple", "accept", "maxFiles", "maxSize", "minSize", "disabled"],
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
            const node = typeof document === "undefined"
              ? null
              : document.getElementById(scope.id("hiddenInput"));
            if (!(node instanceof HTMLInputElement)) return;
            // The rAF: the press that opened the picker must not be
            // re-read by the input's own click handling.
            const request = typeof requestAnimationFrame === "function"
              ? requestAnimationFrame
              : (fn: () => void): number => {
                fn();
                return 0;
              };
            request(() => node.click());
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
        const ctx = asCtx(scope.context);
        return [`${ctx.multiple}`, ctx.accept, `${scope.props["disabled"] === true}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        return {
          id: scope.id("hiddenInput"),
          type: "file",
          multiple: ctx.multiple,
          accept: ctx.accept.length > 0 ? ctx.accept : undefined,
          disabled: scope.props["disabled"],
          hidden: true,
          onChange: (event: Event): void => {
            const node = event.target;
            if (typeof HTMLInputElement !== "undefined" && !(node instanceof HTMLInputElement)) return;
            const files = (node as HTMLInputElement).files;
            scope.send({ type: "INPUT.CHANGE", files: toRecords(files) });
          },
        };
      },
    },
    itemGroup: {
      id: "items",
      sig: (scope) => asCtx(scope.context).acceptedFiles.map((file) => file.name).join(","),
      attrs: (scope) => ({
        id: scope.id("itemGroup"),
        role: "list",
      }),
    },
    clearTrigger: {
      id: "clear",
      sig: (scope) => [`${asCtx(scope.context).acceptedFiles.length}`, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("clearTrigger"),
        "aria-label": "Clear",
        hidden: asCtx(scope.context).acceptedFiles.length === 0,
        onClick: (): void => scope.send({ type: "VALUE.CLEAR" }),
      }),
    },
  },
  slots: {
    item: {
      indexes: (context) =>
        asCtx(context).acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope) => `${(scope.slot as unknown as FileRow).value}`,
      attrs: (scope) => {
        const row = scope.slot as unknown as FileRow;
        return {
          id: scope.id("item", row.value),
          role: "listitem",
        };
      },
    },
    itemName: {
      id: "name",
      indexes: (context) =>
        asCtx(context).acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope) => `${(scope.slot as unknown as FileRow).value}`,
      attrs: (scope) => {
        const row = scope.slot as unknown as FileRow;
        return {
          id: scope.id("itemName", row.value),
        };
      },
    },
    itemDeleteTrigger: {
      id: "delete",
      indexes: (context) =>
        asCtx(context).acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
      sig: (scope) => {
        const row = scope.slot as unknown as FileRow;
        return `${row.value} ${scope.props["disabled"] === true}`;
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as FileRow;
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
      },
    },
    removeFile: { event: (args) => ({ type: "FILE.REMOVE", name: args[0] as string }) },
    clear: { event: () => ({ type: "VALUE.CLEAR" }) },
  },
  readers: {
    acceptedFiles: { read: (context) => asCtx(context).acceptedFiles },
    rejectedFiles: { read: (context) => asCtx(context).rejectedFiles },
    focused: { read: (_context, state) => state === "focused" },
    dragging: { read: (_context, state) => state === "dragging" },
  },
  methods: {
    getAcceptedRows: {
      call: (context) =>
        (context as unknown as Ctx).acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
    },
    getItemSizeText: {
      call: (_context, _state, args) => formatBytes((args[0] as FileRow).file.size),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => {
        const ctx = asCtx(context);
        return [
          ctx.acceptedFiles.map((file) => file.name).join(","),
          ctx.rejectedFiles.map((item) => `${item.file.name}:${item.code}`).join(","),
        ];
      },
      detail: (watched, _event, _props, context) => {
        void watched;
        const ctx = context as unknown as Ctx;
        return {
          acceptedFiles: [...ctx.acceptedFiles],
          rejectedFiles: [...ctx.rejectedFiles],
        };
      },
    },
  },
};

export const fileUpload = defineComponent<FileUploadContext, FileUploadEvent, FileUploadApi>(def);
