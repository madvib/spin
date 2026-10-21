import { dataAttr, defineComponent, isRecord, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  fileUpload as fileUploadMachine,
  type FileRecord,
  type FileRejection,
  type FileUploadArgs,
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
 * the rows show that metadata.
 */

export type { FileRecord, FileRejection, FileUploadValueChange };

export interface FileUploadCommands {
  openFilePicker(): void;
  removeFile(name: string): void;
  clear(): void;
}

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
  getAcceptedRows(): readonly FileRow[];
  getItemGroupProps(): Record<string, unknown>;
  getItemProps(row: FileRow): Record<string, unknown>;
  getItemNameProps(row: FileRow): Record<string, unknown>;
  getItemSizeText(row: FileRow): string;
  getItemPathText(row: FileRow): string;
  getItemDeleteTriggerProps(row: FileRow): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
}

interface ScopeLike extends PartScope<unknown, FileUploadContext> {}

interface SlotLike<R> extends SlotScope<R, FileUploadContext> {}

/** Opening the hidden input is a view reflex, not a machine move — the
 * press that opened it must not be re-read by the input's own click
 * handling, so the click waits a frame. The node is read through the
 * framework id path, never held. */
const openPicker = (
  id: (part: string, slot?: unknown) => string,
  root: () => Element,
): void => {
  if (typeof document === "undefined") return;
  const node = root().querySelector(`#${id("hiddenInput")}`);
  if (!(node instanceof HTMLInputElement)) return;
  const request = typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn: () => void): number => {
      fn();
      return 0;
    };
  request(() => node.click());
};

const isDirectoryFile = (file: File): file is File & { readonly webkitRelativePath: unknown } =>
  "webkitRelativePath" in file;

/** A directory pick carries a folder-relative path; flat picks do not. */
const relativePath = (file: File): string => {
  if (!isDirectoryFile(file)) return "";
  const path: unknown = file.webkitRelativePath;
  return typeof path === "string" ? path : "";
};

/** The `FileList` is read once at the event; it is live afterwards. */
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
  machine: (props, authored) => fileUploadMachine(props as FileUploadArgs, authored),
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
            openPicker(scope.id, scope.root);
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
      view: ({ id, root }) => {
        openPicker(id, root);
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
