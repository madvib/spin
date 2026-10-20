import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

import "./spin-file-upload.html";
interface FileUploadCommands {
  openFilePicker(): void;
  removeFile(name: string): void;
  clear(): void;
}

/**
 * File-upload: idle/focused/dragging modes with the accept/size/count
 * validation split. Two entry paths — the picker and a drop — both land
 * in the same machine event.
 */
export default function FileUpload() {
  const [value, setValue] = createSignal("");

  const [uploadEl, setUpload] = createSignal<HTMLElement>();
  const upload = createSpinComponent<FileUploadCommands>(uploadEl);
  createEffect(() => {
    const ctl = upload();
    if (ctl === undefined) return undefined;
    return ctl.bind({ label: "Drop files here", accept: "image/*", multiple: true, maxSize: 1048576 }, {
      "value-change": (e: CustomEvent<{ acceptedFiles: readonly { name: string }[]; rejectedFiles: readonly { file: { name: string }; code: string }[] }>) => {
        const accepted = e.detail.acceptedFiles.map((f) => f.name).join(", ");
        const rejected = e.detail.rejectedFiles.map((r) => `${r.file.name} (${r.code})`).join(", ");
        setValue([accepted, rejected].filter((part) => part.length > 0).join(" — "));
      },
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Validated dropzone"
        width="md"
        note="Accepts images, one per megabyte; a too-large or wrong-type file lands in the rejected readout."
      >
        <spin-file-upload
          id="upload"
          ref={setUpload}
          label="Drop files here"
          accept="image/*"
          multiple="true"
          max-size="1048576"
        />
        <DemoControls>
          <button type="button" class={DEMO_BUTTON} onClick={() => upload()?.commands.openFilePicker()}>
            el.openFilePicker()
          </button>
        </DemoControls>
        <DemoReadout>
          value: <span id="upload-value">{value()}</span>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
