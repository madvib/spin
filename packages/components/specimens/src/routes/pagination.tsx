import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { PaginationPageChange } from "../../../src/spin-pagination/pagination.machine.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";

interface PaginationCommands {
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
}

/**
 * Pagination on the owned machine: one idle state with guarded
 * transitions — out-of-range pages refused, ends clamped, a stranding
 * page-size change resets to one.
 */
export default function Pagination() {
  const [page, setPage] = createSignal("1");

  const [pagesEl, setPages] = createSignal<HTMLElement>();
  const pages = createSpinComponent<PaginationCommands>(pagesEl);
  createEffect(() => {
    const ctl = pages();
    if (ctl === undefined) return undefined;
    return ctl.bind({ count: 95 }, {
      "page-change": (e: CustomEvent<PaginationPageChange>) => setPage(String(e.detail.page)),
    });
  });

  return (
    <DemoGrid>
      <DemoCard
        title="Walk, jump, ends"
        width="md"
        note="Arrows walk, numbers jump, the window shows siblings and ellipses."
      >
        <spin-pagination
          id="pages"
          ref={setPages}
          prop:count={95}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pages()?.commands.setPage(5)}
          >
            el.setPage(5)
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => pages()?.commands.goToLastPage()}
          >
            el.goToLastPage()
          </button>
        </DemoControls>
        <DemoReadout>
          page: {page()}
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}
