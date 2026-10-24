import type { EventUnion } from "@spinjs/runtime/fsm";
import type { FileRecord, FileRejection } from "./file-upload.state.ts";

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

export type FileUploadValueChange = {
  readonly acceptedFiles: readonly FileRecord[];
  readonly rejectedFiles: readonly FileRejection[];
};
