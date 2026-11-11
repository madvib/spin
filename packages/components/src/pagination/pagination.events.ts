import type { EventUnion } from "@spinjs/components/fsm";

export interface PaginationEvents {
  "SET_PAGE": { page: number };
  "SET_PAGE_SIZE": { pageSize: number };
  "FIRST_PAGE": {};
  "LAST_PAGE": {};
  "PREVIOUS_PAGE": {};
  "NEXT_PAGE": {};
  "SET_COUNT": { count: number };
}

export type PaginationEvent = EventUnion<PaginationEvents>;

export type PaginationPageChange = {
  readonly page: number;
  readonly pageSize: number;
};

export type PaginationPageSizeChange = {
  readonly pageSize: number;
};

export type PaginationPageItem = {
  readonly type: "page";
  readonly value: number;
  readonly key: string;
  readonly label: string;
} | {
  readonly type: "ellipsis";
  readonly index: number;
  readonly key: string;
  readonly label: string;
};
