import {
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type CascadeContext,
  type CascadeEvent,
} from "./cascade.machine.ts";

/**
 * Cascade-select definition: the DOM contract as data. The machine owns
 * idle/focused/open, the selected paths and the highlighted path; this file
 * maps props to channels, parts to attribute bags, commands to sends, and
 * open/value/highlight transitions to their events.
 *
 * Zag's machine walks a `TreeCollection` to answer "what is the next
 * enabled sibling" and "is the highlighted node at the root level". Here
 * those are plain functions over the raw tree plus `highlightedValue`, and
 * the visible levels are a derivation: every node along the highlighted
 * path contributes its children as one level, so the level stack IS the
 * highlight. The collection parses once per prop identity: level and item
 * objects are stable, so the `for` bindings never re-stamp.
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

export interface CascadeOpenChange {
  readonly open: boolean;
  readonly value: readonly string[][];
}

export interface CascadeValueChange {
  readonly value: readonly string[][];
  readonly items: readonly (readonly CascadeNode[])[];
}

export interface CascadeHighlightChange {
  readonly highlightedValue: readonly string[];
  readonly highlightedItems: readonly CascadeNode[];
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

export interface CascadeApi {
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

/** Path segments join with a comma in ids — the same spelling the item's
 * id uses, so a branch's aria-controls resolves. */
const SEP = ",";

export const pathKey = (path: readonly string[]): string => path.join(SEP);

/** Validate the host's tree: a row without a string value and label is
 *  dropped rather than poisoning the level stack. */
const parseNode = (raw: unknown): CascadeNode | undefined => {
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
  if (Array.isArray(children)) {
    node.children = children.flatMap((child) => {
      const parsed = parseNode(child);
      return parsed === undefined ? [] : [parsed];
    });
  }
  return node;
};

const parseNodes = (list: readonly unknown[]): readonly CascadeNode[] =>
  list.flatMap((raw) => {
    const node = parseNode(raw);
    return node === undefined ? [] : [node];
  });

/** The collection crosses the prop channel as JSON text (the grammar has no
 *  recursive type), so it is parsed and validated here rather than trusted
 *  at every read. A host holding the live object stops at the scope
 *  boundary: arrays arrive raw, already shaped. */
export const parseCollection = (raw: unknown): readonly CascadeNode[] => {
  if (Array.isArray(raw)) return parseNodes(raw);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseNodes(parsed);
  } catch {
    return [];
  }
  return [];
};

const isString = (segment: unknown): segment is string => typeof segment === "string";

/**
 * The value crosses the prop channel as JSON text: the grammar has no
 * nested array type, and a value path is `string[]`. A malformed path drops
 * its bad segments rather than poisoning the machine.
 */
const parsePath = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) return raw.filter(isString);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isString);
  } catch {
    return [];
  }
  return [];
};

/** A list of value paths: `[["Asia","India"],["Europe","France"]]`. */
const parsePaths = (raw: unknown): readonly string[][] => {
  if (Array.isArray(raw)) {
    return raw.flatMap((path) => (Array.isArray(path) ? [path.filter(isString)] : []));
  }
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsePaths(parsed);
  } catch {
    return [];
  }
  return [];
};

/** The node a path leads to, or undefined when the path left the tree. */
export const nodeAtPath = (
  collection: readonly CascadeNode[],
  path: readonly string[],
): CascadeNode | undefined => {
  let nodes = collection;
  let found: CascadeNode | undefined;
  for (const segment of path) {
    found = nodes.find((node) => node.value === segment);
    if (found === undefined) return undefined;
    nodes = found.children ?? [];
  }
  return found;
};

/** The nodes along a path, one per level — Zag's `highlightedItems` /
 *  `selectedItems` chains. */
export const itemsAlongPath = (
  collection: readonly CascadeNode[],
  path: readonly string[],
): readonly CascadeNode[] => {
  const chain: CascadeNode[] = [];
  let nodes = collection;
  for (const segment of path) {
    const node = nodes.find((candidate) => candidate.value === segment);
    if (node === undefined) break;
    chain.push(node);
    nodes = node.children ?? [];
  }
  return chain;
};

/** Zag's `context.hash("value")`: each path's segments, then the paths. */
export const hashValue = (value: readonly string[][]): string =>
  value.map((path) => path.join(",")).join(", ");

/** A guarded index read, so no bag or navigation site needs a non-null
 *  assertion to reach into a list it bounds-checked a line earlier. */
