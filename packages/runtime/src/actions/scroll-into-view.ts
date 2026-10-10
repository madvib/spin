/**
 * scroll-into-view — bring the active descendant into view when it moves, and
 * scroll the lists home when it goes away.
 *
 * The reflex behind `aria-activedescendant` navigation: a listbox that
 * highlights by moving an id rather than focus gets no browser scrolling for
 * free, so the highlighted row would sit outside a scrolled list. The active
 * id is read through a thunk and the action's `update` runs on every machine
 * move, so a host's `setHighlightValue` scrolls exactly like a keypress does.
 *
 * The two directions are one reflex: a new active id reveals that element
 * (`scrollIntoView` with `block: "nearest"` — the browser's own scroll, no
 * offset arithmetic, and the nearest scrollable ancestor is the one that
 * moves), and the active id going away scrolls the lists back to the top,
 * which is what a panel should show on its next open. A host that scrolls its
 * own content supplies `reveal` and owns the how; the reflex still owns the
 * when.
 */

export interface ScrollIntoViewParam {
  /** The id of the element to reveal; empty when nothing is active. */
  readonly activeId: () => string;
  /** The host's own reveal, replacing the built-in scrollIntoView. */
  readonly reveal?: () => void;
  /** Reveal the item flush with the container's edge instead of nearest. */
  readonly edge?: "start" | "end";
}

export interface ScrollIntoViewResult {
  update?(param: ScrollIntoViewParam | undefined): void;
  destroy?(): void;
}

export type ScrollIntoViewAction = (
  node: Element,
  param: ScrollIntoViewParam | undefined,
) => ScrollIntoViewResult | void;

export const scrollIntoView: ScrollIntoViewAction = (_node, param) => {
  let last: string | undefined;

  const reveal = (next: ScrollIntoViewParam | undefined): void => {
    const id = next?.activeId() ?? "";
    if (id.length === 0) {
      // Nothing is active: the panel closed (or the highlight cleared), which
      // is the moment the lists go home.
      if (last !== undefined) {
        for (const list of _node.querySelectorAll('[role="group"]')) {
          list.scrollTop = 0;
        }
        last = undefined;
      }
      return;
    }
    if (id === last) return;
    last = id;
    if (next?.reveal !== undefined) {
      next.reveal();
      return;
    }
    const target = document.getElementById(id);
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ block: next?.edge ?? "nearest", inline: "nearest" });
  };

  reveal(param);

  return {
    update: (next) => reveal(next),
    destroy: () => {
      last = undefined;
    },
  };
};
