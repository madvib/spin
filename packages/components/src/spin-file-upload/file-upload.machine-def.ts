import { fileUpload } from "./file-upload.bindings.ts";
import type { FileUploadValueChange } from "./file-upload.bindings.ts";

/**
 * The file-upload's seam: the synthesized bridge, the element's
 * imperative commands, and the CustomEvents the host reads.
 *
 * `value-change` carries `onValueChange` with the accepted records and
 * the rejections (each naming the rule that refused it), which is the
 * only channel the host needs for the selection.
 */

export { fileUpload };
export type { FileUploadValueChange };
