import { effect, own, scope, untrack } from "../core/signal.ts";

export interface BranchRender {
  nodes: Node[];
  cleanup?: () => void;
}

export interface BindIfOptions {
  anchor: Comment;
  test: () => number;
  branches: Array<() => BranchRender>;
}

export function bindIf(opts: BindIfOptions): () => void {
  const { anchor, test, branches } = opts;
  let nodes: Node[] = [];
  let cleanup: (() => void) | undefined;
  let owner: ReturnType<typeof scope> | undefined;
  let last: number | undefined;

  const teardown = () => {
    cleanup?.();
    cleanup = undefined;
    owner?.dispose();
    owner = undefined;
    const host = anchor.parentNode;
    if (host !== null) {
      for (const n of nodes) {
        if (n.parentNode === host) host.removeChild(n);
      }
    }
    nodes = [];
  };

  effect(() => {
    const v = test();
    if (v === last) return;
    last = v;
    teardown();
    if (v < 0 || v >= branches.length) return;
    const next = scope();
    owner = next;
    let rendered!: BranchRender;
    // Untracked: content rendered inside the test effect would link as its
    // child, and alien-signals then gates the content's own tick
    // subscriptions on the parent — in-branch text froze while top-level
    // text moved. The branch owns its effects; the test owns the flip.
    next.run(() =>
      untrack(() => {
        rendered = branches[v]!();
      })
    );
    cleanup = rendered.cleanup;
    nodes = rendered.nodes;
    const host = anchor.parentNode;
    if (host !== null) {
      for (const n of nodes) host.insertBefore(n, anchor);
    }
  });

  const stop = () => teardown();
  try {
    own(stop);
  } catch {
    // No scope is active. The caller owns the disposer.
  }
  return stop;
}
