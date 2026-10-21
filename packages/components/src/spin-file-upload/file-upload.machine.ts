/**
 * File-upload machine: the dropzone's modes and the accept/reject split.
 *
 * Zag's file-upload is `idle`/`focused`/`dragging` — the fork's shape
 * exactly, with the validation (accept, size bounds, count cap) as assigns
 * that decide what a set of files may become. That decision is the
 * machine's: it is the only part where a file list becomes a legal
 * selection.
 *
 * Files are plain records here (`{ name, size, type }`). The connect
 * builds them from the platform's `FileList` on the input and drop
 * paths, and the host reads them back; nothing in this file touches the
 * DOM or the File API, and a record a runtime cannot express (a live
 * `File` handle, a stream) is out of scope — the row shows its metadata.
 */

import { coerceJsonArray, defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const setFiles = (ctx: FileUploadContext, e: FileUploadEvent) : Partial<FileUploadContext> => {
      if (e.type !== "INPUT.CHANGE") return {};
      const split = splitFiles(e.files, ctx);
      return {
        acceptedFiles: ctx.multiple ? [...split.accepted] : split.accepted.slice(0, 1),
        rejectedFiles: [...split.rejected],
      };
    };

const addFiles = (ctx: FileUploadContext, e: FileUploadEvent) : Partial<FileUploadContext> => {
      if (e.type !== "DROP") return {};
      const split = splitFiles(e.files, ctx, ctx.acceptedFiles.length);
      if (!ctx.multiple) {
        return {
          acceptedFiles: split.accepted.slice(0, 1),
          rejectedFiles: [...split.rejected],
        };
      }
      return {
        acceptedFiles: [...ctx.acceptedFiles, ...split.accepted],
        rejectedFiles: [...ctx.rejectedFiles, ...split.rejected],
      };
    };



export interface FileRecord {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
}

export interface FileUploadContext {
  acceptedFiles: FileRecord[];
  rejectedFiles: FileRejection[];
  multiple: boolean;
  directory: boolean;
  accept: string;
  maxFiles: number;
  maxSize: number;
  minSize: number;
  disabled: boolean;
}

export interface FileRejection {
  readonly file: FileRecord;
  readonly code: string;
}

export interface FileUploadValueChange {
  readonly acceptedFiles: readonly FileRecord[];
  readonly rejectedFiles: readonly FileRejection[];
}

export interface FileUploadArgs {
  value?: string;
  multiple?: boolean;
  directory?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  minSize?: number;
  disabled?: boolean;
  defaultDisabled?: boolean;
}

/** A write carries the records themselves, or the JSON text a host wrote;
 * well-shaped entries survive, anything else is no file. */
export function filesOf(raw: unknown): FileRecord[] {
  const list: readonly unknown[] = Array.isArray(raw)
    ? raw
    : (typeof raw === "string" && raw.length > 0 ? coerceJsonArray(raw, []) : []);
  const files: FileRecord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name: unknown = entry["name"];
    const size: unknown = entry["size"];
    if (typeof name !== "string" || typeof size !== "number" || !Number.isFinite(size)) continue;
    const type: unknown = entry["type"];
    const path: unknown = entry["path"];
    files.push({
      name,
      size,
      type: typeof type === "string" ? type : "",
      path: typeof path === "string" ? path : "",
    });
  }
  return files;
}

export function initial(args: FileUploadArgs = {}, authored: (name: string) => boolean): FileUploadContext {
  // The twin is the framework's convention: a host that wrote
  // `defaultValue` wrote the channel too, and the framework has already
  // resolved it into the argument.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const count = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  return {
    acceptedFiles: written("value") ? filesOf(args.value) : [],
    rejectedFiles: [],
    multiple: written("multiple") ? args.multiple === true : false,
    directory: written("directory") ? args.directory === true : false,
    accept: written("accept") && typeof args.accept === "string" ? args.accept : "",
    maxFiles: written("maxFiles") ? count(args.maxFiles) : 0,
    maxSize: written("maxSize") ? count(args.maxSize) : 0,
    minSize: written("minSize") ? count(args.minSize) : 0,
    disabled: written("disabled") ? args.disabled === true : false,
  };
}

export interface FileUploadEvents {
  "INPUT.CHANGE": { files: readonly FileRecord[] };
  "DROP": { files: readonly FileRecord[] };
  "DROPZONE.FOCUS": {};
  "DROPZONE.BLUR": {};
  "DROPZONE.DRAG_OVER": {};
  "DROPZONE.DRAG_LEAVE": {};
  "FILE.REMOVE": { name: string };
  "VALUE.SET": { value: readonly FileRecord[] | string };
  "VALUE.CLEAR": {};
}

