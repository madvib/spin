// The route's own element, registered here rather than through the library's
// aggregate import: the route is what this specimen shows, and the import is
// what makes it render.
import "../../../src/spin-avatar/spin-avatar-fsm.html";
import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

/** The element's host surface, from its machine-def's commands. */
interface AvatarCommands {
  setSrc: (src: string) => void;
  setLoaded: () => void;
  setError: () => void;
}

/** A tiny inline bitmap: the load path has to run offline, in a build that
 * serves no image assets. */
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%234f46e5'/%3E%3C/svg%3E";

/** A source the preview server answers 404 for, so the error path runs. */
const MISSING = "/avatar-missing.png";

/**
 * Avatar on the forked FSM: three states, one bridge.
 *
 * The claim under test: the image's load status is the browser's, so the
 * machine has no context and no controlled channel — the element listens
 * for the image's own load/error, reads the status an already-settled
 * image never reports again, watches the src attribute and the image node
 * itself, and hands the host `setSrc`/`setLoaded`/`setError` plus one
 * `status-change` event.
 */
export default function AvatarFsm() {
  const [status, setStatus] = createSignal("loading");

  // The imperative instance: no props (the two demos below are declarative),
  // commands only. `ref` is bound further down on the third instance.
  const avatar = createSpin<Record<string, never>, AvatarCommands>("spin-avatar-fsm", () => ({}), {
    "status-change": (event: CustomEvent<{ status: string }>) => setStatus(event.detail.status),
  });

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";

  return (
    <section>
      <h2 class="text-xl mb-1">Avatar — forked FSM</h2>
      <p class="text-muted mb-4">
        A source that resolves shows the image; one that 404s (or a node removed from the root) shows the
        name-initials fallback. Reloading with a new source starts over: change the source with{" "}
        <code>el.setSrc()</code>, or settle it by hand with <code>el.setLoaded()</code> /{" "}
        <code>el.setError()</code>.
      </p>

      <div class="flex flex-wrap items-start gap-6 mb-6">
        <div class="flex flex-col items-center gap-2">
          <spin-avatar-fsm id="avatar-good" src={PHOTO} alt="Ada Lovelace" name="Ada Lovelace" />
          <span class="text-xs text-muted">resolving source</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <spin-avatar-fsm id="avatar-broken" src={MISSING} alt="Grace Hopper" name="Grace Hopper" />
          <span class="text-xs text-muted">404 source</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <spin-avatar-fsm ref={avatar.ref} id="avatar-commands" name="Grace Hopper" />
          <span class="text-xs text-muted">
            status: <span id="avatar-status">{status()}</span>
          </span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class={button} onClick={() => avatar.commands().setSrc(PHOTO)}>
          el.setSrc(photo)
        </button>
        <button type="button" class={button} onClick={() => avatar.commands().setLoaded()}>
          el.setLoaded()
        </button>
        <button type="button" class={button} onClick={() => avatar.commands().setError()}>
          el.setError()
        </button>
        <button
          type="button"
          class={button}
          onClick={() => {
            (document.getElementById("avatar-commands") as HTMLElement | null)?.setAttribute("src", MISSING);
          }}
        >
          host writes a 404 source
        </button>
      </div>
    </section>
  );
}
