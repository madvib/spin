/**
 * Cascade-select connect: the DOM contract, the level stack, and the
 * view-owned navigation.
 *
 * Zag's machine walks a `TreeCollection` to answer "what is the next enabled
 * sibling" and "is the highlighted node at the root level". Here those are
 * plain functions over the raw tree plus `highlightedValue`, and the visible
 * levels are a derivation: every node along the highlighted path contributes
 * its children as one level, so the level stack IS the highlight.
 *
 * Everything else the connect owns:
 * - the id namespace (`cascade:<element id>:<part>`), part by part;
 * - the keyboard map on the trigger and the content, which computes its
 *   target against the tree and sends the resulting path;
 * - the reflexes, attached as stdlib actions: `dismissable` for the outside
 *   press and Escape, `scroll-into-view` for the active descendant;
 * - the value text (`formatValue`, or the default "Asia / India / Haryana");
 * - the hidden input that carries the value to a form.
 */

/** A node of the host's tree: exactly what the JSON transport carries. */
export interface CascadeNode {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly children?: readonly CascadeNode[] | undefined;
}

/** One visible level: a parent's children, drilled in by the highlight. */
export interface CascadeLevel {
  /** 0 for the root level. */
  readonly depth: number;
  /** The parent's path, `[]` for the root level; the row key and list id. */
  readonly path: readonly string[];
  /** The list part's id suffix. */
  readonly key: string;
  readonly items: readonly CascadeItem[];
}

/** A row of one level. Structural data only — state is read from context. */
export interface CascadeItem {
  /** The row key: every segment from the root to this node. */
  readonly key: string;
  /** The node's own value path. */
  readonly path: readonly string[];
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  /** A branch has children, so it can be drilled into. */
  readonly hasChildren: boolean;
  readonly depth: number;
  /** The row's index inside its level, and its index path from the root. */
  readonly indexInLevel: number;
  readonly indexPath: readonly number[];
}

/** Zag's `getItemState`: the derived row state the parts key on. */
export interface CascadeItemState {
  readonly value: readonly string[];
  readonly disabled: boolean;
  /** Part of the highlighted path — this level is being shown. */
  readonly highlighted: boolean;
  readonly selected: boolean;
  readonly hasChildren: boolean;
  readonly depth: number;
  /** The child value this row's level highlights, if any. */
  readonly highlightedChild: string | undefined;
  readonly highlightedIndex: number | undefined;
}

export interface CascadeValueTextRow {
  readonly value: string;
}

/** The host hooks the dismissal reflex reports through. */
export interface CascadeOutsideDetails {
  readonly focusable: boolean;
  readonly contextmenu: boolean;
  readonly originalEvent: PointerEvent | FocusEvent;
}

export interface CascadeScrollDetails {
  readonly index: number;
  readonly immediate?: boolean;
  readonly depth: number;
}

export type CascadeFormatValue = (items: readonly (readonly CascadeNode[])[]) => string;

export interface CascadeFsmConnectProps {
  readonly closeOnSelect: boolean;
  readonly allowParentSelection: boolean;
  readonly multiple: boolean;
  readonly loopFocus: boolean;
  readonly highlightTrigger: "click" | "hover";
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly dir: "ltr" | "rtl";
  readonly placement: string;
  readonly name: string;
  readonly form: string;
  readonly formatValue: CascadeFormatValue | undefined;
  readonly scrollToIndexFn: ((details: CascadeScrollDetails) => void) | undefined;
  /** Zag's outside-callable props, reported by the dismissal reflex. */
  readonly onPointerDownOutside: ((event: PointerEvent) => void) | undefined;
  readonly onFocusOutside: ((event: FocusEvent) => void) | undefined;
  readonly onInteractOutside: ((details: CascadeOutsideDetails) => void) | undefined;
}