const itemAt = <T>(list: readonly T[], index: number): T | undefined =>
  index >= 0 && index < list.length ? list[index] : undefined;

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const samePaths = (a: readonly string[][], b: readonly string[][]): boolean =>
  a.length === b.length && a.every((path, i) => samePath(path, b[i] ?? []));

type Ctx = CascadeContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const collectionOf = (parsed: Record<string, unknown>): readonly CascadeNode[] =>
  parsed["collection"] as readonly CascadeNode[];

/** Derive the visible levels: every node along the highlighted path
 *  contributes its children as the next level. Memoized on the collection
 *  and the highlight key: drilling in and back out restores the same
 *  array, so the row cells keep their identity and their handlers. */
const levelsCache = new WeakMap<
  readonly CascadeNode[],
  Map<string, readonly CascadeLevel[]>
>();
const levelsOf = (
  collection: readonly CascadeNode[],
  highlighted: readonly string[],
): readonly CascadeLevel[] => {
  const key = pathKey(highlighted);
  let byKey = levelsCache.get(collection);
  if (byKey === undefined) {
    byKey = new Map();
    levelsCache.set(collection, byKey);
  }
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const levels: CascadeLevel[] = [];
  const indexPath: number[] = [];
  let nodes = collection;
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
  byKey.set(key, levels);
  return levels;
};

const itemByPath = (
  collection: readonly CascadeNode[],
  highlighted: readonly string[],
  path: readonly string[],
): CascadeItem | undefined => {
  for (const level of levelsOf(collection, highlighted)) {
    const found = level.items.find((item) => samePath(item.path, path));
    if (found !== undefined) return found;
  }
  return undefined;
};

