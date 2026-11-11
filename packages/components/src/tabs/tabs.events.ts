import type { EventUnion } from "@spinjs/components/fsm";

/**
 * The tabs' events, as a MAP: the contract with the outside. The spec's
 * `on` map is typed over it, so a transition's KEY narrows the event it
 * receives — an assign reads its payload with no guard and no cast.
 */
export interface TabsEvents {
  "VALUE.SET": { value: string };
  "TAB.SELECT": { value: string };
}

export type TabsEvent = EventUnion<TabsEvents>;

export type TabsValueChange = {
  readonly value: string;
};
