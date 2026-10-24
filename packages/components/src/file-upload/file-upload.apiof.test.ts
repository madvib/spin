import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { FileUploadApi } from "./file-upload.presentation.ts";
import type { FileRow } from "./file-upload.presentation.ts";

test("FileUploadApi promises the component's surface", () => {
  const keys: (keyof FileUploadApi)[] = [
    "acceptedFiles",
    "rejectedFiles",
    "focused",
    "dragging",
    "openFilePicker",
    "removeFile",
    "clear",
    "getRootProps",
    "getLabelProps",
    "getDropzoneProps",
    "getHiddenInputProps",
    "getAcceptedRows",
    "getItemGroupProps",
    "getItemProps",
    "getItemNameProps",
    "getItemSizeText",
    "getItemPathText",
    "getItemDeleteTriggerProps",
    "getClearTriggerProps",
  ];
  deepStrictEqual(keys.length, 19);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const openFilePickerTyped: AssertExact<
    FileUploadApi["openFilePicker"],
    () => void
  > = true;
  const removeFileTyped: AssertExact<
    FileUploadApi["removeFile"],
    (name: string) => void
  > = true;
  const getItemPropsTyped: AssertExact<
    FileUploadApi["getItemProps"],
    (row: FileRow) => Record<string, unknown>
  > = true;
  const getItemSizeTextTyped: AssertExact<
    FileUploadApi["getItemSizeText"],
    (row: FileRow) => string
  > = true;
  deepStrictEqual(
    [
      openFilePickerTyped,
      removeFileTyped,
      getItemPropsTyped,
      getItemSizeTextTyped,
    ].every(Boolean),
    true,
  );
});
