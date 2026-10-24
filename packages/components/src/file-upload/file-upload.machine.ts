/**
 * File-upload machine: the dropzone's modes and the accept/reject split.
 */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type {
  FileUploadArgs,
  FileUploadContext,
  FileUploadState,
} from "./file-upload.state.ts";
import { initial } from "./file-upload.state.ts";
import type { FileUploadEvents } from "./file-upload.events.ts";
import {
  addFiles,
  clearValue,
  removeFile,
  setFiles,
  setValue,
} from "./file-upload.transitions.ts";

export type {
  FileRecord,
  FileRejection,
  FileUploadArgs,
  FileUploadContext,
} from "./file-upload.state.ts";
export type {
  FileUploadEvent,
  FileUploadEvents,
  FileUploadValueChange,
} from "./file-upload.events.ts";
export {
  filesOf,
  initial,
  matchesPattern,
  patterns,
  splitFiles,
} from "./file-upload.state.ts";

export function fileUpload(
  args: FileUploadArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<FileUploadContext, FileUploadEvents, FileUploadState> {
  return createMachine<FileUploadContext, FileUploadEvents, FileUploadState>({
    id: "file-upload",
    initial: "idle",
    context: initial(args, authored),
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
    on: {
      "VALUE.SET": [{ assign: setValue }],
      "VALUE.CLEAR": [{ assign: clearValue }],
      "FILE.REMOVE": [{ assign: removeFile }],
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
  });
}
