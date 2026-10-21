/**
 * The console: an application, not a specimen.
 *
 * Everything here is what the rest of the docs documents — utilities on the
 * markup, primitives for the parts that carry behavior (card, alert, badge,
 * table, avatar), lucide icons through the preset's composed icon preset.
 * Two signals make it behave like software: the status chips filter the rows
 * and the search narrows them, because a table that doesn't respond reads as
 * a picture of an application.
 */
import { createMemo, createSignal, For } from "solid-js";
import type { JSX } from "solid-js";
import { Logo } from "@spin/kit";

type Status = "paid" | "shipped" | "pending" | "failed" | "refunded";

interface Order {
  readonly id: string;
  readonly who: string;
  readonly city: string;
  readonly face: string;
  readonly status: Status;
  readonly items: number;
  readonly total: string;
  readonly when: string;
}

const face = (seed: string): string => `https://i.pravatar.cc/64?u=${seed}`;

const ORDERS: readonly Order[] = [
  {
    id: "#4127",
    who: "Ada Lovelace",
    city: "Lisbon",
    face: face("ada-lisbon"),
    status: "paid",
    items: 3,
    total: "$128.40",
    when: "12 min ago",
  },
  {
    id: "#4126",
    who: "Grace Hopper",
    city: "Arlington",
    face: face("grace-arlington"),
    status: "shipped",
    items: 1,
    total: "$42.00",
    when: "41 min ago",
  },
  {
    id: "#4125",
    who: "Alan Turing",
    city: "Wilmslow",
    face: face("alan-wilmslow"),
    status: "pending",
    items: 5,
    total: "$310.75",
    when: "1 h ago",
  },
  {
    id: "#4124",
    who: "Katherine Johnson",
    city: "Hampton",
    face: face("katherine-hampton"),
    status: "paid",
    items: 2,
    total: "$86.20",
    when: "2 h ago",
  },
  {
    id: "#4123",
    who: "Linus Torvalds",
    city: "Helsinki",
    face: face("linus-helsinki"),
    status: "failed",
    items: 1,
    total: "$19.99",
    when: "3 h ago",
  },
  {
    id: "#4122",
    who: "Margaret Hamilton",
    city: "Cambridge",
    face: face("margaret-cambridge"),
    status: "shipped",
    items: 4,
    total: "$204.10",
    when: "5 h ago",
  },
  {
    id: "#4121",
    who: "Dennis Ritchie",
    city: "Murray Hill",
    face: face("dennis-murrayhill"),
    status: "refunded",
    items: 2,
    total: "$57.30",
    when: "yesterday",
  },
  {
    id: "#4120",
    who: "Barbara Liskov",
    city: "Cambridge",
    face: face("barbara-cambridge"),
    status: "paid",
    items: 6,
    total: "$412.60",
    when: "yesterday",
  },
  {
    id: "#4119",
    who: "Ken Thompson",
    city: "Berkeley",
    face: face("ken-berkeley"),
    status: "pending",
    items: 2,
    total: "$74.80",
    when: "Oct 14",
  },
  {
    id: "#4118",
    who: "Radia Perlman",
    city: "Salem",
    face: face("radia-salem"),
    status: "paid",
    items: 1,
    total: "$23.50",
    when: "Oct 14",
  },
];

/** Status → badge tone. The class strings are literal so the scanner sees them. */
const TONE: Record<Status, string> = {
  paid: "badge-success",
  shipped: "badge-primary",
  pending: "badge-warning",
  failed: "badge-danger",
  refunded: "badge-neutral",
};

/** Which chip a status sits behind. */
const GROUP: Record<Status, string> = {
  paid: "active",
  shipped: "active",
  pending: "review",
  failed: "review",
  refunded: "refunded",
};

const NAV = [
  { label: "Overview", icon: "i-lucide-layout-dashboard" },
  { label: "Orders", icon: "i-lucide-shopping-cart", count: "42" },
  { label: "Inventory", icon: "i-lucide-package", count: "8" },
  { label: "Customers", icon: "i-lucide-users" },
  { label: "Reports", icon: "i-lucide-trending-up" },
  { label: "Settings", icon: "i-lucide-settings" },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "review", label: "Review" },
  { id: "refunded", label: "Refunded" },
];

const STATS = [
  {
    title: "Revenue",
    value: "$48,290",
    tone: "badge-success",
    delta: "+12%",
    note: "vs. last week",
  },
  {
    title: "Orders",
    value: "1,204",
    tone: "badge-success",
    delta: "+8%",
    note: "vs. last week",
  },
  {
    title: "Avg. delivery",
    value: "1.8 days",
    tone: "badge-neutral",
    delta: "steady",
    note: "vs. last week",
  },
  {
    title: "On hold",
    value: "3",
    tone: "badge-danger",
    delta: "+2",
    note: "needs review",
  },
];

