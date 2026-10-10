/**
 * Menu connect: the DOM contract plus the view-owned navigation.
 *
 * What the machine owns is left there: open/closed, the highlighted item, the
 * anchor point, which submenu is open on this level. Everything the rest of
 * the page can see lives here — the keyboard contract (arrows, Home/End,
 * Enter, ArrowLeft/Right across a level, typeahead), the reflexes attached as
 * stdlib actions (`dismissable`, `hover-intent`, `long-press`) and the
 * submenu-level protocol.
 *
 * A submenu level is its own bridge instance; levels meet through the element
 * tree. A parent writes the child instance's `open` attribute — the controlled
 * channel, exactly the path a host's own write takes — and the child reports a
 * close back up as a bubbling `submenuclose` event so the parent clears the
 * `openSubmenu` context that drove it. That recursion, not nested states, is
 * what lets one flat config cover a menu of any depth.
 *
 * Two contracts the api's shape depends on:
 *
 * - Part ids are `menu:<element id>:<part>`. The element id a submenu level is
 *   handed is the parent's part id for it (`menu:<root>:submenu:<value>`),
 *   which is already namespaced, so it is used verbatim rather than
 *   namespaced twice — that is what makes `aria-controls` and the focus call in
 *   `openSubmenu` resolve to the nested level's content.
 *
 * - The api is read on every machine move, because a binding that reads
 *   machine state through it subscribes to the bridge's tick. So the data it
 *   returns is stable across moves: `getBlocks` is memoized on the item tree's
 *   identity, and every prop bag is cached against the signature of the
 *   context fields it reads. A fresh list per read would have the `for`
 *   directive replace the row nodes on each highlight move, detaching them
 *   from any gesture in flight and orphaning the reflexes those nodes hold
 *   (a hover-intent timer whose row was thrown away outlives the menu and
 *   re-opens a submenu on the next one).
 */

export interface MenuItemData {
  readonly value: string;
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly checked?: boolean | undefined;
  readonly children?: readonly MenuEntry[] | undefined;
}

export interface MenuSeparatorData {
  readonly separator: true;
}

export interface MenuGroupData {
  readonly group: string;
  readonly items: readonly MenuEntry[];
}

export type MenuEntry = MenuItemData | MenuSeparatorData | MenuGroupData;

export interface MenuRow {
  readonly value: string;
  readonly label: string;
  readonly shortcut: string;
  readonly disabled: boolean;
  /** Undefined for a plain item; a defined value makes it a checkable item. */
  readonly checked: boolean | undefined;
  readonly children: readonly MenuEntry[];
}

export interface MenuBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly MenuRow[];
  /** A hairline separator renders after this block. */
  readonly separator: boolean;
}

export interface MenuFsmConnectProps {
  readonly closeOnSelect: boolean;
  readonly loopFocus: boolean;
  readonly composite: boolean;
  readonly typeahead: boolean;
  readonly placement: string;
  readonly isSubmenu: boolean;
  readonly label: string;
  /** Host hook for items rendered as links, faithful to Zag's navigate. */
  readonly navigate?: ((details: { value: string; node: Element; href: string }) => void) | undefined;
}