export interface CascadeFsmApi {
  readonly open: boolean;
  readonly focused: boolean;
  readonly multiple: boolean;
  readonly disabled: boolean;
  readonly value: readonly string[][];
  readonly highlightedValue: readonly string[];
  readonly hasSelectedItems: boolean;
  readonly empty: boolean;
  readonly levels: readonly CascadeLevel[];
  getLevels(): readonly CascadeLevel[];
  getItems(level: CascadeLevel): readonly CascadeItem[];
  getItemState(item: CascadeItem): CascadeItemState;
  getValueText(): string;
  /** The readout as a one-row list: the markup's text channel is a one-shot,
   *  so a value that must change rides a row (the carousel readout idiom). */
  getValueTextRows(): readonly CascadeValueTextRow[];
  focus(): void;
  setOpen(nextOpen: boolean): void;
  setHighlightValue(value: readonly string[]): void;
  clearHighlightValue(): void;
  setValue(value: readonly string[][]): void;
  selectValue(value: readonly string[]): void;
  clearValue(value?: readonly string[]): void;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getIndicatorProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getListProps(level: CascadeLevel): Record<string, unknown>;
  getItemProps(item: CascadeItem): Record<string, unknown>;
  getItemTextProps(item: CascadeItem): Record<string, unknown>;
  getItemIndicatorProps(item: CascadeItem): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

/** The service surface the connect reads: live context, send. */
export interface CascadeService {
  readonly context: {
    value: string[][];
    highlightedValue: string[];
  };
  /** The machine's state value: `idle`, `focused` or `open`. */
  readonly stateValue: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

export type ReadCascadeProps = () => CascadeFsmConnectProps;

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The id namespace. A part id is `cascade:<element id>:<part>`. */
const NAMESPACE = "cascade";

/** Path segments and ids are joined with a separator no value can hold. */
const SEP = "\u0000";

export const pathKey = (path: readonly string[]): string => path.join(SEP);

/** Validate the host's tree: a row without a string value and label is
 *  dropped rather than poisoning the level stack. */
function parseNode(raw: unknown): CascadeNode | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const value = Reflect.get(raw, "value");
  const label = Reflect.get(raw, "label");
  if (typeof value !== "string" || value.length === 0) return undefined;
  const node: {
    value: string;
    label: string;
    disabled?: boolean;
    children?: readonly CascadeNode[];
  } = { value, label: typeof label === "string" ? label : value };
  const disabled = Reflect.get(raw, "disabled");
  if (typeof disabled === "boolean") node.disabled = disabled;
  const children = Reflect.get(raw, "children");
  if (Array.isArray(children)) node.children = parseNodes(children);
  return node;
}

function parseNodes(list: readonly unknown[]): readonly CascadeNode[] {
  const out: CascadeNode[] = [];
  for (const raw of list) {
    const node = parseNode(raw);
    if (node !== undefined) out.push(node);
  }
  return out;
}

/** The collection crosses the prop channel as JSON text (the grammar has no
 *  recursive type), so it is parsed and validated here rather than trusted at
 *  every read. */
export function parseCollection(raw: unknown): readonly CascadeNode[] {
  if (Array.isArray(raw)) return parseNodes(raw);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseNodes(parsed);
  } catch {
    return [];
  }
  return [];
}

/** The node a path leads to, or undefined when the path left the tree. */
export function nodeAtPath(
  collection: readonly CascadeNode[],
  path: readonly string[],
): CascadeNode | undefined {
  let nodes = collection;
  let found: CascadeNode | undefined;
  for (const segment of path) {
    found = nodes.find((node) => node.value === segment);
    if (found === undefined) return undefined;
    nodes = found.children ?? [];
  }
  return found;
}

/** The nodes along a path, one per level — Zag's `highlightedItems` /
 *  `selectedItems` chains. */
export function itemsAlongPath(
  collection: readonly CascadeNode[],
  path: readonly string[],
): readonly CascadeNode[] {
  const chain: CascadeNode[] = [];
  let nodes = collection;
  for (const segment of path) {
    const node = nodes.find((candidate) => candidate.value === segment);
    if (node === undefined) break;
    chain.push(node);
    nodes = node.children ?? [];
  }
  return chain;
}

/** Zag's `context.hash("value")`: each path's segments, then the paths. */
export const hashValue = (value: readonly string[][]): string =>
  value.map((path) => path.join(",")).join(", ");

/** A guarded index read, so no bag or navigation site needs a non-null
 *  assertion to reach into a list it bounds-checked a line earlier. */
const itemAt = <T>(list: readonly T[], index: number): T | undefined =>
  index >= 0 && index < list.length ? list[index] : undefined;

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** A cached bag plus the signature of the fields it read. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A bag rebuilt only when the signature of the context fields it reads moves:
 *  a binding re-reads the bag on every machine move, so a fresh bag per read
 *  would detach and re-attach every listener each move. */
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

