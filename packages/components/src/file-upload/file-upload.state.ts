import { coerceJsonArray, defaultTwin, isRecord } from "@spinjs/runtime";

export type FileUploadState = "idle" | "focused" | "dragging";

export interface FileRecord {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly path: string;
}

export interface FileRejection {
  readonly file: FileRecord;
  readonly code: string;
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

export interface FileUploadArgs {
  value?: string | readonly Partial<FileRecord>[];
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
    : (typeof raw === "string" && raw.length > 0
      ? coerceJsonArray(raw, [])
      : []);
  const files: FileRecord[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const name: unknown = entry["name"];
    const size: unknown = entry["size"];
    if (
      typeof name !== "string" || typeof size !== "number" ||
      !Number.isFinite(size)
    ) continue;
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

export function initial(
  args: FileUploadArgs = {},
  authored: (name: string) => boolean,
): FileUploadContext {
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
    accept: written("accept") && typeof args.accept === "string"
      ? args.accept
      : "",
    maxFiles: written("maxFiles") ? count(args.maxFiles) : 0,
    maxSize: written("maxSize") ? count(args.maxSize) : 0,
    minSize: written("minSize") ? count(args.minSize) : 0,
    disabled: written("disabled") ? args.disabled === true : false,
  };
}

/** The accept list as patterns; an empty list accepts everything. */
export const patterns = (accept: string): readonly string[] =>
  accept.split(",").map((entry) => entry.trim()).filter((entry) =>
    entry.length > 0
  );

/** One accepted pattern against one file: an extension or a MIME family. */
export function matchesPattern(file: FileRecord, pattern: string): boolean {
  if (pattern.startsWith(".")) {
    return file.name.toLowerCase().endsWith(pattern.toLowerCase());
  }
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
    const code = list.length > 0 && !list.some((pattern) =>
        matchesPattern(file, pattern)
      )
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
