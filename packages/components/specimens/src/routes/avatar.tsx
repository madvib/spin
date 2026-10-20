import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { AvatarStatusChange } from "../../../src/spin-avatar/avatar.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-avatar.html";

interface AvatarCommands {
  setSrc: (src: string) => void;
  setLoaded: () => void;
  setError: () => void;
}

/** A data-URL portrait: a real image the avatar can load, with no network
 * behind it. */
const PORTRAIT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#0ea5e9"/><circle cx="40" cy="30" r="14" fill="#f8fafc"/><rect x="18" y="48" width="44" height="22" rx="11" fill="#f8fafc"/></svg>`,
  );

/**
 * Avatar on the owned machine: loading, error, loaded — with the fallback
 * showing until the image reports in, and kept on error.
 */
export default function Avatar() {
  const [status, setStatus] = createSignal("loading");

  const [userEl, setUser] = createSignal<HTMLElement>();
  const user = createSpinComponent<AvatarCommands>(userEl);
  createEffect(() => {
    const ctl = user();
    if (ctl === undefined) return undefined;
    return ctl.bind({ src: PORTRAIT, label: "Ada", fallback: "A" }, {
      "status-change": (e: CustomEvent<AvatarStatusChange>) => setStatus(e.detail.status),
    });
  });

  const [brokenEl, setBroken] = createSignal<HTMLElement>();
  const broken = createSpinComponent<AvatarCommands>(brokenEl);
  createEffect(() => {
    const ctl = broken();
    if (ctl === undefined) return undefined;
    return ctl.bind({ src: "https://invalid.example/broken.png", label: "Bo", fallback: "B" }, undefined);
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Load, error, commands"
        width="sm"
        note="The portrait loads and the fallback yields; the broken src keeps its fallback."
      >
        <div class="flex items-center gap-3">
          <spin-avatar
            id="user"
            ref={setUser}
            prop:src={PORTRAIT}
            prop:label="Ada"
            prop:fallback="A"
          />
          <spin-avatar
            id="broken"
            ref={setBroken}
            prop:src="https://invalid.example/broken.png"
            prop:label="Bo"
            prop:fallback="B"
          />
        </div>
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => user()?.commands.setError()}
          >
            el.setError()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => user()?.commands.setLoaded()}
          >
            el.setLoaded()
          </button>
        </DemoControls>
        <DemoReadout>
          status: {status()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
