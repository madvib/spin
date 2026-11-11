import type { EventUnion } from "@spinjs/components/fsm";

export interface AvatarEvents {
  "IMG.LOADED": {};
  "IMG.ERROR": {};
  "IMG.UNMOUNT": {};
  "SRC.CHANGE": { src: string };
  "SET_SRC": { src: string };
}

export type AvatarEvent = EventUnion<AvatarEvents>;

export type AvatarStatus = "loading" | "error" | "loaded";

export type AvatarStatusChange = {
  readonly status: AvatarStatus;
};
