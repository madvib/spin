import type { MachineDef } from "@spin/runtime";
import { createFileUploadBridge } from "./file-upload.bridge.ts";
import type { FileUploadValueChange } from "./file-upload.machine.ts";

/**
 * The file-upload's seam: the bridge, the element's imperative commands,
 * and the CustomEvents the host reads.
 *
 * `value-change` carries `onValueChange` with the accepted records and
 * the rejections (each naming the rule that refused it), which is the
 * only channel the host needs for the selection.
 */

export type { FileUploadValueChange };

export const fileUpload: MachineDef = {
  createBridge: createFileUploadBridge,
  commands: ["openFilePicker", "removeFile", "clear"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: FileUploadValueChange) => ({
        acceptedFiles: change.acceptedFiles,
        rejectedFiles: change.rejectedFiles,
      }),
    },
  },
};
