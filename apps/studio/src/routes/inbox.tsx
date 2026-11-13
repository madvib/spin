/**
 * Studio Inbox: local annotated UI issues stored in `.spin/issues.json`.
 */
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { spinClient } from "../lib/client.ts";

interface IssueAnnotation {
  readonly selector: string;
  readonly boundingBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly route: string;
  readonly tag: string;
  readonly classes?: string;
  readonly component?: string;
  readonly comment: string;
}

interface IssueItem {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "resolved";
  readonly route: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly annotations: readonly IssueAnnotation[];
}

export default function InboxPage() {
  const [issues, setIssues] = createSignal<readonly IssueItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [filter, setFilter] = createSignal<"open" | "resolved" | "all">("open");

  async function refresh() {
    setLoading(true);
    try {
      const rpc = await spinClient();
      const res = await rpc.issues.list({});
      setIssues(res.issues);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    void refresh();
  });

  const filtered = createMemo(() => {
    const f = filter();
    return f === "all"
      ? issues()
      : issues().filter((item) => item.status === f);
  });

  async function toggleStatus(item: IssueItem) {
    const rpc = await spinClient();
    if (item.status === "open") {
      await rpc.issues.resolve({ id: item.id });
    } else {
      await rpc.issues.reopen({ id: item.id });
    }
    await refresh();
  }

  async function remove(id: string) {
    const rpc = await spinClient();
    await rpc.issues.remove({ id });
    await refresh();
  }

  return (
    <div class="mx-auto flex w-full max-w-screen-lg flex-col gap-6 p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h1>Agent Inbox</h1>
          <p class="text-muted">
            UI annotations captured from the page FAB, stored in <code>.spin/issues.json</code> and readable via <code>spin mcp</code>.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="join">
            <button
              type="button"
              class={`join-item s-sm ${filter() === "open" ? "primary" : "secondary"}`}
              onClick={() => setFilter("open")}
            >
              Open
            </button>
            <button
              type="button"
              class={`join-item s-sm ${filter() === "resolved" ? "primary" : "secondary"}`}
              onClick={() => setFilter("resolved")}
            >
              Resolved
            </button>
            <button
              type="button"
              class={`join-item s-sm ${filter() === "all" ? "primary" : "secondary"}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
          <button
            type="button"
            class="secondary s-sm"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
      </div>

      <Show
        when={!loading()}
        fallback={<p class="text-muted">Loading inbox…</p>}
      >
        <Show
          when={filtered().length > 0}
          fallback={
            <card>
              <card-content class="flex flex-col items-center gap-2 py-10 text-center">
                <span class="i-lucide-inbox icon-lg text-muted" aria-hidden="true" />
                <span class="type-body-emphasized">No {filter() === "all" ? "" : filter() + " "}issues</span>
                <span class="type-caption text-muted">
                  Use the Studio FAB → Annotate page on your running app to capture element feedback for coding agents.
                </span>
              </card-content>
            </card>
          }
        >
          <div class="flex flex-col gap-3">
            <For each={filtered()}>
              {(item) => (
                <card>
                  <card-header class="flex-row items-start justify-between gap-4">
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <card-title>{item.title}</card-title>
                        <badge variant={item.status === "open" ? "warning" : "success"}>
                          {item.status}
                        </badge>
                      </div>
                      <card-description class="flex flex-wrap items-center gap-2">
                        <code>{item.route}</code>
                        <span>·</span>
                        <span>{item.id}</span>
                      </card-description>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        class="secondary s-xs"
                        onClick={() => void toggleStatus(item)}
                      >
                        {item.status === "open" ? "Resolve" : "Reopen"}
                      </button>
                      <button
                        type="button"
                        class="ghost s-xs"
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </card-header>
                  <card-content class="flex flex-col gap-2">
                    <For each={item.annotations}>
                      {(ann) => (
                        <div class="flex flex-col gap-1 rounded-md border bg-surface p-3">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <code>{ann.selector}</code>
                            <span class="type-caption text-muted">
                              {ann.boundingBox.width}×{ann.boundingBox.height} @ ({ann.boundingBox.x}, {ann.boundingBox.y})
                            </span>
                          </div>
                          <p>{ann.comment}</p>
                        </div>
                      )}
                    </For>
                  </card-content>
                </card>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
