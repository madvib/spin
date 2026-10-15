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

export interface FileRecord {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export interface FileUploadContext {
  /** Files that passed validation, in the order they arrived. */
  acceptedFiles: FileRecord[];
  /** Files that failed, each with the rule that refused it. */
  rejectedFiles: FileRejection[];
  /** The scalars the assigns read, synced from scope by the bridge. */
  multiple: boolean;
  /** A comma-joined accept list (`.png,image/*`); empty accepts all. */
  accept: string;
  /** The most files a selection may hold; 0 is unbounded. */
  maxFiles: number;
  /** Size bounds in bytes; 0 is unbounded on that side. */
  maxSize: number;
  minSize: number;
  disabled: boolean;
}

export interface FileRejection {
  readonly file: FileRecord;
  /** The rule that refused it: `accept`, `too-large`, `too-small`, `too-many`. */
  readonly code: string;
}

export interface FileUploadValueChange {
  readonly acceptedFiles: readonly FileRecord[];
  readonly rejectedFiles: readonly FileRejection[];
}

export type FileUploadEvent =
  | { type: "INPUT.CHANGE"; files: readonly FileRecord[] }
  | { type: "DROP"; files: readonly FileRecord[] }
  | { type: "DROPZONE.FOCUS" }
  | { type: "DROPZONE.BLUR" }
  | { type: "DROPZONE.DRAG_OVER" }
  | { type: "DROPZONE.DRAG_LEAVE" }
  | { type: "FILE.REMOVE"; name: string }
  | { type: "VALUE.SET"; files: readonly FileRecord[] }
  | { type: "VALUE.CLEAR" };

export const config = {
  id: "file-upload",
  initial: "idle",
  context: {
    acceptedFiles: [] as FileRecord[],
    rejectedFiles: [] as FileRejection[],
    multiple: false,
    accept: "",
    maxFiles: 0,
    maxSize: 0,
    minSize: 0,
    disabled: false,
  },
  // Root tier: the value moves work from every state, which is what lets
  // the host's commands and the controlled channel write the selection
  // without knowing whether the dropzone holds focus.
  on: {
    "VALUE.SET": [{ actions: [{ assign: "setValue" }] }],
    "VALUE.CLEAR": [{ actions: [{ assign: "clearValue" }] }],
    "FILE.REMOVE": [{ actions: [{ assign: "removeFile" }] }],
  },
  states: {
    idle: {
      on: {
        "INPUT.CHANGE": [{ actions: [{ assign: "setFiles" }] }],
        "DROP": [{ target: "idle", actions: [{ assign: "addFiles" }] }],
        "DROPZONE.FOCUS": [{ target: "focused" }],
        "DROPZONE.DRAG_OVER": [{ target: "dragging" }],
      },
    },
    focused: {
      on: {
        "DROPZONE.BLUR": [{ target: "idle" }],
        "INPUT.CHANGE": [{ actions: [{ assign: "setFiles" }] }],
        "DROP": [{ target: "idle", actions: [{ assign: "addFiles" }] }],
        "DROPZONE.DRAG_OVER": [{ target: "dragging" }],
      },
    },
    dragging: {
      on: {
        "DROP": [{ target: "idle", actions: [{ assign: "addFiles" }] }],
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
 * The validation split: each file is checked against accept, the size
 * bounds, and the count cap in that order — the first rule that refuses a
 * file is the one reported, so the host's message names one reason.
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

export const implementations = {
  conds: {},
  assigns: {
    setFiles: (ctx: FileUploadContext, e: FileUploadEvent): Partial<FileUploadContext> => {
      if (e.type !== "INPUT.CHANGE") return {};
      const split = splitFiles(e.files, ctx);
      return {
        acceptedFiles: ctx.multiple ? [...split.accepted] : split.accepted.slice(0, 1),
        rejectedFiles: [...split.rejected],
      };
    },
    /** A drop appends to the selection (multiple) or replaces it. */
    addFiles: (ctx: FileUploadContext, e: FileUploadEvent): Partial<FileUploadContext> => {
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
    },
    removeFile: (ctx: FileUploadContext, e: FileUploadEvent): Partial<FileUploadContext> => {
      if (e.type !== "FILE.REMOVE") return {};
      return {
        acceptedFiles: ctx.acceptedFiles.filter((file) => file.name !== e.name),
      };
    },
    setValue: (_ctx: FileUploadContext, e: FileUploadEvent): Partial<FileUploadContext> => {
      if (e.type !== "VALUE.SET") return {};
      return { acceptedFiles: [...e.files], rejectedFiles: [] };
    },
    clearValue: (): Partial<FileUploadContext> => ({ acceptedFiles: [], rejectedFiles: [] }),
  },
};
