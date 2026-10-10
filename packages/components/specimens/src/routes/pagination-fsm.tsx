import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { PaginationPageChange, PaginationPageSizeChange } from "../../../src/spin-pagination/pagination.bridge.ts";

interface PaginationCommands {
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
}

/** The host's own data, sliced by the api's pageRange rather than by the
 * element: the element renders the controls, never the page's content. */
interface Row {
  readonly id: number;
  readonly label: string;
}

const DATA: Row[] = Array.from({ length: 97 }, (_, index) => ({
  id: index + 1,
  label: `Item ${index + 1}`,
}));

/**
 * Pagination on the forked FSM.
 *
 * The claim under test: Zag's single `idle` state becomes this fork's root
 * tier with six named pure assigns, the page-range algorithm is a pure
 * function of (page, totalPages, siblingCount, boundaryCount) that the
 * connect derives per tick, and the host controls the page through the
 * authored prop exactly as Zag's bindable does.
 */
export default function PaginationFsm() {
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(10);
  const [siblingCount, setSiblingCount] = createSignal(1);
  const [boundaryCount, setBoundaryCount] = createSignal(1);
  const [readout, setReadout] = createSignal("page 1");

  const controlled = createSpin<
    {
      count: number;
      page: number;
      pageSize: number;
      siblingCount: number;
      boundaryCount: number;
    },
    PaginationCommands
  >(
    "spin-pagination-fsm",
    () => ({
      count: DATA.length,
      page: page(),
      pageSize: pageSize(),
      siblingCount: siblingCount(),
      boundaryCount: boundaryCount(),
    }),
    {
      "page-change": (event: CustomEvent<PaginationPageChange>) => {
        setPage(event.detail.page);
        setReadout(`page ${event.detail.page} of ${Math.ceil(DATA.length / event.detail.pageSize)}`);
      },
      "page-size-change": (event: CustomEvent<PaginationPageSizeChange>) => {
        setPageSize(event.detail.pageSize);
        setReadout(`page size ${event.detail.pageSize}`);
      },
    },
  );

  const uncontrolled = createSpin<
    { count: number; defaultPage: number; siblingCount: number },
    PaginationCommands
  >(
    "spin-pagination-fsm",
    () => ({ count: DATA.length, defaultPage: 12, siblingCount: 1 }),
    {
      "page-change": (event: CustomEvent<PaginationPageChange>) => setReadout(`uncontrolled page ${event.detail.page}`),
    },
  );

  const noSize = createSpin<{ count: number; defaultPage: number }, PaginationCommands>(
    "spin-pagination-fsm",
    () => ({ count: 4, defaultPage: 1 }),
  );

  const button =
    "rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors hover:bg-surface";

  const rows = DATA.slice((page() - 1) * pageSize(), page() * pageSize());

  return (
    <section>
      <h2 class="text-xl mb-1">Pagination — forked FSM</h2>
      <p class="text-muted mb-4">
        Click a page number, or use first/prev/next/last. The first and last triggers disable at the
        edges; a page-size change that pushes the page out of range resets it to 1, which is Zag's
        watch on <code>pageSize</code>. The controlled instance drives its page from the host's signal.
      </p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div class="space-y-6">
          <div>
            <h3 class="mb-2 text-sm font-medium text-text">Controlled page</h3>
            <spin-pagination-fsm
              id="controlled"
              ref={controlled.ref}
              prop:count={DATA.length}
              prop:page={page()}
              prop:pageSize={pageSize()}
              prop:siblingCount={siblingCount()}
              prop:boundaryCount={boundaryCount()}
            />
          </div>
          <div>
            <h3 class="mb-2 text-sm font-medium text-text">Uncontrolled, starting at page 12</h3>
            <spin-pagination-fsm id="uncontrolled" ref={uncontrolled.ref} prop:count={DATA.length} prop:defaultPage={12} />
          </div>
          <div>
            <h3 class="mb-2 text-sm font-medium text-text">Four items, one page</h3>
            <spin-pagination-fsm id="single" ref={noSize.ref} prop:count={4} prop:defaultPage={1} />
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-lg border border-border bg-surface-raised p-3">
            <h3 class="mb-2 text-sm font-medium text-text">Page {page()} · {pageSize()} per page</h3>
            <ul class="max-h-40 overflow-y-auto text-xs text-muted tabular-nums">
              {rows.map((row) => (
                <li class="py-0.5">{row.label}</li>
              ))}
            </ul>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-muted">
              page size
              <select
                class="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
                value={String(pageSize())}
                onChange={(event) => controlled.commands().setPageSize(Number(event.currentTarget.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-xs text-muted">
              siblings
              <select
                class="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
                value={String(siblingCount())}
                onChange={(event) => setSiblingCount(Number(event.currentTarget.value))}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-xs text-muted">
              boundary
              <select
                class="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
                value={String(boundaryCount())}
                onChange={(event) => {
                  setBoundaryCount(Number(event.currentTarget.value));
                }}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class={button}
              onClick={() => controlled.commands().goToFirstPage()}
            >
              el.goToFirstPage()
            </button>
            <button type="button" class={button} onClick={() => controlled.commands().goToPrevPage()}>
              el.goToPrevPage()
            </button>
            <button type="button" class={button} onClick={() => controlled.commands().goToNextPage()}>
              el.goToNextPage()
            </button>
            <button type="button" class={button} onClick={() => controlled.commands().goToLastPage()}>
              el.goToLastPage()
            </button>
            <button type="button" class={button} onClick={() => controlled.commands().setPage(5)}>
              el.setPage(5)
            </button>
          </div>

          <div class="text-sm text-muted font-mono tabular-nums">
            readout: <span id="pagination-readout">{readout()}</span> · total pages:{" "}
            <span id="pagination-total">{Math.ceil(DATA.length / pageSize())}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