export interface MenuFsmApi {
  readonly isOpen: boolean;
  readonly highlightedValue: string | null;
  getBlocks(): readonly MenuBlock[];
  getRows(block: MenuBlock): readonly MenuRow[];
  getTriggerProps(): Record<string, unknown>;
  getContextTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getItemGroupProps(block: MenuBlock): Record<string, unknown>;
  getItemGroupLabelProps(block: MenuBlock): Record<string, unknown>;
  getItemProps(row: MenuRow): Record<string, unknown>;
  getItemTextProps(row: MenuRow): Record<string, unknown>;
  getItemIndicatorProps(row: MenuRow): Record<string, unknown>;
  getItemShortcutProps(row: MenuRow): Record<string, unknown>;
  getItemSubmenuIndicatorProps(row: MenuRow): Record<string, unknown>;
  getSeparatorProps(block: MenuBlock): Record<string, unknown>;
  /** The bag the parent level spreads onto this instance's element. */
  getSubmenuProps(row: MenuRow): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. A submenu level's element id is the parent's part id
 * for it — `menu:<root>:submenu:<value>` — so it is already namespaced. */
const NAMESPACE = "menu";

export interface MenuService {
  readonly context: {
    highlightedValue: string | null;
    openSubmenu: string | null;
    anchorPoint: { x: number; y: number } | null;
    isSubmenu: boolean;
  };
  readonly open: boolean;
  send(event: { type: string } & Record<string, unknown>): void;
}

/**
 * The behavioural props, read on demand.
 *
 * The bridge keeps one connect for the element's whole life — rebuilding it per
 * machine move is what used to make every read allocate a fresh item tree — so
 * a snapshot would freeze the first read's props inside the handlers the
 * connect caches. Read live instead: a host write then reaches a gesture armed
 * before it.
 */
export type ReadMenuProps = () => MenuFsmConnectProps;

/** Typeahead state outlives the connect: the bridge's api proxy rebuilds the
 * connect on every machine move, and a fresh buffer would erase the sequence. */
export interface TypeaheadState {
  keys: string;
  at: number;
}

/** A cached bag plus what it read. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/**
 * A bag cached until the signature of the fields it reads moves.
 *
 * A binding re-reads the bag on every machine move, so a fresh bag per read
 * would have it detach and re-attach every listener each move. The signature
 * enumerates the context and prop fields the bag reads: only one of those
 * moving rebuilds it.
 */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: rows and blocks are stable objects, so the memo dies
 * with the item tree it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

export function connectRobotMenu(
  service: MenuService,
  readProps: ReadMenuProps,
  getItems: () => readonly MenuEntry[],
  id: string,
  send: Send,
  root: () => Element,
  typeahead: TypeaheadState,
): MenuFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const triggerId = `${ownerId}:trigger`;
  const contentId = `${ownerId}:content`;
  const positionerId = `${ownerId}:positioner`;
  const itemId = (value: string): string => `${ownerId}:item:${value}`;
  const submenuId = (value: string): string => `${ownerId}:submenu:${value}`;
  const ctx = (): MenuService["context"] => service.context;

  // ---- rows ---------------------------------------------------------------

  const toRow = (entry: MenuEntry): MenuRow | undefined => {
    if (!("value" in entry)) return undefined;
    const checked = entry.checked;
    return {
      value: entry.value,
      label: entry.label,
      shortcut: entry.shortcut ?? "",
      disabled: entry.disabled === true,
      checked: checked === undefined ? undefined : checked === true,
      children: entry.children ?? [],
    };
  };

  const buildBlocks = (): readonly MenuBlock[] => {
    const built: MenuBlock[] = [];
    let label: string | null = null;
    let rows: MenuRow[] = [];
    const flush = (): void => {
      if (rows.length > 0) {
        built.push({ id: `${ownerId}:group:${built.length}`, label, rows, separator: false });
        rows = [];
      }
      label = null;
    };
    for (const entry of getItems()) {
      if ("separator" in entry) {
        flush();
        // The hairline belongs to the block above it, not the one below.
        const last = built[built.length - 1];
        if (last !== undefined) built[built.length - 1] = { ...last, separator: true };
        continue;
      }
      if ("group" in entry) {
        flush();
        label = entry.group;
        for (const item of entry.items) {
          const row = toRow(item);
          if (row !== undefined) rows.push(row);
        }
        flush();
        continue;
      }
      const row = toRow(entry);
      if (row !== undefined) rows.push(row);
    }
    flush();
    return built;
  };

  /** Memoized on the item tree's identity — see the file header. */
  let blockSource: readonly MenuEntry[] | undefined;
  let blockCache: readonly MenuBlock[] | undefined;
  const blocks = (): readonly MenuBlock[] => {
    const source = getItems();
    if (blockCache === undefined || source !== blockSource) {
      blockSource = source;
      blockCache = buildBlocks();
    }
    return blockCache;
  };

  const allRows = (): readonly MenuRow[] => blocks().flatMap((block) => block.rows);

  const navigable = (): readonly MenuRow[] => allRows().filter((row) => !row.disabled);

  const rowByValue = (value: string | null): MenuRow | undefined =>
    value === null ? undefined : allRows().find((row) => row.value === value);

  // ---- navigation ---------------------------------------------------------

  const focusContent = (): void => {
    document.getElementById(contentId)?.focus();
  };

  const focusTrigger = (): void => {
    document.getElementById(triggerId)?.focus();
  };

  /** A submenu hands focus back to the level that holds its trigger row. */
  const focusParent = (): void => {
    const parent = root().closest('[role="menu"]');
    if (parent instanceof HTMLElement) parent.focus();
  };

  const highlight = (value: string | null): void => send({ type: "HIGHLIGHT", value });

