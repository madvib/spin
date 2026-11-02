import type { EventUnion } from "@spinjs/runtime/fsm";
import type { TocItem, TocRow } from "./toc.state.ts";

export interface TocEvents {
  "ITEMS.SET": { items: readonly TocRow[] };
  "ACTIVE.SET": { activeIds: readonly string[] };
  "ITEM.SELECT": { value: string };
}

export type TocEvent = EventUnion<TocEvents>;

export interface TocActiveChange {
  readonly activeIds: readonly string[];
  readonly activeItems: readonly TocItem[];
  readonly value: string;
}
