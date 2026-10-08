import { effect, own } from "../core/signal.ts";
import { scope } from "../core/signal.ts";

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
    next.run(() => {
      rendered = branches[v]!();
    });
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