  const move = (delta: number): void => {
    const list = navigable();
    if (list.length === 0) return;
    const at = list.findIndex((row) => row.value === ctx().highlightedValue);
    let target: MenuRow | undefined;
    if (at === -1) target = delta > 0 ? list[0] : list[list.length - 1];
    else if (readProps().loopFocus) target = list[(at + delta + list.length) % list.length];
    else target = list[Math.min(Math.max(at + delta, 0), list.length - 1)];
    if (target !== undefined) highlight(target.value);
  };

  const edge = (from: "first" | "last"): void => {
    const list = navigable();
    const row = from === "first" ? list[0] : list[list.length - 1];
    if (row !== undefined) highlight(row.value);
  };

  /** Enter this level's submenu: the machine opens it on this level's context,
   * and focus follows to the child's content so the keyboard stays in one
   * chain of levels. */
  const openSubmenu = (value: string): void => {
    send({ type: "SUBMENU_OPEN", value });
    document.getElementById(`${submenuId(value)}:content`)?.focus();
  };

  const closeSelf = (): void => send({ type: "CLOSE" });

  /** Tell the level above that this one closed, so it clears the context that
   * opened it. A select means the whole chain closes (Zag's closeRootMenu). */
  const reportClose = (select: boolean): void => {
    root().dispatchEvent(new CustomEvent("submenuclose", { bubbles: true, detail: { select } }));
  };

  const typeaheadMatch = (key: string): void => {
    const now = Date.now();
    typeahead.keys = now - typeahead.at < 500 ? typeahead.keys + key : key;
    typeahead.at = now;
    const needle = typeahead.keys.toLowerCase();
    const match = allRows().find((row) => !row.disabled && row.label.toLowerCase().startsWith(needle));
    if (match !== undefined) highlight(match.value);
  };

  const isPrintable = (event: KeyboardEvent): boolean =>
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

  const activate = (row: MenuRow, node: Element | null): void => {
    if (row.disabled) return;
    if (row.children.length > 0) {
      openSubmenu(row.value);
      return;
    }
    if (node instanceof Element) {
      const href = node.getAttribute("href");
      if (href !== null) readProps().navigate?.({ value: row.value, node, href });
    }
    send({ type: "ITEM_CLICK", value: row.value });
    if (readProps().closeOnSelect) {
      closeSelf();
      reportClose(true);
    }
  };

