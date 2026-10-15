import { effect, own, untrack } from "../core/signal.ts";
import { machineTick } from "../core/signal.ts";
import { scope } from "../core/signal.ts";

export interface RenderedItem {
  nodes: Node[];
  cleanup?: () => void;
  update?: (item: unknown, index: number) => void;
}

export interface BindForOptions<T> {
  anchor: Comment;
  items: () => readonly T[];
  key: (item: T, index: number) => unknown;
  render: (item: T, index: number) => RenderedItem;
}

interface Cell {
  key: unknown;
  item: unknown;
  rendered: RenderedItem;
  nodes: Node[];
  owner: ReturnType<typeof scope>;
}

export function bindFor<T>(opts: BindForOptions<T>): () => void {
  const { anchor, items, key, render } = opts;
  const parent = () => anchor.parentNode;
  let cells: Cell[] = [];
  let index = new Map<unknown, { cells: Cell[]; at: number }>();
  let last: readonly unknown[] | undefined;

  const sync = (list: readonly T[]) => {
    const host = parent();
    if (host === null) return;
    const next: Cell[] = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as T;
      const k = key(item, i);
      const bucket = index.get(k);
      const hit = bucket !== undefined && bucket.at < bucket.cells.length
        ? bucket.cells[bucket.at++]
        : undefined;
      if (hit !== undefined) {
        hit.item = item;
        next[i] = hit;
      } else {
        const owner = scope();
        let rendered!: RenderedItem;
        // Detached: effects created during render must not parent to the
        // re-running sync effect, which would kill them on its next run
        // (alien unlinks dead-parent children). They parent to the cell
        // owner instead and die only on explicit dispose. Reads inside
        // still subscribe normally: each effect tracks itself on first run.
        untrack(() => {
          owner.run(() => {
            rendered = render(item, i);
          });
        });
        const nodes = [...rendered.nodes];
        // New nodes enter before the anchor, not at the host's end: the
        // anchor marks where this list lives among its siblings.
        for (const n of nodes) host.insertBefore(n, anchor);
        const cell: Cell = { key: k, item, rendered, nodes, owner };
        next[i] = cell;
      }
    }

    // Dead cells are collected first and removed after placement: the
    // placement loop moves every node it knows, so removing here would drag
    // the dead nodes back into the list on the next pass.
    const dead: Cell[] = [];
    const keep = new Set<Node>();
    for (const cell of next) for (const n of cell.nodes) keep.add(n);
    for (const cell of cells) {
      let alive = false;
      for (const n of cell.nodes) {
        if (keep.has(n)) {
          alive = true;
          break;
        }
      }
      if (!alive) dead.push(cell);
    }

    // Placement walks backward from the anchor: each cell's nodes land
    // immediately before `cursor`, which starts at the anchor and retreats
    // to each placed cell's first node. Siblings outside the list — before
    // the first cell or after the anchor — are never touched. The old walk
    // started at host.firstChild and dragged every row before any preceding
    // sibling (radio group labels, tab strips ended up after their rows).
    let cursor: Node | null = anchor;
    for (let idx = next.length - 1; idx >= 0; idx--) {
      const cell = next[idx]!;
      if (cell.nodes.length === 0) continue;
      for (let k = cell.nodes.length - 1; k >= 0; k--) {
        const n = cell.nodes[k]!;
        if (n.parentNode !== host) host.insertBefore(n, cursor);
        else if (n.nextSibling !== cursor) host.insertBefore(n, cursor);
      }
      cursor = cell.nodes[0]!;
    }

    for (let i = 0; i < next.length; i++) {
      const cell = next[i]!;
      cell.rendered.update?.(cell.item, i);
    }

    for (const cell of dead) {
      for (const n of cell.nodes) {
        if (n.parentNode === host) host.removeChild(n);
      }
      cell.rendered.cleanup?.();
      cell.owner.dispose();
    }
    cells = next;
    const rebuilt = new Map<unknown, { cells: Cell[]; at: number }>();
    for (const cell of next) {
      const bucket = rebuilt.get(cell.key);
      if (bucket === undefined) rebuilt.set(cell.key, { cells: [cell], at: 0 });
      else bucket.cells.push(cell);
    }
    index = rebuilt;
  };

  effect(() => {
    // machineTick is the machine-move signal the bags read too (see
    // bindSpread); without this read the effect subscribes only through
    // whatever the items thunk touches, and a list that re-derives from
    // a machine move never re-syncs.
    machineTick();
    const v = items();
    if (v !== last) {
      last = v;
      sync(v ?? []);
    }
  });

  const stop = () => {
    for (const cell of cells) {
      cell.rendered.cleanup?.();
      cell.owner.dispose();
    }
    cells = [];
  };
  try {
    own(stop);
  } catch {
    // No scope is active. The caller owns the disposer.
  }
  return stop;
}