export function Console(): JSX.Element {
  const [section, setSection] = createSignal("Orders");
  const [filter, setFilter] = createSignal("all");
  const [query, setQuery] = createSignal("");

  const rows = createMemo(() => {
    const byStatus = filter();
    const q = query().trim().toLowerCase();
    return ORDERS.filter((order) =>
      (byStatus === "all" || GROUP[order.status] === byStatus) &&
      (q.length === 0 ||
        `${order.id} ${order.who} ${order.city}`.toLowerCase().includes(q))
    );
  });

  return (
    <div class="grid overflow-hidden rounded-md border border-border bg-surface shadow-sm md:grid-cols-4">
      <aside class="flex flex-col gap-1 border-b border-border bg-surface-raised p-3 md:col-span-1 md:border-b-0 md:border-r">
        <div class="flex items-center gap-2 px-2 pt-1 pb-4">
          <Logo size="sm" class="text-text" />
          <span class="text-sm text-text-muted">console</span>
        </div>

        <nav class="flex flex-col gap-1" aria-label="Console sections">
          <For each={NAV}>
            {(item) => (
              <a
                href="#console"
                aria-current={section() === item.label ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  setSection(item.label);
                }}
                class={`no-underline flex items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors duration-fast ${
                  section() === item.label
                    ? "bg-surface text-text font-semibold"
                    : "text-text-muted hover:bg-surface hover:text-text"
                }`}
              >
                <i class={`${item.icon} icon-sm`} aria-hidden="true" />
                {item.label}
                {item.count !== undefined && (
                  <badge class="badge-neutral badge-sm ml-auto">
                    {item.count}
                  </badge>
                )}
              </a>
            )}
          </For>
        </nav>

        <div class="mt-auto flex items-center gap-2 border-t border-border px-2 pt-3">
          <img
            class="avatar avatar-sm avatar-circle"
            src={face("mara-vidal")}
            alt=""
            width="24"
            height="24"
            loading="lazy"
          />
          <div class="min-w-0">
            <div class="truncate text-sm">Mara Vidal</div>
            <div class="truncate text-xs text-text-muted">Store manager</div>
          </div>
          <button
            type="button"
            class="icon ghost ml-auto"
            aria-label="Account menu"
          >
            <i
              class="i-lucide-ellipsis button-icon icon-sm"
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>

      <div class="min-w-0 md:col-span-3">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 class="m-0 text-lg">Orders</h2>
            <p class="m-0 text-xs text-text-muted">
              42 total · updated 2 min ago
            </p>
          </div>
          <div class="flex flex-1 items-center justify-end gap-3">
            <div class="flex items-center gap-2">
              <input
                type="search"
                placeholder="Search orders…"
                aria-label="Search orders"
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <span class="hidden items-center gap-1 text-text-muted md:flex">
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </span>
            </div>
            <button type="button">
              <i class="i-lucide-plus button-icon icon-sm" aria-hidden="true" />
              New order
            </button>
          </div>
        </header>

        <div class="flex flex-col gap-4 p-4">
          <alert role="alert" class="alert-warning-muted">
            <strong>3 orders are on hold</strong>
            <p>Two payments declined, one is missing a street address.</p>
          </alert>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <For each={STATS}>
              {(stat) => (
                <card class="p-4">
                  <div class="stat">
                    <div class="stat-title">{stat.title}</div>
                    <div class="stat-value">{stat.value}</div>
                    <div class="stat-desc">
                      <badge class={stat.tone}>{stat.delta}</badge> {stat.note}
                    </div>
                  </div>
                </card>
              )}
            </For>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-1">
              <For each={FILTERS}>
                {(option) => (
                  <button
                    type="button"
                    aria-pressed={filter() === option.id}
                    onClick={() => setFilter(option.id)}
                    class={filter() === option.id
                      ? "s-sm secondary"
                      : "s-sm ghost"}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="s-sm ghost">
                <i
                  class="i-lucide-download button-icon icon-sm"
                  aria-hidden="true"
                />
                Export CSV
              </button>
              <button type="button" class="icon ghost" aria-label="Columns">
                <i
                  class="i-lucide-sliders-horizontal button-icon icon-sm"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div class="overflow-auto">
            <table class="w-full">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Items</th>
                  <th scope="col">Total</th>
                  <th scope="col">Placed</th>
                  <th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                <For each={rows()}>
                  {(order) => (
                    <tr class="hover:bg-surface-raised">
                      <td>
                        <span class="font-mono text-sm">{order.id}</span>
                      </td>
                      <td>
                        <div class="flex items-center gap-2">
                          <img
                            class="avatar avatar-sm avatar-circle"
                            src={order.face}
                            alt=""
                            width="24"
                            height="24"
                            loading="lazy"
                          />
                          <div class="min-w-0">
                            <div class="text-sm">{order.who}</div>
                            <div class="text-xs text-text-muted">
                              {order.city}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <badge class={TONE[order.status]}>
                          {order.status}
                        </badge>
                      </td>
                      <td>{order.items}</td>
                      <td>{order.total}</td>
                      <td class="text-text-muted">{order.when}</td>
                      <td class="text-right">
                        <button
                          type="button"
                          class="icon ghost"
                          aria-label={`Actions for ${order.id}`}
                        >
                          <i
                            class="i-lucide-ellipsis button-icon icon-sm"
                            aria-hidden="true"
                          />
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
                {rows().length === 0 && (
                  <tr>
                    <td colspan="7" class="text-center text-text-muted">
                      No orders match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-text-muted">
            <span>{rows().length} of {ORDERS.length} rows · 42 total</span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="icon s-sm ghost"
                aria-label="Previous page"
                disabled
              >
                <i
                  class="i-lucide-chevron-left button-icon icon-sm"
                  aria-hidden="true"
                />
              </button>
              <span class="px-2">Page 1 of 5</span>
              <button
                type="button"
                class="icon s-sm ghost"
                aria-label="Next page"
              >
                <i
                  class="i-lucide-chevron-right button-icon icon-sm"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