const itemStateOf = (scope: ScopeLike, item: CascadeItem): CascadeItemState => {
  const ctx = asCtx(scope.context);
  const highlight = ctx.highlightedValue;
  const selected = ctx.value.some((path) => samePath(path, item.path));
  // Zag's `highlighted`: every segment of the item's path matches the
  // highlight's, so an ancestor of the highlighted node is highlighted too
  // — that is what keeps its level open.
  const highlighted = item.path.every((segment, index) => segment === highlight[index]);
  const children = nodeAtPath(collectionOf(scope.props), item.path)?.children ?? [];
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

/** Row handlers, built once per item per bridge: the scope reads live
 *  through proxies, so a cached closure never goes stale. */
type ItemHandlerSet = {
  readonly onClick: () => void;
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onDoubleClick: () => void;
};
const itemHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  WeakMap<CascadeItem, ItemHandlerSet>
>();
const itemHandlers = (scope: ScopeLike, item: CascadeItem): ItemHandlerSet => {
  let byItem = itemHandlersByBridge.get(scope.send);
  if (byItem === undefined) {
    byItem = new WeakMap();
    itemHandlersByBridge.set(scope.send, byItem);
  }
  const hit = byItem.get(item);
  if (hit !== undefined) return hit;
  const made: ItemHandlerSet = {
    onClick: (): void => {
      if (item.disabled || !isInteractive(scope)) return;
      scope.send({ type: "ITEM_CLICK", value: [...item.path], hasChildren: item.hasChildren });
    },
    onPointerMove: (event: PointerEvent): void => {
      if (!isInteractive(scope) || item.disabled || event.pointerType !== "mouse") return;
      scope.send({ type: "ITEM_POINTER_ENTER", value: [...item.path], hasChildren: item.hasChildren });
    },
    // Zag's ITEM.CLICK handler: a double click closes outright.
    onDoubleClick: (): void => {
      if (item.disabled || !isInteractive(scope)) return;
      scope.send({ type: "CLOSE" });
    },
  };
  byItem.set(item, made);
  return made;
};

/** Zag's `fieldsetDisabled`, tracked by trackFormControlState: here it is a
 *  read of the enclosing fieldset, not a tracked effect. */
const fieldsetDisabled = (root: () => Element): boolean => {
  const fieldset = root().closest("fieldset");
  return fieldset !== null && fieldset.hasAttribute("disabled");
};

const disabledOf = (scope: ScopeLike): boolean =>
  scope.props["disabled"] === true || fieldsetDisabled(scope.root);

/** Zag's computed `isInteractive`: a disabled or read-only control takes no
 *  pointer or key. */
const isInteractive = (scope: ScopeLike): boolean =>
  !(disabledOf(scope) || scope.props["readOnly"] === true);

const highlightPath = (scope: ScopeLike, path: readonly string[]): void => {
  scope.send({ type: "HIGHLIGHTED_VALUE_SET", value: [...path] });
};

/** The rows of the level holding `path`: its parent's children. */
const siblingsOf = (scope: ScopeLike, path: readonly string[]): readonly CascadeItem[] => {
  const level = levelsOf(collectionOf(scope.props), asCtx(scope.context).highlightedValue)
    .find((candidate) => samePath(candidate.path, path.slice(0, -1)));
  return level === undefined ? [] : level.items;
};

/** The first (or last) enabled row of the root level. */
const rootEdge = (scope: ScopeLike, edge: "first" | "last"): CascadeItem | undefined => {
  const level = levelsOf(collectionOf(scope.props), asCtx(scope.context).highlightedValue)
    .find((candidate) => candidate.depth === 0);
  const items = level === undefined ? [] : level.items;
  return edge === "first"
    ? items.find((item) => !item.disabled)
    : [...items].reverse().find((item) => !item.disabled);
};

/** The first (or last) enabled row of the level the highlight sits in. */
const levelEdge = (scope: ScopeLike, edge: "first" | "last"): CascadeItem | undefined => {
  const items = siblingsOf(scope, asCtx(scope.context).highlightedValue);
  return edge === "first"
    ? items.find((item) => !item.disabled)
    : [...items].reverse().find((item) => !item.disabled);
};

const moveHighlight = (scope: ScopeLike, delta: number): void => {
  const items = siblingsOf(scope, asCtx(scope.context).highlightedValue);
  const at = items.findIndex((item) => samePath(item.path, asCtx(scope.context).highlightedValue));
  // Zag's `not(hasHighlightedValue)` branch: an edge is picked regardless of
  // loopFocus, because there is no current row to wrap from.
  if (at === -1) {
    const end = delta > 0
      ? items.find((item) => !item.disabled)
      : [...items].reverse().find((item) => !item.disabled);
    if (end !== undefined) highlightPath(scope, end.path);
    return;
  }
  const loop = scope.props["loopFocus"] === true;
  let index = at;
  for (let count = 0; count < items.length; count++) {
    index += delta > 0 ? 1 : -1;
    if (index < 0 || index >= items.length) {
      if (!loop) return;
      index = index < 0 ? items.length - 1 : 0;
    }
    const item = itemAt(items, index);
    if (item !== undefined && !item.disabled) {
      highlightPath(scope, item.path);
      return;
    }
  }
};

/** Zag's `canNavigateToChild` + `highlightFirstChild`. */
const enterChild = (scope: ScopeLike): void => {
  const path = asCtx(scope.context).highlightedValue;
  const children = nodeAtPath(collectionOf(scope.props), path)?.children ?? [];
  if (path.length === 0 || children.length === 0) return;
  const child = children.find((node) => node.disabled !== true);
  if (child !== undefined) highlightPath(scope, [...path, child.value]);
};

/** Zag's `canNavigateToParent` + `highlightParent`, closing at the root
 *  level with focus back on the trigger. */
const leaveChild = (scope: ScopeLike): void => {
  const path = asCtx(scope.context).highlightedValue;
  if (path.length <= 1) {
    scope.send({ type: "CLOSE" });
    focusPart(scope, "trigger");
    return;
  }
  highlightPath(scope, path.slice(0, -1));
};

/** Zag's `selectHighlightedItem`; a branch that may not be selected is
 *  inert, exactly as CONTENT.ENTER has no fallback for it. */
const selectHighlighted = (scope: ScopeLike): void => {
  const path = asCtx(scope.context).highlightedValue;
  const item = itemByPath(collectionOf(scope.props), path, path);
  if (item === undefined) return;
  if (scope.props["allowParentSelection"] !== true && item.hasChildren) return;
  scope.send({ type: "ITEM_CLICK", value: [...path], hasChildren: item.hasChildren });
};

const focusPart = (scope: ScopeLike, part: string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(scope.id(part))?.focus();
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const isExcludedTarget = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (!(target instanceof Element) || typeof document === "undefined") return false;
  for (const part of ["trigger", "clearTrigger"] as const) {
    const node = document.getElementById(scope.id(part));
    if (node !== null && node.contains(target)) return true;
  }
  return false;
};

const focusableTarget = (target: unknown): boolean =>
  target instanceof Element && target.matches(FOCUSABLE);

const reportOutside = (
  scope: ScopeLike,
  kind: "pointer" | "focus",
  event: PointerEvent | FocusEvent,
  contextmenu: boolean,
): void => {
  const focusable = focusableTarget(event.target);
  if (kind === "pointer") {
    const fn = scope.props["onPointerDownOutside"];
    if (typeof fn === "function") (fn as (event: PointerEvent) => void)(event as PointerEvent);
  } else {
    const fn = scope.props["onFocusOutside"];
    if (typeof fn === "function") (fn as (event: FocusEvent) => void)(event as FocusEvent);
  }
  const interact = scope.props["onInteractOutside"];
  if (typeof interact === "function") {
    (interact as (details: CascadeOutsideDetails) => void)({
      focusable,
      contextmenu,
      originalEvent: event,
    });
  }
};

const dismissSelf = (scope: ScopeLike, restoreFocus: boolean): void => {
  scope.send({ type: "CLOSE", restoreFocus });
  // Zag's focusTriggerEl honors restoreFocusFn; the machine's `focused`
  // target is the same decision, so the focus call follows it.
  if (restoreFocus) focusPart(scope, "trigger");
};

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented || !isInteractive(scope)) return;
  const forward = scope.props["dir"] === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = scope.props["dir"] === "rtl" ? "ArrowRight" : "ArrowLeft";
  const openWithEdge = (end: "first" | "last"): void => {
    const target = rootEdge(scope, end);
    scope.send({ type: "TRIGGER_OPEN", highlight: target === undefined ? [] : [...target.path] });
    focusPart(scope, "content");
  };
  const openPlain = (): void => {
    scope.send({ type: "TRIGGER_OPEN", highlight: [] });
    focusPart(scope, "content");
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

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented || !isInteractive(scope)) return;
  const forward = scope.props["dir"] === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = scope.props["dir"] === "rtl" ? "ArrowRight" : "ArrowLeft";
  switch (event.key) {
    case "Tab":
      // Zag's isValidTabEvent: the content is the only tabbable element
      // inside itself, so every Tab is invalid and focus holds until the
      // panel is dismissed or a value is chosen.
      event.preventDefault();
      return;
    case "ArrowDown":
      moveHighlight(scope, 1);
      break;
    case "ArrowUp":
      moveHighlight(scope, -1);
      break;
    case forward:
      enterChild(scope);
      break;
    case back:
      leaveChild(scope);
      break;
    case "Home": {
      const end = levelEdge(scope, "first");
      if (end !== undefined) highlightPath(scope, end.path);
      break;
    }
    case "End": {
      const end = levelEdge(scope, "last");
      if (end !== undefined) highlightPath(scope, end.path);
      break;
    }
    case "Enter":
    case " ":
      selectHighlighted(scope);
      break;
    default:
      return;
  }
  event.preventDefault();
};

