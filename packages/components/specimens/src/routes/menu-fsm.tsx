import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { MenuEntry, MenuRow } from "../../../src/spin-menu/menu.connect.ts";
import type { MenuHighlightChange, MenuOpenChange, MenuSelect } from "../../../src/spin-menu/menu.bridge.ts";

interface MenuCommands {
  open(): void;
  close(): void;
  setHighlighted(value: string | null): void;
}

/** The item tree crosses the property channel as JSON text: the scope grammar
 * has no recursive type, and a submenu is just another `children` list. */
const ITEMS: MenuEntry[] = [
  {
    group: "File",
    items: [
      { value: "new", label: "New file", shortcut: "⌘N" },
      { value: "open", label: "Open…", shortcut: "⌘O" },
      { separator: true },
      {
        value: "share",
        label: "Share",
        children: [
          { value: "mail", label: "Email link", shortcut: "⌘E" },
          { value: "chat", label: "Send to chat" },
          {
            value: "permissions",
            label: "Permissions",
            children: [
              { value: "view", label: "Can view", checked: true },
              { value: "edit", label: "Can edit" },
            ],
          },
        ],
      },
    ],
  },
  {
    group: "Edit",
    items: [
      { value: "cut", label: "Cut", shortcut: "⌘X" },
      { value: "copy", label: "Copy", shortcut: "⌘C" },
      { value: "delete", label: "Delete", disabled: true },
    ],
  },
];

/**
 * Menu on the forked FSM: two states, one bridge per level.
 *
 * The claim under test: Zag's six states exist to hold timers — hover-intent,
 * long-press, the close delay — so they leave as actions on the trigger, and
 * the submenu hierarchy becomes one flat instance per level wired through the
 * element tree (a parent opens a child by writing the child's `open` prop).
 */
export default function MenuFsm() {
  const [selected, setSelected] = createSignal("nothing selected yet");
  const [highlighted, setHighlighted] = createSignal("none");
  const [open, setOpen] = createSignal(false);

  const menu = createSpin<{ items: string; label: string }, MenuCommands>(
    "spin-menu-fsm",
    () => ({ items: JSON.stringify(ITEMS), label: "File actions" }),
    {
      select: (event: CustomEvent<{ value: string }>) => {
        const value = event.detail.value;
        const row = findRow(ITEMS, value);
        setSelected(row === undefined ? value : row.label);
      },
      "open-change": (event: CustomEvent<{ open: boolean }>) => setOpen(event.detail.open),
      "highlight-change": (event: CustomEvent<{ highlightedValue: string | null }>) =>
        setHighlighted(event.detail.highlightedValue ?? "none"),
    },
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Menu — forked FSM</h2>
      <p class="text-muted mb-4">
        Click the trigger, or focus it and press ArrowDown. Arrows move, Home/End jump, typeahead jumps by
        first letter, ArrowRight enters a submenu and ArrowLeft leaves it, Escape closes. Right-click the
        trigger (or long-press it) for a context menu.
      </p>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <spin-menu-fsm ref={menu.ref} />
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => menu.commands().open()}
        >
          el.open()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => menu.commands().close()}
        >
          el.close()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => menu.commands().setHighlighted("copy")}
        >
          el.setHighlighted("copy")
        </button>
      </div>

      <div class="text-sm text-muted font-mono">
        <div>
          open: <span id="menu-open">{open() ? "true" : "false"}</span>
        </div>
        <div>
          highlighted: <span id="menu-highlighted">{highlighted()}</span>
        </div>
        <div>
          selected: <span id="menu-selected">{selected()}</span>
        </div>
      </div>
    </section>
  );
}

/** Walk the item tree for a label, so the status line reads like a host's view. */
function findRow(entries: readonly MenuEntry[], value: string): MenuRow | undefined {
  for (const entry of entries) {
    if ("separator" in entry) continue;
    if ("group" in entry) {
      const nested = findRow(entry.items, value);
      if (nested !== undefined) return nested;
      continue;
    }
    if (entry.value === value) {
      return {
        value: entry.value,
        label: entry.label,
        shortcut: entry.shortcut ?? "",
        disabled: entry.disabled === true,
        checked: entry.checked,
        children: entry.children ?? [],
      };
    }
    if (entry.children !== undefined) {
      const nested = findRow(entry.children, value);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
