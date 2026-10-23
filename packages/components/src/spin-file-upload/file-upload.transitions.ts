import type { AssignFor } from "@spin/runtime/fsm";
import type { FileUploadEvents } from "./file-upload.events.ts";
import type { FileUploadContext } from "./file-upload.state.ts";
import { filesOf, splitFiles } from "./file-upload.state.ts";

type FileUploadAssign<K extends keyof FileUploadEvents = keyof FileUploadEvents> = AssignFor<
  FileUploadContext,
  FileUploadEvents,
  K
>;

export const setFiles: FileUploadAssign<"INPUT.CHANGE"> = (ctx, e) => {
  if (e.type !== "INPUT.CHANGE") return {};
  const split = splitFiles(e.files, ctx);
  return {
    acceptedFiles: ctx.multiple ? [...split.accepted] : split.accepted.slice(0, 1),
    rejectedFiles: [...split.rejected],
  };
};

export const addFiles: FileUploadAssign<"DROP"> = (ctx, e) => {
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

export const setValue: FileUploadAssign<"VALUE.SET"> = (_ctx, e) => {
  if (e.type !== "VALUE.SET") return {};
  return { acceptedFiles: filesOf(e.value), rejectedFiles: [] };
};

export const clearValue = (): Partial<FileUploadContext> => ({ acceptedFiles: [], rejectedFiles: [] });

export const removeFile: FileUploadAssign<"FILE.REMOVE"> = (ctx, e) => {
  if (e.type !== "FILE.REMOVE") return {};
  return {
    acceptedFiles: ctx.acceptedFiles.filter((file) => file.name !== e.name),
  };
};