const onContentFocusOut = (scope: ScopeLike, event: FocusEvent): void => {
  // The machine reports closed by now when a select hid the panel, so the
  // focus that leaves a hidden panel reports nothing.
  if (scope.state !== "open") return;
  const next = event.relatedTarget;
  if (next instanceof Element && scope.root().contains(next)) return;
  reportOutside(scope, "focus", event, false);
  dismissSelf(scope, false);
};

/** Zag's computed `valueAsString`: labels along each path, one selection
 *  per entry. */
const valueAsString = (scope: ScopeLike): string => {
  const chains = asCtx(scope.context).value.map((path) => itemsAlongPath(collectionOf(scope.props), path));
  const custom = scope.props["formatValue"];
  if (typeof custom === "function") return (custom as CascadeFormatValue)(chains);
  if (scope.props["multiple"] === true) {
    return chains.map((chain) => chain[chain.length - 1]?.label ?? "").join(", ");
  }
  return chains.map((chain) => chain.map((node) => node.label).join(" / ")).join(", ");
};

/** Zag's `scrollToIndexFn`: a host that scrolls its own content supplies the
 *  how (with the active row's position in its level), the reflex still owns
 *  the when. */
const scrollParam = (
  scope: ScopeLike,
): { readonly activeId: () => string; readonly reveal?: () => void } => {
  const activeId = (): string => {
    const highlighted = asCtx(scope.context).highlightedValue;
    return highlighted.length === 0 ? "" : scope.id("item", pathKey(highlighted));
  };
  const custom = scope.props["scrollToIndexFn"];
  if (typeof custom !== "function") return { activeId };
  return {
    activeId,
    reveal: (): void => {
      const path = asCtx(scope.context).highlightedValue;
      const level = levelsOf(collectionOf(scope.props), path)
        .find((candidate) => samePath(candidate.path, path.slice(0, -1)));
      const at = level === undefined
        ? -1
        : level.items.findIndex((item) => samePath(item.path, path));
      (custom as (details: CascadeScrollDetails) => void)({
        index: at < 0 ? 0 : at,
        immediate: true,
        depth: level === undefined ? 0 : level.depth,
      });
    },
  };
};

