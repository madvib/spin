/**
 * File-upload connect: the DOM contract and the two file entry paths.
 *
 * The machine owns the modes (idle/focused/dragging) and the validation
 * split. Everything that needs the platform lives here: the dropzone's
 * drag listeners (which report `DRAG_OVER`/`DROP`/`DRAG_LEAVE` and read
 * the dropped `FileList`), the hidden input the picker writes through
 * (`INPUT.CHANGE` with its records), and the row list.
 *
 * Files cross this boundary as records, never as live `File` handles: the
 * input's `files` are read into `{ name, size, type }` at the event, and
 * the rows show that metadata. The picker opens on a rAF, not inline, so
 * the press that opened it is never re-read by the input's click.
 */

import type {
  FileRecord,
  FileRejection,
  FileUploadContext,
  FileUploadEvent,
} from "./file-upload.machine.ts";

export interface FileUploadConnectProps {
  readonly label: string;
  readonly disabled: boolean;
}

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

export interface FileUploadService {
  readonly context: FileUploadContext;
  readonly focused: boolean;
  readonly dragging: boolean;
  send(event: FileUploadEvent): void;
}

export type ReadFileUploadProps = () => FileUploadConnectProps;

const NAMESPACE = "file-upload";

function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

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
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1).replace(/\.0$/, "") : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}

export function connectRobotFileUpload(
  service: FileUploadService,
  readProps: ReadFileUploadProps,
  id: string,
  root: () => Element,
): FileUploadApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const labelId = `${ownerId}:label`;

  const ctx = (): FileUploadContext => service.context;
  const props = (): FileUploadConnectProps => readProps();

  const input = (): HTMLInputElement | null => {
    const node = root().querySelector(`[id="${ownerId}:input"]`);
    return node instanceof HTMLInputElement ? node : null;
  };

  const send = (event: FileUploadEvent): void => service.send(event);

  const caches = new Map<string, { sig: string; bag: Record<string, unknown> }>();
  const cached = (key: string, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = caches.get(key);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    caches.set(key, { sig, bag });
    return bag;
  };

  const rowHandlers = new Map<string, {
    readonly onClick: () => void;
  }>();
  const handlersFor = (row: FileRow): { readonly onClick: () => void } => {
    const hit = rowHandlers.get(row.value);
    if (hit !== undefined) return hit;
    const made = { onClick: () => send({ type: "FILE.REMOVE", name: row.value }) };
    rowHandlers.set(row.value, made);
    return made;
  };

  const api: FileUploadApi = {
    get acceptedFiles(): readonly FileRecord[] {
      return ctx().acceptedFiles;
    },
    get rejectedFiles(): readonly FileRejection[] {
      return ctx().rejectedFiles;
    },
    get focused(): boolean {
      return service.focused;
    },
    get dragging(): boolean {
      return service.dragging;
    },
    openFilePicker: () => {
      const node = input();
      if (node === null) return;
      // The rAF: the press that opened the picker must not be re-read by
      // the input's own click handling.
      requestAnimationFrame(() => node.click());
    },
    removeFile: (name: string) => send({ type: "FILE.REMOVE", name }),
    clear: () => send({ type: "VALUE.CLEAR" }),
    getRootProps: () =>
      cached("root", `${props().disabled}`, () => ({
        id: ownerId,
        "data-disabled": dataAttr(props().disabled),
        dir: "ltr",
      })),
    getLabelProps: () =>
      cached("label", `${props().label}`, () => ({
        id: labelId,
      })),
    getDropzoneProps: () =>
      cached("dropzone", `${service.focused}\u0000${service.dragging}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:dropzone`,
        tabIndex: props().disabled ? undefined : 0,
        role: "button",
        "aria-labelledby": labelId,
        "aria-disabled": props().disabled ? true : undefined,
        "data-focus": dataAttr(service.focused),
        "data-dragging": dataAttr(service.dragging),
        "data-disabled": dataAttr(props().disabled),
        onClick: () => {
          if (props().disabled) return;
          api.openFilePicker();
        },
        onFocus: () => send({ type: "DROPZONE.FOCUS" }),
        onBlur: () => send({ type: "DROPZONE.BLUR" }),
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          if (props().disabled) return;
          if (!service.dragging) send({ type: "DROPZONE.DRAG_OVER" });
        },
        onDragLeave: () => send({ type: "DROPZONE.DRAG_LEAVE" }),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          if (props().disabled) return;
          send({ type: "DROP", files: toRecords(event.dataTransfer?.files ?? null) });
        },
      })),
    getHiddenInputProps: () => {
      const at = ctx();
      // The sig carries the scalars the bag reads: a host write that
      // changes them must rebuild the bag, not freeze the first read.
      return cached("input", `${at.multiple}\u0000${at.accept}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:input`,
        type: "file",
        multiple: at.multiple,
        accept: at.accept.length > 0 ? at.accept : undefined,
        disabled: props().disabled,
        hidden: true,
        onChange: (event: Event) => {
          const node = event.target;
          if (!(node instanceof HTMLInputElement)) return;
          send({ type: "INPUT.CHANGE", files: toRecords(node.files) });
        },
      }));
    },
    getAcceptedRows: () =>
      ctx().acceptedFiles.map((entry) => ({ value: entry.name, file: entry })),
    getItemGroupProps: () =>
      cached("items", `${ctx().acceptedFiles.map((file) => file.name).join(",")}`, () => ({
        id: `${ownerId}:items`,
        role: "list",
      })),
    getItemProps: (row: FileRow) =>
      cached(`item:${row.value}`, `${row.value}`, () => ({
        id: `${ownerId}:item:${row.value}`,
        role: "listitem",
      })),
    getItemNameProps: (row: FileRow) =>
      cached(`name:${row.value}`, `${row.value}`, () => ({
        id: `${ownerId}:name:${row.value}`,
      })),
    getItemSizeText: (row: FileRow) => formatBytes(row.file.size),
    getItemDeleteTriggerProps: (row: FileRow) => {
      const handlers = handlersFor(row);
      return cached(`delete:${row.value}`, `${row.value}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:delete:${row.value}`,
        "aria-label": `Remove ${row.value}`,
        "data-disabled": dataAttr(props().disabled),
        ...handlers,
      }));
    },
    getClearTriggerProps: () =>
      cached("clear", `${ctx().acceptedFiles.length}\u0000${props().disabled}`, () => ({
        id: `${ownerId}:clear`,
        "aria-label": "Clear",
        hidden: ctx().acceptedFiles.length === 0,
        onClick: () => send({ type: "VALUE.CLEAR" }),
      })),
  };

  return api;
}
