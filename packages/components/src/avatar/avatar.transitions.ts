import type { AssignFor } from "@spinjs/components/fsm";
import type { AvatarEvents } from "./avatar.events.ts";
import type { AvatarContext } from "./avatar.state.ts";

type AvatarAssign<K extends keyof AvatarEvents = keyof AvatarEvents> =
  AssignFor<
    AvatarContext,
    AvatarEvents,
    K
  >;

export const setSrc: AvatarAssign<"SRC.CHANGE" | "SET_SRC"> = (
  _ctx,
  event,
) => ({
  src: event.src,
});