  const onContentKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    const current = ctx().highlightedValue;
    switch (event.key) {
      case "ArrowDown":
        move(1);
        break;
      case "ArrowUp":
        move(-1);
        break;
      case "Home":
        edge("first");
        break;
      case "End":
        edge("last");
        break;
      case "ArrowRight": {
        const row = rowByValue(current);
        if (row !== undefined && row.children.length > 0) openSubmenu(row.value);
        break;
      }
      case "ArrowLeft": {
        if (!props.isSubmenu) break;
        closeSelf();
        reportClose(false);
        focusParent();
        break;
      }
      case "Enter": {
        const row = rowByValue(current);
        if (row !== undefined) activate(row, document.getElementById(itemId(row.value)));
        break;
      }
      case " ": {
        if (typeahead.keys.length > 0) {
          typeaheadMatch(event.key);
          break;
        }
        const row = rowByValue(current);
        if (row !== undefined) activate(row, document.getElementById(itemId(row.value)));
        break;
      }
      default:
        if (!props.typeahead || !isPrintable(event)) return;
        typeaheadMatch(event.key);
        break;
    }
    event.preventDefault();
  };

  const onTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const openItem = (from: "first" | "last"): void => {
      send({ type: "TRIGGER_CLICK" });
      edge(from);
      focusContent();
    };
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
        if (service.open) move(1);
        else openItem("first");
        break;
      case "ArrowUp":
        if (service.open) move(-1);
        else openItem("last");
        break;
      case " ":
        if (service.open) move(1);
        else openItem("first");
        break;
      case "Escape":
        if (service.open) closeSelf();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** A press on this level's own trigger is that gesture's business, not a
   * dismissal: without it the open press and the trigger's toggle fight. */
  const isTriggerTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const trigger = readProps().isSubmenu ? root().parentElement : document.getElementById(triggerId);
    return trigger !== null && trigger !== undefined && trigger.contains(target);
  };

  const onSubmenuClose = (event: Event): void => {
    if (!("detail" in event)) return;
    const detail: unknown = event.detail;
    const select = typeof detail === "object" && detail !== null && Reflect.get(detail, "select") === true;
    if (select) {
      if (readProps().closeOnSelect) closeSelf();
      return;
    }
    const target = event.target;
    const openValue = ctx().openSubmenu;
    if (openValue === null || !(target instanceof Element)) return;
    if (target.id !== submenuId(openValue)) return;
    send({ type: "SUBMENU_CLOSE" });
  };

  const stateAttrs = (): Record<string, unknown> => ({ "data-state": service.open ? "open" : "closed" });

  /**
   * Anchor geometry as custom properties; the recipe's bracketed utilities
   * decide what each one feeds. A trigger-driven menu reports the trigger's
   * rect, a context menu reports the point relative to the positioning host.
   */
  const geometryStyle = (): Record<string, string> => {
    const anchor = ctx().anchorPoint;
    if (anchor !== null) {
      const host = document.getElementById(positionerId)?.offsetParent;
      if (host instanceof Element) {
        const rect = host.getBoundingClientRect();
        return {
          "--menu-anchor-x": `${anchor.x - rect.left}px`,
          "--menu-anchor-y": `${anchor.y - rect.top}px`,
          "--menu-anchor-w": `${rect.width}px`,
        };
      }
    }
    const above = readProps().placement === "top-start" ? "calc(-100% - 8px)" : "calc(100% + 8px)";
    const rect = document.getElementById(triggerId)?.getBoundingClientRect();
    const width = rect === undefined ? 0 : rect.width;
    return { "--menu-anchor-y": above, "--menu-anchor-w": `${width}px` };
  };

  // ---- cached bags --------------------------------------------------------

  const triggerBag = cached();
  const contextTriggerBag = cached();
  const contentBag = cached();
  /** One store per bag kind, keyed by the row or block the bag belongs to: a
   * group and a separator share a block owner, an item and its chevron share a
   * row, and each is a different part with a different shape. */
  const groupBags = new WeakMap<MenuBlock, BagMemo>();
  const groupLabelBags = new WeakMap<MenuBlock, BagMemo>();
  const separatorBags = new WeakMap<MenuBlock, BagMemo>();
  const itemBags = new WeakMap<MenuRow, BagMemo>();
  const indicatorBags = new WeakMap<MenuRow, BagMemo>();
  const shortcutBags = new WeakMap<MenuRow, BagMemo>();
  const chevronBags = new WeakMap<MenuRow, BagMemo>();
  const submenuBags = new WeakMap<MenuRow, BagMemo>();

  /** Row handlers, created once per row: they read the behavioural props live,
   * so a cached closure is never a stale snapshot of one. */
  interface RowHandlers {
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onClick: (event: MouseEvent) => void;
  }
  const rowHandlers = new WeakMap<MenuRow, RowHandlers>();
  const handlersFor = (row: MenuRow): RowHandlers => {
    const hit = rowHandlers.get(row);
    if (hit !== undefined) return hit;
    const made: RowHandlers = {
      onPointerMove: (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || row.disabled) return;
        highlight(row.value);
      },
      onClick: (event: MouseEvent) => {
        activate(row, event.currentTarget instanceof Element ? event.currentTarget : null);
      },
    };
    rowHandlers.set(row, made);
    return made;
  };

  return {
    // Live, not a snapshot: this connect outlives the machine move that
    // changes either field, and a host (or the api proxy) reads it between
    // moves.
    get isOpen(): boolean {
      return service.open;
    },
    get highlightedValue(): string | null {
      return ctx().highlightedValue;
    },
    getBlocks: blocks,
    getRows: (block: MenuBlock): readonly MenuRow[] => block.rows,
    getTriggerProps: () => {
      const props = readProps();
      return triggerBag(`${service.open}\u0000${props.composite}\u0000${props.isSubmenu}`, () => ({
        type: "button",
        id: triggerId,
        "aria-haspopup": props.composite ? "menu" : "dialog",
        "aria-expanded": service.open,
        "aria-controls": contentId,
        hidden: props.isSubmenu,
        ...stateAttrs(),
        onClick: () => {
          if (service.open) {
            closeSelf();
            return;
          }
          send({ type: "TRIGGER_CLICK" });
          focusContent();
        },
        onKeydown: onTriggerKeydown,
      }));
    },
    getContextTriggerProps: () => {
      const props = readProps();
      return contextTriggerBag(`${props.isSubmenu}`, () => ({
        hidden: props.isSubmenu,
        onContextMenu: (event: MouseEvent) => {
          if (readProps().isSubmenu) return;
          event.preventDefault();
          send({ type: "CONTEXT_MENU", point: { x: event.clientX, y: event.clientY } });
          focusContent();
        },
        "use:long-press": {
          delay: 700,
          onPress: (point: { x: number; y: number }) => {
            if (readProps().isSubmenu) return;
            send({ type: "CONTEXT_MENU", point });
            focusContent();
          },
        },
      }));
    },
    getPositionerProps: () => ({ id: positionerId, ...stateAttrs(), style: geometryStyle() }),
    getContentProps: () => {
      const props = readProps();
      const highlightedValue = ctx().highlightedValue;
      return contentBag(
        `${service.open}\u0000${highlightedValue}\u0000${props.composite}\u0000${props.isSubmenu}\u0000${allRows().length}`,
        () => ({
          id: contentId,
          role: props.composite ? "menu" : "dialog",
          tabindex: 0,
          // A leaf row's instance has no rows to show: keep it out of the
          // accessibility tree and out of hit-testing entirely.
          hidden: props.isSubmenu && allRows().length === 0,
          "aria-activedescendant": highlightedValue === null ? undefined : itemId(highlightedValue),
          "aria-labelledby": triggerId,
          ...stateAttrs(),
          onKeydown: onContentKeydown,
          onSubmenuclose: onSubmenuClose,
          "use:dismissable": {
            onOutside: (event: PointerEvent) => {
              if (isTriggerTarget(event.target)) return;
              closeSelf();
              reportClose(false);
            },
            onEscape: () => {
              closeSelf();
              reportClose(false);
              if (readProps().isSubmenu) focusParent();
              else focusTrigger();
            },
          },
        }),
      );
    },
    getItemGroupProps: (block: MenuBlock) => keyed(groupBags, block, "", () => ({
      id: block.id,
      role: "group",
      "aria-labelledby": block.label === null ? undefined : `${block.id}:label`,
    })),
    getItemGroupLabelProps: (block: MenuBlock) => keyed(groupLabelBags, block, "", () => ({
      id: `${block.id}:label`,
      hidden: block.label === null,
    })),
    getItemProps: (row: MenuRow) => {
      const hasChildren = row.children.length > 0;
      const props = readProps();
      return keyed(
        itemBags,
        row,
        `${ctx().highlightedValue}\u0000${ctx().openSubmenu}\u0000${hasChildren}\u0000${props.composite}`,
        () => {
          const expanded = ctx().openSubmenu === row.value;
          const highlighted = ctx().highlightedValue === row.value;
          const bag: Record<string, unknown> = {
            id: itemId(row.value),
            role: row.checked === undefined ? "menuitem" : "menuitemcheckbox",
            ...(row.checked === undefined ? {} : { "aria-checked": row.checked }),
            ...(row.disabled ? { "aria-disabled": true, "data-disabled": "" } : {}),
            ...(highlighted ? { "data-highlighted": "" } : {}),
            ...handlersFor(row),
          };
          if (hasChildren) {
            bag["aria-haspopup"] = props.composite ? "menu" : "dialog";
            bag["aria-expanded"] = expanded;
            bag["aria-controls"] = `${submenuId(row.value)}:content`;
            bag["data-state"] = expanded ? "open" : "closed";
            bag["use:hover-intent"] = {
              delay: 200,
              onOpen: () => send({ type: "SUBMENU_OPEN", value: row.value }),
              onClose: () => send({ type: "SUBMENU_CLOSE" }),
            };
          }
          return bag;
        },
      );
    },
    getItemTextProps: () => ({}),
    getItemIndicatorProps: (row: MenuRow) => keyed(indicatorBags, row, "", () => ({
      "aria-hidden": true,
      "data-state": row.checked === true ? "checked" : "unchecked",
    })),
    getItemShortcutProps: (row: MenuRow) => keyed(shortcutBags, row, "", () => ({
      hidden: row.shortcut.length === 0,
    })),
    getItemSubmenuIndicatorProps: (row: MenuRow) => keyed(chevronBags, row, "", () => ({
      "aria-hidden": true,
      hidden: row.children.length === 0,
    })),
    getSeparatorProps: (block: MenuBlock) => keyed(separatorBags, block, "", () => ({
      role: "separator",
      "aria-orientation": "horizontal",
      hidden: !block.separator,
    })),
    getSubmenuProps: (row: MenuRow) =>
      keyed(submenuBags, row, `${ctx().openSubmenu}`, () => ({
        id: submenuId(row.value),
        open: ctx().openSubmenu === row.value ? "true" : "false",
        items: JSON.stringify(row.children),
        label: row.label,
      })),
  };
}