const def: ComponentDef<CascadeContext, CascadeEvent> = {
  name: "cascade",
  config,
  implementations,
  start: (props, authored) => {
    if (authored("open")) return (props["open"] as boolean) === true ? "open" : "idle";
    return (props["defaultOpen"] as boolean) === true ? "open" : "idle";
  },
  seed: (props, authored) => ({
    closeOnSelect: props["closeOnSelect"] !== false,
    allowParentSelection: props["allowParentSelection"] === true,
    multiple: props["multiple"] === true,
    loopFocus: props["loopFocus"] === true,
    highlightTrigger: props["highlightTrigger"] === "hover" ? "hover" : "click",
    value: parsePaths(authored("value") ? props["value"] : props["defaultValue"])
      .map((path) => [...path]),
    highlightedValue: [
      ...parsePath(authored("highlightedValue") ? props["highlightedValue"] : props["defaultHighlightedValue"]),
    ],
  }),
  channels: {
    collection: { parse: parseCollection },
    value: {
      controlled: true,
      parse: parsePaths,
      event: (value: readonly string[][]) => ({ type: "VALUE_SET", value: value.map((path) => [...path]) }),
      // The host's write alternates on its own: the machine holds no
      // collection to validate a path against at sync time, so the value
      // lands directly and the guards read it from context thereafter.
      assign: true,
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) &&
        samePaths(current as string[][], outer as string[][]),
    },
    defaultValue: { parse: parsePaths },
    highlightedValue: {
      controlled: true,
      parse: parsePath,
      event: (value: readonly string[]) => ({ type: "HIGHLIGHTED_VALUE_SET", value: [...value] }),
      assign: true,
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) &&
        samePath(current as string[], outer as string[]),
    },
    defaultHighlightedValue: { parse: parsePath },
    open: {
      controlled: true,
      parse: (raw) => {
        // The attribute text is the channel when present (a bare `open`
        // opens, `"false"` closes); otherwise the coerced prop.
        if (typeof raw !== "string") return raw === true;
        if (raw.length === 0) return true;
        return raw === "true";
      },
      event: (value: boolean) => ({ type: value ? "CONTROLLED_OPEN" : "CONTROLLED_CLOSE" }),
      current: (_context, state) => state === "open",
    },
    defaultOpen: { parse: (raw) => raw === true },
    closeOnSelect: { parse: (raw) => raw !== false },
    allowParentSelection: { parse: (raw) => raw === true },
    multiple: { parse: (raw) => raw === true },
    loopFocus: { parse: (raw) => raw === true },
    highlightTrigger: { parse: (raw) => (raw === "hover" ? "hover" : "click") },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    placement: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "bottom-start"),
    },
    name: { parse: textProp },
    form: { parse: textProp },
    formatValue: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
    scrollToIndexFn: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
    onPointerDownOutside: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
    onFocusOutside: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
    onInteractOutside: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
  },
  scalars: ["closeOnSelect", "allowParentSelection", "multiple", "loopFocus", "highlightTrigger"],
  parts: {
    root: {
      sig: (scope) => [scope.props["dir"], disabledOf(scope), scope.props["readOnly"], scope.props["invalid"], scope.state].join(" "),
      attrs: (scope) => ({
        // The bare namespace: the root part carries no suffix, so
        // owner-scoped lookups never collide with a part name.
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-placement": scope.props["placement"],
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    label: {
      sig: (scope) => [scope.props["dir"], disabledOf(scope), scope.props["readOnly"], scope.props["invalid"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        htmlFor: scope.id("hiddenInput"),
        // Zag's label click focuses the trigger: the label's own target is
        // a hidden input, which cannot take focus.
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented || !isInteractive(scope)) return;
          focusPart(scope, "trigger");
        },
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    control: {
      sig: (scope) => [scope.state, disabledOf(scope), scope.props["readOnly"], scope.props["invalid"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        dir: scope.props["dir"],
        "data-focus": scope.state === "focused" ? "" : undefined,
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    trigger: {
      sig: (scope) => [scope.state, disabledOf(scope), scope.props["readOnly"], scope.props["invalid"], scope.props["placement"], asCtx(scope.context).value.length].join(" "),
      attrs: (scope) => ({
        id: scope.id("trigger"),
        type: "button",
        role: "combobox",
        dir: scope.props["dir"],
        "aria-controls": scope.id("content"),
        "aria-expanded": scope.state === "open",
        "aria-haspopup": "listbox",
        "aria-labelledby": scope.id("label"),
        "data-placement": scope.props["placement"],
        "data-side": (scope.props["placement"] as string).split("-")[0] ?? "bottom",
        "data-placeholder-shown": asCtx(scope.context).value.length === 0 ? "" : undefined,
        "data-focus": scope.state === "focused" ? "" : undefined,
        disabled: disabledOf(scope),
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented || !isInteractive(scope)) return;
          scope.send({ type: "TRIGGER_CLICK" });
          if (scope.state === "open") focusPart(scope, "content");
        },
        onFocus: (): void => scope.send({ type: "TRIGGER_FOCUS" }),
        onBlur: (): void => scope.send({ type: "TRIGGER_BLUR" }),
        onKeydown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    indicator: {
      sig: (scope) => [scope.state, disabledOf(scope), scope.props["readOnly"], scope.props["invalid"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("indicator"),
        dir: scope.props["dir"],
        "aria-hidden": true,
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    valueText: {
      id: "value-text",
      sig: (scope) => [scope.state, disabledOf(scope), scope.props["invalid"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-focus": scope.state === "focused" ? "" : undefined,
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    clearTrigger: {
      id: "clear-trigger",
      sig: (scope) => [asCtx(scope.context).value.length, disabledOf(scope), scope.props["readOnly"], scope.props["invalid"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("clearTrigger"),
        type: "button",
        dir: scope.props["dir"],
        "aria-label": "Clear value",
        hidden: asCtx(scope.context).value.length === 0,
        disabled: disabledOf(scope),
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "CLEAR_TRIGGER_CLICK" });
          focusPart(scope, "trigger");
        },
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
        ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
      }),
    },
    // Not memoized, exactly as before: the geometry is a measurement, so
    // the bag is rebuilt per read and the recipe's bracketed utilities
    // re-apply the var as the trigger moves or resizes.
    positioner: {
      sig: () => `${Date.now()}`,
      attrs: (scope) => {
        const rect = typeof document === "undefined"
          ? undefined
          : document.getElementById(scope.id("trigger"))?.getBoundingClientRect();
        return {
          id: scope.id("positioner"),
          dir: scope.props["dir"],
          "data-placement": scope.props["placement"],
          "data-side": (scope.props["placement"] as string).split("-")[0] ?? "bottom",
          style: {
            "--cascade-anchor-w": rect === undefined ? "100%" : `${rect.width}px`,
            "--cascade-anchor-y": (scope.props["placement"] as string).startsWith("top")
              ? "calc(-100% - 8px)"
              : "calc(100% + 8px)",
          },
          "data-state": scope.state === "open" ? "open" : "closed",
          ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
          ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
          ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
        };
      },
    },
    content: {
      sig: (scope) => {
        const highlighted = asCtx(scope.context).highlightedValue;
        return [
          scope.state,
          highlighted.length,
          scope.props["multiple"],
          scope.props["required"],
          scope.props["readOnly"],
          disabledOf(scope),
          scope.props["scrollToIndexFn"] === undefined,
          scope.id("item", pathKey(highlighted)),
        ].join(" ");
      },
      attrs: (scope) => {
        const highlighted = asCtx(scope.context).highlightedValue;
        return {
          id: scope.id("content"),
          role: "listbox",
          dir: scope.props["dir"],
          "aria-labelledby": scope.id("label"),
          "aria-activedescendant": highlighted.length === 0
            ? undefined
            : scope.id("item", pathKey(highlighted)),
          "data-activedescendant": highlighted.length === 0
            ? undefined
            : scope.id("item", pathKey(highlighted)),
          "aria-multiselectable": scope.props["multiple"],
          "aria-required": scope.props["required"],
          "aria-readonly": scope.props["readOnly"],
          hidden: scope.state !== "open",
          tabIndex: 0,
          onKeydown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          onFocusOut: (event: FocusEvent): void => onContentFocusOut(scope, event),
          "use:dismissable": {
            onOutside: (event: PointerEvent): void => {
              // The trigger and the clear button are this component's own
              // gestures: a press on them is a toggle, not a dismissal.
              if (isExcludedTarget(scope, event.target)) return;
              reportOutside(scope, "pointer", event, event.button === 2);
              dismissSelf(scope, !(focusableTarget(event.target) || event.button === 2));
            },
            onEscape: (): void => dismissSelf(scope, true),
          },
          "use:scroll-into-view": scrollParam(scope),
          "data-state": scope.state === "open" ? "open" : "closed",
          ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
          ...(scope.props["readOnly"] === true ? { "data-readonly": "" } : {}),
          ...(scope.props["invalid"] === true ? { "data-invalid": "" } : {}),
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => [hashValue(asCtx(scope.context).value), scope.props["name"], scope.props["form"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("hiddenInput"),
        ...((scope.props["name"] as string).length > 0 ? { name: scope.props["name"] } : {}),
        ...((scope.props["form"] as string).length > 0 ? { form: scope.props["form"] } : {}),
        disabled: disabledOf(scope),
        required: scope.props["required"],
        readOnly: scope.props["readOnly"],
        hidden: true,
        "aria-hidden": true,
        "aria-labelledby": scope.id("label"),
        value: hashValue(asCtx(scope.context).value),
      }),
    },
  },
  slots: {
    list: {
      indexes: (_context, props) =>
        levelsOf(collectionOf(props), (props["highlightedValue"] ?? []) as readonly string[]),
      sig: (scope) => {
        const level = scope.slot as unknown as CascadeLevel;
        return `${level.depth} ${scope.props["dir"]}`;
      },
      attrs: (scope) => {
        const level = scope.slot as unknown as CascadeLevel;
        return {
          // The list id is the parent's value path, comma-joined — the same
          // spelling the item's id uses, so a branch's aria-controls resolves.
          id: scope.id("list", level.path.join(",")),
          dir: scope.props["dir"],
          role: "group",
          "data-depth": level.depth,
          "aria-level": level.depth,
        };
      },
    },
    item: {
      indexes: (_context, props) =>
        levelsOf(collectionOf(props), (props["highlightedValue"] ?? []) as readonly string[])
          .flatMap((level) => level.items),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as CascadeItem);
        return `${state.highlighted} ${state.selected} ${state.hasChildren}`;
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as CascadeItem;
        const state = itemStateOf(scope, item);
        return {
          id: scope.id("item", pathKey(item.path)),
          role: "treeitem",
          dir: scope.props["dir"],
          "aria-haspopup": item.hasChildren ? "menu" : undefined,
          "aria-expanded": item.hasChildren ? state.highlighted : false,
          "aria-controls": item.hasChildren ? scope.id("list", pathKey(item.path)) : undefined,
          "aria-owns": item.hasChildren ? scope.id("list", pathKey(item.path)) : undefined,
          "aria-disabled": item.disabled,
          "data-value": item.path.join(","),
          "data-disabled": item.disabled ? "" : undefined,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-selected": state.selected ? "" : undefined,
          "data-depth": item.depth,
          "data-state": state.selected ? "checked" : "unchecked",
          "data-type": item.hasChildren ? "branch" : "leaf",
          "data-index-path": item.indexPath.join(","),
          ...itemHandlers(scope, item),
        };
      },
    },
    itemText: {
      indexes: (_context, props) =>
        levelsOf(collectionOf(props), (props["highlightedValue"] ?? []) as readonly string[])
          .flatMap((level) => level.items),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as CascadeItem);
        return `${state.highlighted} ${state.selected} ${state.disabled}`;
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as CascadeItem;
        const state = itemStateOf(scope, item);
        return {
          dir: scope.props["dir"],
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-state": state.selected ? "checked" : "unchecked",
          "data-disabled": item.disabled ? "" : undefined,
        };
      },
    },
    itemIndicator: {
      indexes: (_context, props) =>
        levelsOf(collectionOf(props), (props["highlightedValue"] ?? []) as readonly string[])
          .flatMap((level) => level.items),
      sig: (scope) => {
        const state = itemStateOf(scope, scope.slot as unknown as CascadeItem);
        return `${state.selected} ${state.highlighted} ${state.hasChildren}`;
      },
      attrs: (scope) => {
        const item = scope.slot as unknown as CascadeItem;
        const state = itemStateOf(scope, item);
        return {
          "aria-hidden": true,
          hidden: !state.selected,
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-type": state.hasChildren ? "branch" : "leaf",
          "data-state": state.selected ? "checked" : "unchecked",
        };
      },
    },
  },
  commands: {
    focus: { view: ({ focus }) => focus("trigger") },
    setOpen: {
      event: (args, context) => {
        void context;
        return { type: (args[0] as boolean) ? "OPEN" : "CLOSE" };
      },
    },
    setHighlightValue: {
      event: (args) => ({ type: "HIGHLIGHTED_VALUE_SET", value: [...(args[0] as readonly string[])] }),
    },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE_CLEAR" }) },
    setValue: {
      event: (args) => ({
        type: "VALUE_SET",
        value: (args[0] as readonly string[][]).map((path) => [...path]),
      }),
    },
    selectValue: {
      event: (args, context) => ({
        type: "ITEM_SELECT",
        value: [...(args[0] as readonly string[])],
        hasChildren: (context as unknown as Ctx).value.some((path) =>
          samePath(path, args[0] as readonly string[])),
      }),
    },
    clearValue: {
      event: (args) => args[0] === undefined
        ? ({ type: "VALUE_CLEAR" })
        : ({ type: "ITEM_CLEAR", value: [...(args[0] as readonly string[])] }),
    },
  },
  readers: {
    open: { read: (_context, state) => state === "open" },
    focused: { read: (_context, state) => state === "focused" },
    multiple: { read: (_context, _state, props) => (props["multiple"] as boolean) === true },
    disabled: {
      read: (_context, _state, props, root) =>
        (props["disabled"] as boolean) === true || (root !== undefined && fieldsetDisabled(root)),
    },
    value: { read: (context) => asCtx(context).value.map((path) => [...path]) },
    highlightedValue: { read: (context) => [...asCtx(context).highlightedValue] },
    hasSelectedItems: { read: (context) => asCtx(context).value.length > 0 },
    empty: { read: (context) => asCtx(context).value.length === 0 },
    levels: {
      read: (context, _state, props) =>
        levelsOf(collectionOf(props), asCtx(context).highlightedValue),
    },
  },
  methods: {
    getLevels: {
      call: (context, _state, _args, props) =>
        levelsOf(collectionOf(props), asCtx(context).highlightedValue),
    },
    getItems: {
      call: (_context, _state, args) => (args[0] as CascadeLevel).items,
    },
    getItemState: {
      call: (context, _state, args, props) => {
        const item = args[0] as CascadeItem;
        const highlight = (context as unknown as Ctx).highlightedValue;
        const selected = (context as unknown as Ctx).value.some((path) => samePath(path, item.path));
        const highlighted = item.path.every((segment, index) => segment === highlight[index]);
        const children = nodeAtPath(collectionOf(props), item.path)?.children ?? [];
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
      },
    },
    getValueText: {
      call: (context, _state, _args, props) => {
        const ctx = context as unknown as Ctx;
        const chains = ctx.value.map((path) => itemsAlongPath(collectionOf(props), path));
        const custom = props["formatValue"];
        if (typeof custom === "function") return (custom as CascadeFormatValue)(chains);
        if ((props["multiple"] as boolean) === true) {
          return chains.map((chain) => chain[chain.length - 1]?.label ?? "").join(", ");
        }
        return chains.map((chain) => chain.map((node) => node.label).join(" / ")).join(", ");
      },
    },
    getValueTextRows: {
      call: (context, _state, _args, props) => {
        const ctx = context as unknown as Ctx;
        const chains = ctx.value.map((path) => itemsAlongPath(collectionOf(props), path));
        const custom = props["formatValue"];
        let text: string;
        if (typeof custom === "function") text = (custom as CascadeFormatValue)(chains);
        else if ((props["multiple"] as boolean) === true) {
          text = chains.map((chain) => chain[chain.length - 1]?.label ?? "").join(", ");
        } else {
          text = chains.map((chain) => chain.map((node) => node.label).join(" / ")).join(", ");
        }
        return [{ value: text }];
      },
    },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched, _event, _props, context) => ({
        open: watched[0] as boolean,
        value: [...((context as Record<string, unknown> | undefined)?.["value"] as string[][] ?? [])],
      }),
    },
    "value-change": {
      prop: "onValueChange",
      watch: (context) => (asCtx(context).value as readonly string[][]).map((path) => pathKey(path)),
      detail: (watched, _event, props) => {
        const collection = collectionOf(props as Record<string, unknown>);
        const value = (watched as string[]).map((key) => key.split(pathKey([])));
        void value;
        return {
          value: (watched as string[]).map((key) => key.split(SEP)),
          items: (watched as string[]).map((key) => itemsAlongPath(collection, key.split(SEP))),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [pathKey(asCtx(context).highlightedValue)],
      detail: (watched, _event, props) => {
        const path = (watched[0] as string).length === 0 ? [] : (watched[0] as string).split(SEP);
        const collection = collectionOf(props as Record<string, unknown>);
        return {
          highlightedValue: [...path],
          highlightedItems: itemsAlongPath(collection, path),
        };
      },
    },
  },
};

export const cascade = defineComponent<CascadeContext, CascadeEvent, CascadeApi>(def);
