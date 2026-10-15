import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoGrid } from "../demo-grid.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import type {
  MenuEntry,
  MenuRow,
} from "../../../src/spin-menu/menu.connect.ts";

/** The element as a host writes it: seeds are plain property writes. */
interface MenuElement extends HTMLElement {
  items?: string;
  label?: string;
}

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

  const [menuEl, setMenu] = createSignal<HTMLElement>();
  const menu = createSpinComponent<MenuCommands>(menuEl);
  createEffect(() => {
    const ctl = menu();
    if (ctl === undefined) return undefined;
    return ctl.bind({}, {
      select: (event: CustomEvent<{ value: string }>) => {
        const value = event.detail.value;
        const row = findRow(ITEMS, value);
        setSelected(row === undefined ? value : row.label);
      },
      "open-change": (event: CustomEvent<{ open: boolean }>) =>
        setOpen(event.detail.open),
      "highlight-change": (
        event: CustomEvent<{ highlightedValue: string | null }>,
      ) => setHighlighted(event.detail.highlightedValue ?? "none"),
    });
  });
;

  return (
    <DemoGrid>
      <DemoCard
        title="Two states, one bridge per level"
        width="md"
        note="Hover-intent, long-press and the close delay are actions on the trigger; a submenu is another instance a parent opens by writing its `open` prop."
      >
        <spin-menu
          ref={(node: HTMLElement) => {
            setMenu(node);
            // Seeds are read during build: they land before connect.
            const host = node as MenuElement;
            host.items = JSON.stringify(ITEMS);
            host.label = "File actions";
          }}
        />
        <DemoControls>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => menu()?.commands.open()}
          >
            el.open()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => menu()?.commands.close()}
          >
            el.close()
          </button>
          <button
            type="button"
            class={DEMO_BUTTON}
            onClick={() => menu()?.commands.setHighlighted("copy")}
          >
            el.setHighlighted("copy")
          </button>
        </DemoControls>
        <DemoReadout>
          <div>
            open: <span id="menu-open">{open() ? "true" : "false"}</span>
          </div>
          <div>
            highlighted: <span id="menu-highlighted">{highlighted()}</span>
          </div>
          <div>
            selected: <span id="menu-selected">{selected()}</span>
          </div>
        </DemoReadout>
      </DemoCard>
    </DemoGrid>
  );
}

/** Walk the item tree for a label, so the status line reads like a host's view. */
function findRow(
  entries: readonly MenuEntry[],
  value: string,
): MenuRow | undefined {
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