/** `cached` per owner: levels and items are stable objects, so the memo dies
 *  with the level or row it came from. */
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

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function connectRobotCascade(
  service: CascadeService,
  readProps: ReadCascadeProps,
  getCollection: () => readonly CascadeNode[],
  id: string,
  send: Send,
  root: () => Element,
): CascadeFsmApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const triggerId = `${ownerId}:trigger`;
  const indicatorId = `${ownerId}:indicator`;
  const clearTriggerId = `${ownerId}:clear-trigger`;
  const positionerId = `${ownerId}:positioner`;
  const contentId = `${ownerId}:content`;
  const hiddenInputId = `${ownerId}:hidden-input`;
  const listId = (key: string): string => `${ownerId}:list:${key}`;
  const itemId = (path: readonly string[]): string => `${ownerId}:item:${path.join(",")}`;
  const ctx = (): CascadeService["context"] => service.context;
  const props = (): CascadeFsmConnectProps => readProps();

  /** Zag's `fieldsetDisabled`, tracked by trackFormControlState: here it is a
   *  read of the enclosing fieldset, not a tracked effect. */
  const fieldsetDisabled = (): boolean => {
    const fieldset = root().closest("fieldset");
    return fieldset !== null && fieldset.hasAttribute("disabled");
  };

  const disabled = (): boolean => props().disabled || fieldsetDisabled();

  /** Zag's computed `isInteractive`: a disabled or read-only control takes no
   *  pointer or key. */
  const interactive = (): boolean => !(disabled() || props().readOnly);

  // ---- the level stack ----------------------------------------------------

  /** Derive the visible levels: every node along the highlighted path
   *  contributes its children as the next level. */
  const buildLevels = (): readonly CascadeLevel[] => {
    const highlighted = ctx().highlightedValue;
    const levels: CascadeLevel[] = [];
    const indexPath: number[] = [];
    let nodes = getCollection();
    let path: string[] = [];
    for (let depth = 0; nodes.length > 0; depth++) {
      const items: CascadeItem[] = nodes.map((node, index) => {
        const itemPath = [...path, node.value];
        return {
          key: pathKey(itemPath),
          path: itemPath,
          value: node.value,
          label: node.label,
          disabled: node.disabled === true,
          hasChildren: (node.children?.length ?? 0) > 0,
          depth,
          indexInLevel: index,
          indexPath: [...indexPath, index],
        };
      });
      levels.push({ depth, path, key: depth === 0 ? "root" : pathKey(path), items });
      const segment = highlighted[depth];
      if (segment === undefined) break;
      const at = nodes.findIndex((node) => node.value === segment);
      const node = itemAt(nodes, at);
      const children = node?.children;
      if (node === undefined || children === undefined || children.length === 0) break;
      indexPath.push(at);
      path = [...path, node.value];
      nodes = children;
    }
    return levels;
  };

  /** Memoized on the level keys: drilling in and back out restores the same
   *  array, so the row cells keep their identity and their handlers. */
  let levelSignature = "";
  let levelCache: readonly CascadeLevel[] = [];
  const getLevels = (): readonly CascadeLevel[] => {
    const built = buildLevels();
    const signature = built.map((level) => level.key).join(SEP);
    if (signature === levelSignature) return levelCache;
    levelSignature = signature;
    levelCache = built;
    return levelCache;
  };

  const getItems = (level: CascadeLevel): readonly CascadeItem[] => level.items;

  const itemByPath = (path: readonly string[]): CascadeItem | undefined => {
    for (const level of getLevels()) {
      const found = level.items.find((item) => samePath(item.path, path));
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const getItemState = (item: CascadeItem): CascadeItemState => {
    const highlight = ctx().highlightedValue;
    const selected = ctx().value.some((path) => samePath(path, item.path));
    // Zag's `highlighted`: every segment of the item's path matches the
    // highlight's, so an ancestor of the highlighted node is highlighted too
    // — that is what keeps its level open.
    const highlighted = item.path.every((segment, index) => segment === highlight[index]);
    const children = nodeAtPath(getCollection(), item.path)?.children ?? [];
    const childSegment = highlighted ? highlight[item.depth + 1] : undefined;
    const highlightedIndex = childSegment === undefined
      ? undefined
      : children.findIndex((child) => child.value === childSegment);
    return {
      value: item.path,
      disabled: item.disabled,
      highlighted,
      selected,
      hasChildren: item.hasChildren,
      depth: item.depth,
      highlightedChild: childSegment,
      highlightedIndex: highlightedIndex === undefined || highlightedIndex < 0 ? undefined : highlightedIndex,
    };
  };

  // ---- navigation (the view owns it) --------------------------------------

  const focusContent = (): void => {
    document.getElementById(contentId)?.focus();
  };

  const focusTrigger = (): void => {
    document.getElementById(triggerId)?.focus();
  };

  const highlightPath = (path: readonly string[]): void =>
    send({ type: "HIGHLIGHTED_VALUE_SET", value: [...path] });

  /** The rows of the level holding `path`: its parent's children. */
  const siblingsOf = (path: readonly string[]): readonly CascadeItem[] => {
    const level = getLevels().find((candidate) => samePath(candidate.path, path.slice(0, -1)));
    return level === undefined ? [] : level.items;
  };

  /** The first (or last) enabled row of the root level. */
  const rootEdge = (edge: "first" | "last"): CascadeItem | undefined => {
    const level = getLevels().find((candidate) => candidate.depth === 0);
    const items = level === undefined ? [] : level.items;
    return edge === "first"
      ? items.find((item) => !item.disabled)
      : [...items].reverse().find((item) => !item.disabled);
  };

  /** The first (or last) enabled row of the level the highlight sits in. */
  const levelEdge = (edge: "first" | "last"): CascadeItem | undefined => {
    const items = siblingsOf(ctx().highlightedValue);
    return edge === "first"
      ? items.find((item) => !item.disabled)
      : [...items].reverse().find((item) => !item.disabled);
  };

  const moveHighlight = (delta: number): void => {
    const items = siblingsOf(ctx().highlightedValue);
    const at = items.findIndex((item) => samePath(item.path, ctx().highlightedValue));
    // Zag's `not(hasHighlightedValue)` branch: an edge is picked regardless of
    // loopFocus, because there is no current row to wrap from.
    if (at === -1) {
      const edge = delta > 0
        ? items.find((item) => !item.disabled)
        : [...items].reverse().find((item) => !item.disabled);
      if (edge !== undefined) highlightPath(edge.path);
      return;
    }
    const loop = props().loopFocus;
    let index = at;
    for (let step = 0; step < items.length; step++) {
      index += delta > 0 ? 1 : -1;
      if (index < 0 || index >= items.length) {
        if (!loop) return;
        index = index < 0 ? items.length - 1 : 0;
      }
      const item = itemAt(items, index);
      if (item !== undefined && !item.disabled) {
        highlightPath(item.path);
        return;
      }
    }
  };

  /** Zag's `canNavigateToChild` + `highlightFirstChild`. */
  const enterChild = (): void => {
    const path = ctx().highlightedValue;
    const children = nodeAtPath(getCollection(), path)?.children ?? [];
    if (path.length === 0 || children.length === 0) return;
    const child = children.find((node) => node.disabled !== true);
    if (child !== undefined) highlightPath([...path, child.value]);
  };

  /** Zag's `canNavigateToParent` + `highlightParent`, closing at the root
   *  level with focus back on the trigger. */
  const leaveChild = (): void => {
    const path = ctx().highlightedValue;
    if (path.length <= 1) {
      send({ type: "CLOSE" });
      focusTrigger();
      return;
    }
    highlightPath(path.slice(0, -1));
  };

  /** Zag's `selectHighlightedItem`; a branch that may not be selected is
   *  inert, exactly as CONTENT.ENTER has no fallback for it. */
  const selectHighlighted = (): void => {
    const path = ctx().highlightedValue;
    const item = itemByPath(path);
    if (item === undefined) return;
    if (!props().allowParentSelection && item.hasChildren) return;
    send({ type: "ITEM_CLICK", value: [...path], hasChildren: item.hasChildren });
  };

  // ---- the outside reflex -------------------------------------------------

  const isExcludedTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    for (const id of [triggerId, clearTriggerId]) {
      const part = document.getElementById(id);
      if (part !== null && part.contains(target)) return true;
    }
    return false;
  };

  const focusableTarget = (target: unknown): boolean =>
    target instanceof Element && target.matches(FOCUSABLE);

  const reportOutside = (
    kind: "pointer" | "focus",
    event: PointerEvent | FocusEvent,
    contextmenu: boolean,
  ): void => {
    const current = props();
    const focusable = focusableTarget(event.target);
    if (kind === "pointer") current.onPointerDownOutside?.(event as PointerEvent);
    else current.onFocusOutside?.(event as FocusEvent);
    current.onInteractOutside?.({ focusable, contextmenu, originalEvent: event });
  };

  const dismissSelf = (restoreFocus: boolean): void => {
    send({ type: "CLOSE", restoreFocus });
    // Zag's focusTriggerEl honors restoreFocusFn; the machine's `focused`
    // target is the same decision, so the focus call follows it.
    if (restoreFocus) focusTrigger();
  };

  // ---- keyboard -----------------------------------------------------------

  const onTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !interactive()) return;
    const current = props();
    const forward = current.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = current.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    const openWithEdge = (edge: "first" | "last"): void => {
      const target = rootEdge(edge);
      send({ type: "TRIGGER_OPEN", highlight: target === undefined ? [] : [...target.path] });
      focusContent();
    };
    const openPlain = (): void => {
      send({ type: "TRIGGER_OPEN", highlight: [] });
      focusContent();
    };
    switch (event.key) {
      case "ArrowUp":
        openWithEdge("last");
        break;
      case "ArrowDown":
        if (event.altKey) openPlain();
        else openWithEdge("first");
        break;
      case "Enter":
      case " ":
        openWithEdge("first");
        break;
      case back:
        openPlain();
        break;
      case forward:
        openWithEdge("first");
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onContentKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !interactive()) return;
    const current = props();
    const forward = current.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = current.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    switch (event.key) {
      case "Tab":
        // Zag's isValidTabEvent: the content is the only tabbable element
        // inside itself, so every Tab is invalid and focus holds until the
        // panel is dismissed or a value is chosen.
        event.preventDefault();
        return;
      case "ArrowDown":
        moveHighlight(1);
        break;
      case "ArrowUp":
        moveHighlight(-1);
        break;
      case forward:
        enterChild();
        break;
      case back:
        leaveChild();
        break;
      case "Home": {
        const edge = levelEdge("first");
        if (edge !== undefined) highlightPath(edge.path);
        break;
      }
      case "End": {
        const edge = levelEdge("last");
        if (edge !== undefined) highlightPath(edge.path);
        break;
      }
      case "Enter":
      case " ":
        selectHighlighted();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onContentFocusOut = (event: FocusEvent): void => {
    // The machine reports closed by now when a select hid the panel, so the
    // focus that leaves a hidden panel reports nothing.
    if (service.stateValue !== "open") return;
    const next = event.relatedTarget;
    if (next instanceof Element && root().contains(next)) return;
    reportOutside("focus", event, false);
    dismissSelf(false);
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const triggerBag = cached();
  const indicatorBag = cached();
  const valueTextBag = cached();
  const clearTriggerBag = cached();
  const contentBag = cached();
  const hiddenBag = cached();
  const listBags = new WeakMap<CascadeLevel, BagMemo>();
  const itemBags = new WeakMap<CascadeItem, BagMemo>();
  const itemTextBags = new WeakMap<CascadeItem, BagMemo>();
  const itemIndicatorBags = new WeakMap<CascadeItem, BagMemo>();

  /** The state attributes every part of the control shares. */
  const stateAttrs = (): Record<string, unknown> => ({
    "data-state": service.stateValue === "open" ? "open" : "closed",
    ...(disabled() ? { "data-disabled": "" } : {}),
    ...(props().readOnly ? { "data-readonly": "" } : {}),
    ...(props().invalid ? { "data-invalid": "" } : {}),
  });

  /** The trigger's measured width: continuous, so it leaves as a custom
   *  property the recipe's utilities decide what to feed. */
  const triggerWidth = (): string => {
    const rect = document.getElementById(triggerId)?.getBoundingClientRect();
    return rect === undefined ? "100%" : `${rect.width}px`;
  };

  const placementSide = (): string => {
    const side = props().placement.split("-")[0];
    return side === undefined ? "bottom" : side;
  };

  const selectedChains = (): readonly (readonly CascadeNode[])[] =>
    ctx().value.map((path) => itemsAlongPath(getCollection(), path));

  /** Zag's computed `valueAsString`: labels along each path, one selection
   *  per entry. */
  const valueAsString = (): string => {
    const chains = selectedChains();
    const custom = props().formatValue;
    if (custom !== undefined) return custom(chains);
    if (props().multiple) {
      return chains.map((chain) => chain[chain.length - 1]?.label ?? "").join(", ");
    }
    return chains.map((chain) => chain.map((node) => node.label).join(" / ")).join(", ");
  };

  let readoutText: string | undefined;
  let readoutRows: readonly CascadeValueTextRow[] = [];

  /** Row handlers, created once per row: they read the behavioural props
   *  live, so a cached closure is never a stale snapshot of one. */
  interface ItemHandlers {
    readonly onClick: () => void;
    readonly onPointerMove: (event: PointerEvent) => void;
    readonly onDoubleClick: () => void;
  }
  const itemHandlers = new WeakMap<CascadeItem, ItemHandlers>();
  const handlersFor = (item: CascadeItem): ItemHandlers => {
    const hit = itemHandlers.get(item);
    if (hit !== undefined) return hit;
    const made: ItemHandlers = {
      onClick: () => {
        if (item.disabled || !interactive()) return;
        send({ type: "ITEM_CLICK", value: [...item.path], hasChildren: item.hasChildren });
      },
      onPointerMove: (event: PointerEvent) => {
        if (!interactive() || item.disabled || event.pointerType !== "mouse") return;
        send({ type: "ITEM_POINTER_ENTER", value: [...item.path], hasChildren: item.hasChildren });
      },
      // Zag's ITEM.CLICK handler: a double click closes outright.
      onDoubleClick: () => {
        if (item.disabled || !interactive()) return;
        send({ type: "CLOSE" });
      },
    };
    itemHandlers.set(item, made);
    return made;
  };

  /** Zag's `scrollToIndexFn`: a host that scrolls its own content supplies the
   *  how (with the active row's position in its level), the reflex still owns
   *  the when. */
  const scrollParam = (): { readonly activeId: () => string; readonly reveal?: () => void } => {
    const activeId = (): string =>
      ctx().highlightedValue.length === 0 ? "" : itemId(ctx().highlightedValue);
    const custom = props().scrollToIndexFn;
    if (custom === undefined) return { activeId };
    return {
      activeId,
      reveal: () => {
        const path = ctx().highlightedValue;
        const level = getLevels().find((candidate) => samePath(candidate.path, path.slice(0, -1)));
        const at = level === undefined
          ? -1
          : level.items.findIndex((item) => samePath(item.path, path));
        custom({ index: at < 0 ? 0 : at, immediate: true, depth: level === undefined ? 0 : level.depth });
      },
    };
  };

  return {
    get open(): boolean {
      return service.stateValue === "open";
    },
    get focused(): boolean {
      return service.stateValue === "focused";
    },
    get multiple(): boolean {
      return props().multiple;
    },
    get disabled(): boolean {
      return disabled();
    },
    get value(): readonly string[][] {
      return ctx().value;
    },
    get highlightedValue(): readonly string[] {
      return ctx().highlightedValue;
    },
    get hasSelectedItems(): boolean {
      return ctx().value.length > 0;
    },
    get empty(): boolean {
      return ctx().value.length === 0;
    },
    get levels(): readonly CascadeLevel[] {
      return getLevels();
    },
    getLevels,
    getItems,
    getItemState,
    getValueText: valueAsString,
    getValueTextRows: () => {
      const text = valueAsString();
      if (text !== readoutText) {
        readoutText = text;
        readoutRows = [{ value: text }];
      }
      return readoutRows;
    },
    focus: (): void => {
      document.getElementById(triggerId)?.focus();
    },
    setOpen: (nextOpen: boolean): void => {
      if (nextOpen) {
        send({ type: "OPEN" });
        focusContent();
        return;
      }
      send({ type: "CLOSE" });
    },
    setHighlightValue: (value: readonly string[]): void =>
      send({ type: "HIGHLIGHTED_VALUE_SET", value: [...value] }),
    clearHighlightValue: (): void => send({ type: "HIGHLIGHTED_VALUE_CLEAR" }),
    setValue: (value: readonly string[][]): void =>
      send({ type: "VALUE_SET", value: value.map((path) => [...path]) }),
    selectValue: (value: readonly string[]): void => {
      const node = nodeAtPath(getCollection(), value);
      send({
        type: "ITEM_SELECT",
        value: [...value],
        hasChildren: (node?.children?.length ?? 0) > 0,
      });
    },
    clearValue: (value?: readonly string[]): void => {
      if (value === undefined) {
        send({ type: "VALUE_CLEAR" });
        return;
      }
      send({ type: "ITEM_CLEAR", value: [...value] });
    },
    getRootProps: () => {
      const current = props();
      return rootBag(`${current.dir}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}\u0000${service.stateValue}`, () => ({
        id: rootId,
        dir: current.dir,
        "data-placement": current.placement,
        ...stateAttrs(),
      }));
    },
    getLabelProps: () => {
      const current = props();
      return labelBag(`${current.dir}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}`, () => ({
        id: labelId,
        dir: current.dir,
        htmlFor: hiddenInputId,
        // Zag's label click focuses the trigger: the label's own target is a
        // hidden input, which cannot take focus.
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented || !interactive()) return;
          focusTrigger();
        },
        ...stateAttrs(),
      }));
    },
    getControlProps: () => {
      const current = props();
      return controlBag(`${service.stateValue}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}`, () => ({
        id: controlId,
        dir: current.dir,
        "data-focus": service.stateValue === "focused" ? "" : undefined,
        ...stateAttrs(),
      }));
    },
    getTriggerProps: () => {
      const current = props();
      return triggerBag(
        `${service.stateValue}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}\u0000${current.placement}\u0000${ctx().value.length}`,
        () => ({
          id: triggerId,
          type: "button",
          role: "combobox",
          dir: current.dir,
          "aria-controls": contentId,
          "aria-expanded": service.stateValue === "open",
          "aria-haspopup": "listbox",
          "aria-labelledby": labelId,
          "data-placement": current.placement,
          "data-side": placementSide(),
          "data-placeholder-shown": ctx().value.length === 0 ? "" : undefined,
          "data-focus": service.stateValue === "focused" ? "" : undefined,
          disabled: disabled(),
          onClick: (event: MouseEvent) => {
            if (event.defaultPrevented || !interactive()) return;
            send({ type: "TRIGGER_CLICK" });
            if (service.stateValue === "open") focusContent();
          },
          onFocus: () => send({ type: "TRIGGER_FOCUS" }),
          onBlur: () => send({ type: "TRIGGER_BLUR" }),
          onKeydown: onTriggerKeydown,
          ...stateAttrs(),
        }),
      );
    },
    getIndicatorProps: () => {
      const current = props();
      return indicatorBag(`${service.stateValue}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}`, () => ({
        id: indicatorId,
        dir: current.dir,
        "aria-hidden": true,
        ...stateAttrs(),
      }));
    },
    getValueTextProps: () => {
      const current = props();
      return valueTextBag(`${service.stateValue}\u0000${disabled()}\u0000${current.invalid}`, () => ({
        id: `${ownerId}:value-text`,
        dir: current.dir,
        "data-focus": service.stateValue === "focused" ? "" : undefined,
        ...stateAttrs(),
      }));
    },
    getClearTriggerProps: () => {
      const current = props();
      return clearTriggerBag(`${ctx().value.length}\u0000${disabled()}\u0000${current.readOnly}\u0000${current.invalid}`, () => ({
        id: clearTriggerId,
        type: "button",
        dir: current.dir,
        "aria-label": "Clear value",
        hidden: ctx().value.length === 0,
        disabled: disabled(),
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "CLEAR_TRIGGER_CLICK" });
          focusTrigger();
        },
        ...stateAttrs(),
      }));
    },
    // Not memoized, exactly as the menu's positioner is not: the geometry is a
    // measurement, so the bag is rebuilt per read and the recipe's bracketed
    // utilities re-apply the var as the trigger moves or resizes.
    getPositionerProps: () => ({
      id: positionerId,
      dir: props().dir,
      "data-placement": props().placement,
      "data-side": placementSide(),
      style: {
        "--cascade-anchor-w": triggerWidth(),
        "--cascade-anchor-y": props().placement.startsWith("top") ? "calc(-100% - 8px)" : "calc(100% + 8px)",
      },
      ...stateAttrs(),
    }),
    getContentProps: () => {
      const current = props();
      const highlighted = ctx().highlightedValue;
      return contentBag(
        `${service.stateValue}\u0000${highlighted.length}\u0000${current.multiple}\u0000${current.required}\u0000${current.readOnly}\u0000${disabled()}\u0000${current.scrollToIndexFn === undefined}\u0000${itemId(highlighted)}`,
        () => ({
          id: contentId,
          role: "listbox",
          dir: current.dir,
          "aria-labelledby": labelId,
          "aria-activedescendant": highlighted.length === 0 ? undefined : itemId(highlighted),
          "data-activedescendant": highlighted.length === 0 ? undefined : itemId(highlighted),
          "aria-multiselectable": current.multiple,
          "aria-required": current.required,
          "aria-readonly": current.readOnly,
          hidden: service.stateValue !== "open",
          tabIndex: 0,
          onKeydown: onContentKeydown,
          onFocusOut: onContentFocusOut,
          "use:dismissable": {
            onOutside: (event: PointerEvent) => {
              // The trigger and the clear button are this component's own
              // gestures: a press on them is a toggle, not a dismissal.
              if (isExcludedTarget(event.target)) return;
              reportOutside("pointer", event, event.button === 2);
              dismissSelf(!(focusableTarget(event.target) || event.button === 2));
            },
            onEscape: () => dismissSelf(true),
          },
          "use:scroll-into-view": scrollParam(),
          ...stateAttrs(),
        }),
      );
    },
    getListProps: (level: CascadeLevel) => keyed(
      listBags,
      level,
      `${level.depth}\u0000${props().dir}`,
      () => ({
        // The list id is the parent's value path, comma-joined — the same
        // spelling the item's id uses, so a branch's aria-controls resolves.
        id: listId(level.path.join(",")),
        dir: props().dir,
        role: "group",
        "data-depth": level.depth,
        "aria-level": level.depth,
      }),
    ),
    getItemProps: (item: CascadeItem) => {
      const state = getItemState(item);
      const current = props();
      return keyed(
        itemBags,
        item,
        `${state.highlighted}\u0000${state.selected}\u0000${state.hasChildren}`,
        () => ({
          id: itemId(item.path),
          role: "treeitem",
          dir: current.dir,
          "aria-haspopup": item.hasChildren ? "menu" : undefined,
          "aria-expanded": item.hasChildren ? state.highlighted : false,
          "aria-controls": item.hasChildren ? listId(pathKey(item.path)) : undefined,
          "aria-owns": item.hasChildren ? listId(pathKey(item.path)) : undefined,
          "aria-disabled": item.disabled,
          "data-value": item.path.join(","),
          "data-disabled": item.disabled ? "" : undefined,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-selected": state.selected ? "" : undefined,
          "data-depth": item.depth,
          "data-state": state.selected ? "checked" : "unchecked",
          "data-type": item.hasChildren ? "branch" : "leaf",
          "data-index-path": item.indexPath.join(","),
          ...handlersFor(item),
        }),
      );
    },
    getItemTextProps: (item: CascadeItem) => {
      const state = getItemState(item);
      return keyed(
        itemTextBags,
        item,
        `${state.highlighted}\u0000${state.selected}\u0000${state.disabled}`,
        () => ({
          dir: props().dir,
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-state": state.selected ? "checked" : "unchecked",
          "data-disabled": item.disabled ? "" : undefined,
        }),
      );
    },
    getItemIndicatorProps: (item: CascadeItem) => {
      const state = getItemState(item);
      return keyed(
        itemIndicatorBags,
        item,
        `${state.selected}\u0000${state.highlighted}\u0000${state.hasChildren}`,
        () => ({
          "aria-hidden": true,
          hidden: !state.selected,
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-type": state.hasChildren ? "branch" : "leaf",
          "data-state": state.selected ? "checked" : "unchecked",
        }),
      );
    },
    getHiddenInputProps: () => {
      const current = props();
      return hiddenBag(`${hashValue(ctx().value)}\u0000${current.name}\u0000${current.form}`, () => ({
        id: hiddenInputId,
        ...(current.name.length > 0 ? { name: current.name } : {}),
        ...(current.form.length > 0 ? { form: current.form } : {}),
        disabled: disabled(),
        required: current.required,
        readOnly: current.readOnly,
        hidden: true,
        "aria-hidden": true,
        "aria-labelledby": labelId,
        value: hashValue(ctx().value),
      }));
    },
  };
}