export type FileUploadEvent = EventUnion<FileUploadEvents>;


const config: MachineSpec<FileUploadContext, FileUploadEvents> = {
  id: "file-upload",
  initial: "idle",
  context: {
    acceptedFiles: [] as FileRecord[],
    rejectedFiles: [] as FileRejection[],
    multiple: false,
    directory: false,
    accept: "",
    maxFiles: 0,
    maxSize: 0,
    minSize: 0,
    disabled: false,
  },
  // The value moves live at the root tier so they work from every state:
  // the host's commands and the controlled channel write the selection
  // without knowing whether the dropzone holds focus.
  on: {
    "VALUE.SET": [{ assign: (_ctx, e) => {
      if (e.type !== "VALUE.SET") return {};
      return { acceptedFiles: filesOf(e.value), rejectedFiles: [] };
    } }],
    "VALUE.CLEAR": [{ assign: () => { return ({ acceptedFiles: [], rejectedFiles: [] }); } }],
    "FILE.REMOVE": [{ assign: (ctx, e) => {
      if (e.type !== "FILE.REMOVE") return {};
      return {
        acceptedFiles: ctx.acceptedFiles.filter((file) => file.name !== e.name),
      };
    } }],
  },
  states: {
    idle: {
      on: {
        "INPUT.CHANGE": [{ assign: setFiles }],
        "DROP": [{ target: "idle", assign: addFiles }],
        "DROPZONE.FOCUS": [{ target: "focused" }],
        "DROPZONE.DRAG_OVER": [{ target: "dragging" }],
      },
    },
    focused: {
      on: {
        "DROPZONE.BLUR": [{ target: "idle" }],
        "INPUT.CHANGE": [{ assign: setFiles }],
        "DROP": [{ target: "idle", assign: addFiles }],
        "DROPZONE.DRAG_OVER": [{ target: "dragging" }],
      },
    },
    dragging: {
      on: {
        "DROP": [{ target: "idle", assign: addFiles }],
        "DROPZONE.DRAG_LEAVE": [{ target: "idle" }],
      },
    },
  },
};

/** The accept list as patterns; an empty list accepts everything. */
const patterns = (accept: string): readonly string[] =>
  accept.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);

/** One accepted pattern against one file: an extension or a MIME family. */
function matchesPattern(file: FileRecord, pattern: string): boolean {
  if (pattern.startsWith(".")) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
  const slash = pattern.indexOf("/");
  if (slash === -1) return file.type === pattern;
  const [family, suffix] = [pattern.slice(0, slash), pattern.slice(slash + 1)];
  if (suffix === "*") return file.type.startsWith(`${family}/`);
  return file.type === pattern;
}

export interface SplitResult {
  readonly accepted: readonly FileRecord[];
  readonly rejected: readonly FileRejection[];
}

/**
 * Each file is checked against accept, the size bounds, and the count cap
 * in that order — the first rule that refuses a file is the one reported,
 * so the host's message names one reason.
 */
export function splitFiles(
  files: readonly FileRecord[],
  rules: {
    readonly accept: string;
    readonly maxSize: number;
    readonly minSize: number;
    readonly maxFiles: number;
  },
  alreadyAccepted = 0,
): SplitResult {
  const accepted: FileRecord[] = [];
  const rejected: FileRejection[] = [];
  const list = patterns(rules.accept);
  let count = alreadyAccepted;
  for (const file of files) {
    const code = list.length > 0 && !list.some((pattern) => matchesPattern(file, pattern))
      ? "accept"
      : rules.maxSize > 0 && file.size > rules.maxSize
      ? "too-large"
      : rules.minSize > 0 && file.size < rules.minSize
      ? "too-small"
      : rules.maxFiles > 0 && count >= rules.maxFiles
      ? "too-many"
      : null;
    if (code === null) {
      accepted.push(file);
      count += 1;
    } else {
      rejected.push({ file, code });
    }
  }
  return { accepted, rejected };
}

const implementations = {};

export function fileUpload(
  args: FileUploadArgs = {},
  authored: (name: string) => boolean,
): Machine<FileUploadContext, FileUploadEvents> {
  return createMachine<FileUploadContext, FileUploadEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      multiple: {},
      directory: {},
      accept: {},
      maxFiles: {},
      maxSize: {},
      minSize: {},
      disabled: {},
    },
  });
}
