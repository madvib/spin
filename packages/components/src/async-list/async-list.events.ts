import type { EventUnion } from "@spinjs/components/fsm";
import type { SortDescriptor } from "./async-list.state.ts";

export interface AsyncListEvents {
  "RELOAD": {};
  "LOAD_MORE": {};
  "SORT": { sortDescriptor: SortDescriptor };
  "FILTER": { filterText: string };
  "SUCCESS": { items: readonly unknown[]; cursor: unknown; append: boolean };
  "ERROR": { error: unknown };
  "ABORT": {};
}

export type AsyncListEvent = EventUnion<AsyncListEvents>;
