import {
  type ApiOf,
  ariaDisabled,
  ariaHidden,
  ariaLabelledBy,
  ariaOwns,
  coerceJsonArray,
  type ComponentDef,
  defineComponent,
  disclosureTrigger,
  isRecord,
  listSurface,
  optionRow,
  type ScopeFor,
  type SlotScopeFor,
} from "@spinjs/runtime";
import { cascade as cascadeMachine } from "./cascade.machine.ts";
import {
  type CascadeArgs,
  type CascadeContext,
  type CascadeState,
  parseCollection as parseCollectionState,
  parsePath,
  parsePaths,
  startOpen,
} from "./cascade.state.ts";
import type { CascadeEvents } from "./cascade.events.ts";

/**
 * Cascade-select definition: the DOM contract as data.
 *
 * The visible levels are a derivation: every node along the highlighted path
 * contributes its children as one level, so the level stack IS the
 * highlight.
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
  readonly depth: number;
  /** The parent's path, `[]` for the root level. */
  readonly path: readonly string[];
  readonly key: string;
  readonly items: readonly CascadeItem[];
}

/** A row of one level. Structural data only — state is read from context. */
export interface CascadeItem {
  readonly key: string;
  readonly path: readonly string[];
  readonly value: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly hasChildren: boolean;
  readonly depth: number;
  readonly indexInLevel: number;
  readonly indexPath: readonly number[];
}

/** Zag's `getItemState`: the derived row state the parts key on. */
export interface CascadeItemState {
  readonly value: readonly string[];
  readonly disabled: boolean;
  readonly highlighted: boolean;
  readonly selected: boolean;
  readonly hasChildren: boolean;
  readonly depth: number;
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

export type CascadeFormatValue = (
  items: readonly (readonly CascadeNode[])[],
) => string;

/** Path segments join with a comma in ids. */
const SEP = ",";

export const pathKey = (path: readonly string[]): string => path.join(SEP);

/** The collection crosses the prop channel as JSON text (the grammar has no
 *  recursive type), so it is parsed and validated here rather than trusted
 *  at every read. */
export const parseCollection = parseCollectionState;

const isString = (segment: unknown): segment is string =>
  typeof segment === "string";

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

/** The nodes along a path, one per level. */
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

export const hashValue = (value: readonly string[][]): string =>
  value.map((path) => path.join(",")).join(", ");

const itemAt = <T>(list: readonly T[], index: number): T | undefined =>
  index >= 0 && index < list.length ? list[index] : undefined;

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const samePaths = (a: readonly string[][], b: readonly string[][]): boolean =>
  a.length === b.length && a.every((path, i) => samePath(path, b[i] ?? []));

type ScopeLike = ScopeFor<CascadeContext, CascadeEvents, CascadeState>;
type SlotLike<R> = SlotScopeFor<R, CascadeContext, CascadeEvents, CascadeState>;

const isNode = (value: unknown): value is CascadeNode => {
  if (!isRecord(value)) return false;
  if (typeof value["value"] !== "string") return false;
  const children: unknown = value["children"];
  return children === undefined || Array.isArray(children);
};

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
    levels.push({
      depth,
      path,
      key: depth === 0 ? "root" : pathKey(path),
      items,
    });
    const segment = highlighted[depth];
    if (segment === undefined) break;
    const at = nodes.findIndex((node) => node.value === segment);
    const node = itemAt(nodes, at);
    const children = node?.children;
    if (node === undefined || children === undefined || children.length === 0) {
      break;
    }
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
  const ctx = scope.context;
  const highlight = ctx.highlightedValue;
  const selected = ctx.value.some((path) => samePath(path, item.path));
  // Zag's `highlighted`: every segment of the item's path matches the
  // highlight's, so an ancestor of the highlighted node is highlighted too
  // — that is what keeps its level open.
  const highlighted = item.path.every((segment, index) =>
    segment === highlight[index]
  );
  const children = nodeAtPath(scope.context.collection, item.path)?.children ??
    [];
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
    highlightedIndex: highlightedIndex === undefined || highlightedIndex < 0
      ? undefined
      : highlightedIndex,
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
  object,
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
      scope.send({
        type: "ITEM_CLICK",
        value: [...item.path],
        hasChildren: item.hasChildren,
      });
    },
    onPointerMove: (event: PointerEvent): void => {
      if (
        !isInteractive(scope) || item.disabled || event.pointerType !== "mouse"
      ) return;
      scope.send({
        type: "ITEM_POINTER_ENTER",
        value: [...item.path],
        hasChildren: item.hasChildren,
      });
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

const fieldsetDisabled = (root: () => Element): boolean => {
  const fieldset = root().closest("fieldset");
  return fieldset !== null && fieldset.hasAttribute("disabled");
};

const disabledOf = (scope: ScopeLike): boolean =>
  scope.context.disabled || fieldsetDisabled(scope.root);

const isInteractive = (scope: ScopeLike): boolean =>
  !(disabledOf(scope) || scope.context.readOnly);

const highlightPath = (scope: ScopeLike, path: readonly string[]): void => {
  scope.send({ type: "HIGHLIGHTED_VALUE_SET", value: [...path] });
};

/** The rows of the level holding `path`: its parent's children. */
const siblingsOf = (
  scope: ScopeLike,
  path: readonly string[],
): readonly CascadeItem[] => {
  const level = levelsOf(
    scope.context.collection,
    scope.context.highlightedValue,
  )
    .find((candidate) => samePath(candidate.path, path.slice(0, -1)));
  return level === undefined ? [] : level.items;
};

const rootEdge = (
  scope: ScopeLike,
  edge: "first" | "last",
): CascadeItem | undefined => {
  const level = levelsOf(
    scope.context.collection,
    scope.context.highlightedValue,
  )
    .find((candidate) => candidate.depth === 0);
  const items = level === undefined ? [] : level.items;
  return edge === "first"
    ? items.find((item) => !item.disabled)
    : [...items].reverse().find((item) => !item.disabled);
};

const levelEdge = (
  scope: ScopeLike,
  edge: "first" | "last",
): CascadeItem | undefined => {
  const items = siblingsOf(scope, scope.context.highlightedValue);
  return edge === "first"
    ? items.find((item) => !item.disabled)
    : [...items].reverse().find((item) => !item.disabled);
};

const moveHighlight = (scope: ScopeLike, delta: number): void => {
  const items = siblingsOf(scope, scope.context.highlightedValue);
  const at = items.findIndex((item) =>
    samePath(item.path, scope.context.highlightedValue)
  );
  // Zag's `not(hasHighlightedValue)` branch: an edge is picked regardless of
  // loopFocus, because there is no current row to wrap from.
  if (at === -1) {
    const end = delta > 0
      ? items.find((item) => !item.disabled)
      : [...items].reverse().find((item) => !item.disabled);
    if (end !== undefined) highlightPath(scope, end.path);
    return;
  }
  const loop = scope.context.loopFocus;
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

const enterChild = (scope: ScopeLike): void => {
  const path = scope.context.highlightedValue;
  const children = nodeAtPath(scope.context.collection, path)?.children ?? [];
  if (path.length === 0 || children.length === 0) return;
  const child = children.find((node) => node.disabled !== true);
  if (child !== undefined) highlightPath(scope, [...path, child.value]);
};

/** Leaving at the root level closes with focus back on the trigger. */
const leaveChild = (scope: ScopeLike): void => {
  const path = scope.context.highlightedValue;
  if (path.length <= 1) {
    scope.send({ type: "CLOSE", restoreFocus: true });
    return;
  }
  highlightPath(scope, path.slice(0, -1));
};

const selectHighlighted = (scope: ScopeLike): void => {
  const path = scope.context.highlightedValue;
  const item = itemByPath(scope.context.collection, path, path);
  if (item === undefined) return;
  if (!scope.context.allowParentSelection && item.hasChildren) return;
  scope.send({
    type: "ITEM_CLICK",
    value: [...path],
    hasChildren: item.hasChildren,
  });
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const isExcludedTarget = (
  scope: ScopeLike,
  target: EventTarget | null,
): boolean => {
  if (!(target instanceof Element)) return false;
  const host = scope.root();
  if (typeof host.querySelector !== "function") return false;
  for (const part of ["trigger", "clearTrigger"] as const) {
    const node = host.querySelector(`[id="${scope.id(part)}"]`);
    if (node !== null && node instanceof Element && node.contains(target)) {
      return true;
    }
  }
  return false;
};

const focusableTarget = (target: unknown): boolean =>
  target instanceof Element && target.matches(FOCUSABLE);

type HostEventFn = (event: PointerEvent | FocusEvent) => void;

const isEventFn = (value: unknown): value is HostEventFn =>
  typeof value === "function";

type HostInteractFn = (details: CascadeOutsideDetails) => void;

const isInteractFn = (value: unknown): value is HostInteractFn =>
  typeof value === "function";

const callInteract = (fn: unknown, details: CascadeOutsideDetails): void => {
  if (!isInteractFn(fn)) return;
  fn(details);
};

const callHost = (fn: unknown, event: PointerEvent | FocusEvent): void => {
  if (!isEventFn(fn)) return;
  fn(event);
};

const reportOutside = (
  scope: ScopeLike,
  kind: "pointer" | "focus",
  event: PointerEvent | FocusEvent,
  contextmenu: boolean,
): void => {
  const focusable = focusableTarget(event.target);
  if (kind === "pointer") callHost(scope.context.onPointerDownOutside, event);
  else callHost(scope.context.onFocusOutside, event);
  callInteract(scope.context.onInteractOutside, {
    focusable,
    contextmenu,
    originalEvent: event,
  });
};

const dismissSelf = (scope: ScopeLike, restoreFocus: boolean): void => {
  // Zag's focusTriggerEl honors restoreFocusFn; the machine's `focused`
  // target is the same decision.
  scope.send({ type: "CLOSE", restoreFocus });
};

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented || !isInteractive(scope)) return;
  const forward = scope.context.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = scope.context.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  const openWithEdge = (end: "first" | "last"): void => {
    const target = rootEdge(scope, end);
    scope.send({
      type: "TRIGGER_OPEN",
      highlight: target === undefined ? [] : [...target.path],
    });
  };
  const openPlain = (): void => {
    scope.send({ type: "TRIGGER_OPEN", highlight: [] });
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
  const forward = scope.context.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = scope.context.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
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

/** The readout text: labels along each path, one selection per entry. */
const textFor = (context: CascadeContext): string => {
  const chains = context.value.map((path) =>
    itemsAlongPath(context.collection, path)
  );
  const custom: unknown = context.formatValue;
  if (typeof custom === "function") return formatWith(custom, chains);
  if (context.multiple) {
    return chains.map((chain) => chain[chain.length - 1]?.label ?? "").join(
      ", ",
    );
  }
  return chains.map((chain) => chain.map((node) => node.label).join(" / "))
    .join(", ");
};

const valueAsString = (scope: ScopeLike): string => textFor(scope.context);

/** A host readout formatter: functions cannot cross the scope channel, so
 * the shape is checked at the call — anything else is the default text. */
type HostFormatFn = (items: readonly (readonly CascadeNode[])[]) => unknown;

const isFormatFn = (value: unknown): value is HostFormatFn =>
  typeof value === "function";

const formatWith = (
  custom: unknown,
  chains: readonly (readonly CascadeNode[])[],
): string => {
  if (!isFormatFn(custom)) return "";
  const out: unknown = custom(chains);
  return typeof out === "string" ? out : "";
};

type HostScrollFn = (details: CascadeScrollDetails) => void;

const isScrollFn = (value: unknown): value is HostScrollFn =>
  typeof value === "function";

const callScroll = (custom: unknown, details: CascadeScrollDetails): void => {
  if (!isScrollFn(custom)) return;
  custom(details);
};

const propText = (raw: unknown): string => typeof raw === "string" ? raw : "";

const levelOf = (arg: unknown): CascadeLevel => {
  if (!isRecord(arg)) return { depth: 0, path: [], key: "root", items: [] };
  const items: unknown = arg["items"];
  const depth: unknown = arg["depth"];
  const path: unknown = arg["path"];
  return {
    depth: typeof depth === "number" ? depth : 0,
    path: Array.isArray(path) &&
        path.every((p): p is string => typeof p === "string")
      ? path
      : [],
    key: typeof arg["key"] === "string" ? arg["key"] : "root",
    items: Array.isArray(items) ? items.filter(isCascadeItem) : [],
  };
};

const isCascadeItem = (value: unknown): value is CascadeItem => {
  if (!isRecord(value)) return false;
  return typeof value["value"] === "string" && Array.isArray(value["path"]);
};

const itemOf = (arg: unknown): CascadeItem => {
  if (isCascadeItem(arg)) {
    const depth: unknown = arg["depth"];
    const indexInLevel: unknown = arg["indexInLevel"];
    const indexPath: unknown = arg["indexPath"];
    return {
      key: typeof arg["key"] === "string" ? arg["key"] : "",
      path: arg["path"].filter((p): p is string => typeof p === "string"),
      value: arg["value"],
      label: typeof arg["label"] === "string" ? arg["label"] : "",
      disabled: arg["disabled"] === true,
      hasChildren: arg["hasChildren"] === true,
      depth: typeof depth === "number" ? depth : 0,
      indexInLevel: typeof indexInLevel === "number" ? indexInLevel : 0,
      indexPath: Array.isArray(indexPath) && indexPath.every((n): n is number =>
          typeof n === "number"
        )
        ? indexPath
        : [],
    };
  }
  return {
    key: "",
    path: [],
    value: "",
    label: "",
    disabled: false,
    hasChildren: false,
    depth: 0,
    indexInLevel: 0,
    indexPath: [],
  };
};

/** Zag's `scrollToIndexFn`: a host that scrolls its own content supplies the
 *  how (with the active row's position in its level), the reflex still owns
 *  the when. */
const scrollParam = (
  scope: ScopeLike,
): { readonly activeId: () => string; readonly reveal?: () => void } => {
  const activeId = (): string => {
    const highlighted = scope.context.highlightedValue;
    return highlighted.length === 0
      ? ""
      : scope.id("item", pathKey(highlighted));
  };
  const custom = scope.context.scrollToIndexFn;
  if (typeof custom !== "function") return { activeId };
  return {
    activeId,
    reveal: (): void => {
      const path = scope.context.highlightedValue;
      const level = levelsOf(scope.context.collection, path)
        .find((candidate) => samePath(candidate.path, path.slice(0, -1)));
      const at = level === undefined
        ? -1
        : level.items.findIndex((item) => samePath(item.path, path));
      callScroll(custom, {
        index: at < 0 ? 0 : at,
        immediate: true,
        depth: level === undefined ? 0 : level.depth,
      });
    },
  };
};

export const def = {
  name: "cascade",
  machine: (args: CascadeArgs, authored: (name: string) => boolean) =>
    cascadeMachine(args, authored),
  settled: ({ event, before, after, focus }: {
    readonly event: { readonly type: string } & Record<string, unknown>;
    readonly before: {
      readonly context: CascadeContext;
      readonly state: CascadeState;
    };
    readonly after: {
      readonly context: CascadeContext;
      readonly state: CascadeState;
    };
    readonly focus: (part: string, slot?: unknown) => void;
  }) => {
    if (after.state === "open" && before.state !== "open") focus("content");
    if (event.type === "CLOSE" && event.restoreFocus === true) focus("trigger");
    if (event.type === "CLEAR_TRIGGER_CLICK") focus("trigger");
  },
  start: (raw) => (startOpen(raw) ? "open" : "idle"),
  reconcile: ({ context, parsed, authored, send, state }) => {
    // The host owns the panel when it authored `open`: the machine follows
    // the prop, and the machine's own move is what reports it. The panel's
    // visibility is state, not a context field, so it stays out of the
    // machine's contract.
    if (authored("open")) {
      const outer = parsed["open"] === true;
      const open = state === "open";
      if (open !== outer) {
        send(
          outer ? { type: "CONTROLLED_OPEN" } : { type: "CONTROLLED_CLOSE" },
        );
        return true;
      }
    }
    let moved = false;
    const nextCollection = parseCollectionState(parsed["collection"]);
    if (nextCollection !== context.collection) {
      context.collection = nextCollection;
      moved = true;
    }
    const invalid = parsed["invalid"] === true;
    if (context.invalid !== invalid) {
      context.invalid = invalid;
      moved = true;
    }
    // Host callbacks ride the element, not the authored channel: sync them
    // whenever present so reports fire even when the host never declared them.
    for (
      const name of [
        "onFocusOutside",
        "onInteractOutside",
        "onPointerDownOutside",
        "scrollToIndexFn",
        "formatValue",
      ] as const
    ) {
      const next = parsed[name];
      if (
        next !== undefined &&
        (context as unknown as Record<string, unknown>)[name] !== next
      ) {
        (context as unknown as Record<string, unknown>)[name] = next;
        moved = true;
      }
    }
    return moved;
  },
  parts: {
    root: {
      attrs: (scope: ScopeLike) => ({
        // The bare namespace: the root part carries no suffix, so
        // owner-scoped lookups never collide with a part name.
        dir: scope.context.dir,
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-invalid": scope.attr(scope.context.invalid),
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        htmlFor: scope.id("hiddenInput"),
        // Zag's label click focuses the trigger: the label's own target is
        // a hidden input, which cannot take focus.
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented || !isInteractive(scope)) return;
          scope.send({ type: "TRIGGER_FOCUS" });
        },
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-focus": scope.attr(scope.state === "focused"),
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    trigger: {
      attrs: (scope: ScopeLike) => ({
        type: "button",
        role: "combobox",
        dir: scope.context.dir,
        "data-focus": scope.attr(scope.state === "focused"),
        ...disclosureTrigger(scope, {
          expanded: scope.state === "open",
          hasPopup: "listbox",
          controls: { part: "content" },
        }),
        ...ariaLabelledBy(scope, { part: "label" }),
        disabled: disabledOf(scope),
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented || !isInteractive(scope)) return;
          scope.send({ type: "TRIGGER_CLICK" });
        },
        onFocus: (): void => scope.send({ type: "TRIGGER_FOCUS" }),
        onBlur: (): void => scope.send({ type: "TRIGGER_BLUR" }),
        onKeydown: (event: KeyboardEvent): void =>
          onTriggerKeydown(scope, event),
        "data-state": scope.state === "open" ? "open" : "closed",
        "data-placement": scope.context.placement,
        "data-placeholder-shown": scope.attr(scope.context.value.length === 0),
        "data-readonly": scope.attr(scope.context.readOnly),
        "data-invalid": scope.attr(scope.context.invalid),
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    indicator: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        ...ariaHidden(true),
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    valueText: {
      id: "value-text",
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    clearTrigger: {
      id: "clear-trigger",
      attrs: (scope: ScopeLike) => ({
        type: "button",
        dir: scope.context.dir,
        "aria-label": "Clear value",
        hidden: scope.context.value.length === 0,
        disabled: disabledOf(scope),
        onClick: (event: MouseEvent): void => {
          if (event.defaultPrevented) return;
          scope.send({ type: "CLEAR_TRIGGER_CLICK" });
        },
        "data-state": scope.state === "open" ? "open" : "closed",
        ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
      }),
    },
    // Not memoized: the geometry is a measurement, so the bag is rebuilt
    // per read and the style object re-applies the trigger's width as the
    // trigger moves.
    positioner: {
      attrs: (scope: ScopeLike) => {
        const rect = scope.measure("trigger");
        return {
          dir: scope.context.dir,
          "data-placement": scope.context.placement,
          "data-side": scope.context.placement.split("-")[0] ?? "bottom",
          // The panel is as wide as the trigger: the measurement rides the
          // bag's style object, and the markup names no property.
          style: {
            minWidth: rect === null ? "100%" : `${rect.width}px`,
          },
          "data-state": scope.state === "open" ? "open" : "closed",
          ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        };
      },
    },
    content: {
      attrs: (scope) => {
        const highlighted = scope.context.highlightedValue;
        return {
          role: "listbox",
          dir: scope.context.dir,
          ...listSurface(scope, {
            labelledBy: { part: "label" },
            activeDescendant: highlighted.length === 0
              ? undefined
              : { part: "item", slot: pathKey(highlighted) },
            multiSelectable: scope.context.multiple,
            required: scope.context.required,
            readOnly: scope.context.readOnly,
          }),
          "data-activedescendant": highlighted.length === 0
            ? undefined
            : scope.id("item", pathKey(highlighted)),
          hidden: scope.state !== "open",
          tabIndex: 0,
          onKeydown: (event: KeyboardEvent): void =>
            onContentKeydown(scope, event),
          onFocusOut: (event: FocusEvent): void =>
            onContentFocusOut(scope, event),
          "use:dismissable": {
            onOutside: (event: PointerEvent): void => {
              // The trigger and the clear button are this component's own
              // gestures: a press on them is a toggle, not a dismissal.
              if (isExcludedTarget(scope, event.target)) return;
              reportOutside(scope, "pointer", event, event.button === 2);
              dismissSelf(
                scope,
                !(focusableTarget(event.target) || event.button === 2),
              );
            },
            onEscape: (): void => dismissSelf(scope, true),
          },
          "use:scroll-into-view": scrollParam(scope),
          "data-state": scope.state === "open" ? "open" : "closed",
          ...(disabledOf(scope) ? { "data-disabled": "" } : {}),
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      attrs: (scope: ScopeLike) => ({
        ...(typeof scope.context.name === "string" &&
            scope.context.name.length > 0
          ? { name: scope.context.name }
          : {}),
        ...(typeof scope.context.form === "string" &&
            scope.context.form.length > 0
          ? { form: scope.context.form }
          : {}),
        disabled: disabledOf(scope),
        required: scope.context.required,
        readOnly: scope.context.readOnly,
        hidden: true,
        ...ariaHidden(true),
        ...ariaLabelledBy(scope, { part: "label" }),
        value: hashValue(scope.context.value),
      }),
    },
  },
  slots: {
    list: {
      indexes: (context: CascadeContext) =>
        levelsOf(context.collection, context.highlightedValue),
      attrs: (scope: SlotLike<CascadeLevel>) => {
        const level = scope.slot;
        return {
          // The list id is the parent's value path, comma-joined — the same
          // spelling the item's id uses, so a branch's aria-controls resolves.
          id: scope.id("list", level.path.join(",")),
          dir: scope.context.dir,
          role: "group",
          "data-depth": level.depth,
          ...optionRow({ level: level.depth }),
        };
      },
    },
    item: {
      indexes: (context: CascadeContext) =>
        levelsOf(context.collection, context.highlightedValue)
          .flatMap((level) => level.items),
      attrs: (scope: SlotLike<CascadeItem>) => {
        const item = scope.slot;
        const state = itemStateOf(scope, item);
        return {
          id: scope.id("item", pathKey(item.path)),
          role: "treeitem",
          dir: scope.context.dir,
          ...disclosureTrigger(scope, {
            expanded: item.hasChildren ? state.highlighted : false,
            hasPopup: item.hasChildren ? "menu" : undefined,
            controls: item.hasChildren
              ? { part: "list", slot: pathKey(item.path) }
              : undefined,
          }),
          ...ariaOwns(
            scope,
            item.hasChildren
              ? { part: "list", slot: pathKey(item.path) }
              : undefined,
          ),
          ...ariaDisabled(item.disabled),
          "data-value": item.path.join(","),
          "data-disabled": item.disabled ? "" : undefined,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-selected": state.selected ? "" : undefined,
          "data-depth": item.depth,
          "data-type": item.hasChildren ? "branch" : "leaf",
          "data-index-path": item.indexPath.join(","),
          ...itemHandlers(scope, item),
        };
      },
    },
    itemText: {
      indexes: (context: CascadeContext) =>
        levelsOf(context.collection, context.highlightedValue)
          .flatMap((level) => level.items),
      attrs: (scope: SlotLike<CascadeItem>) => {
        const item = scope.slot;
        const state = itemStateOf(scope, item);
        return {
          dir: scope.context.dir,
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-selected": state.selected ? "" : undefined,
          "data-disabled": item.disabled ? "" : undefined,
        };
      },
    },
    itemIndicator: {
      indexes: (context: CascadeContext) =>
        levelsOf(context.collection, context.highlightedValue)
          .flatMap((level) => level.items),
      attrs: (scope: SlotLike<CascadeItem>) => {
        const item = scope.slot;
        const state = itemStateOf(scope, item);
        return {
          ...ariaHidden(true),
          hidden: !state.selected,
          "data-value": item.value,
          "data-highlighted": state.highlighted ? "" : undefined,
          "data-type": state.hasChildren ? "branch" : "leaf",
          "data-selected": state.selected ? "" : undefined,
        };
      },
    },
  },
  commands: {
    focus: { view: ({ focus }) => focus("trigger") },
    setOpen: {
      event: (args) => ({ type: args[0] === true ? "OPEN" : "CLOSE" }),
    },
    setHighlightValue: {
      event: (args) => ({
        type: "HIGHLIGHTED_VALUE_SET",
        value: [...parsePath(args[0])],
      }),
    },
    clearHighlightValue: { event: () => ({ type: "HIGHLIGHTED_VALUE_CLEAR" }) },
    setValue: {
      event: ([value]: [value: readonly string[][]]) => ({
        type: "VALUE_SET" as const,
        value: value.map((path) => [...path]),
      }),
    },
    selectValue: {
      event: (args, context: CascadeContext) => {
        const value = [...parsePath(args[0])];
        return {
          type: "ITEM_SELECT",
          value,
          hasChildren: context.value.some((path) => samePath(path, value)),
        };
      },
    },
    clearValue: {
      event: (args) =>
        args[0] === undefined
          ? ({ type: "VALUE_CLEAR" })
          : ({ type: "ITEM_CLEAR", value: [...parsePath(args[0])] }),
    },
  },
  readers: {
    open: { read: (_context, state) => state === "open" },
    focused: { read: (_context, state) => state === "focused" },
    multiple: { read: (context) => context.multiple },
    disabled: {
      read: (context, _state, _props, root) =>
        context.disabled || (root !== undefined && fieldsetDisabled(root)),
    },
    value: { read: (context) => context.value.map((path) => [...path]) },
    highlightedValue: { read: (context) => [...context.highlightedValue] },
    hasSelectedItems: { read: (context) => context.value.length > 0 },
    empty: { read: (context) => context.value.length === 0 },
    levels: {
      read: (context, _state, props) =>
        levelsOf(context.collection, context.highlightedValue),
    },
  },
  methods: {
    getLevels: {
      call: (
        context: CascadeContext,
        _state,
        _args,
        props,
      ): readonly CascadeLevel[] =>
        levelsOf(context.collection, context.highlightedValue),
    },
    getItems: {
      call: (
        _context: CascadeContext,
        _state: CascadeState,
        [level]: [level: CascadeLevel],
      ): readonly CascadeItem[] => levelOf(level).items,
    },
    getItemState: {
      call: (
        context: CascadeContext,
        _state,
        [item]: [item: CascadeItem],
      ): CascadeItemState => {
        const highlight = context.highlightedValue;
        const selected = context.value.some((path) =>
          samePath(path, item.path)
        );
        const highlighted = item.path.every((segment, index) =>
          segment === highlight[index]
        );
        const children = nodeAtPath(context.collection, item.path)?.children ??
          [];
        const childSegment = highlighted
          ? highlight[item.depth + 1]
          : undefined;
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
          highlightedIndex:
            highlightedIndex === undefined || highlightedIndex < 0
              ? undefined
              : highlightedIndex,
        };
      },
    },
    getValueText: {
      call: (context: CascadeContext, _state, _args, _props): string =>
        textFor(context),
    },
    getValueTextRows: {
      call: (
        context: CascadeContext,
        _state,
        _args,
        _props,
      ): readonly { readonly value: string }[] => [{ value: textFor(context) }],
    },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched, _event, _props, context: CascadeContext) => ({
        open: watched[0] === true,
        value: context.value.map((path) => [...path]),
      }),
    },
    "value-change": {
      prop: "onValueChange",
      watch: (context: CascadeContext) =>
        context.value.map((path) => pathKey(path)),
      detail: (
        watched: readonly unknown[],
        _event,
        _props,
        context: CascadeContext,
      ) => {
        const keys = watched.filter((key): key is string =>
          typeof key === "string"
        );
        const collection = context.collection;
        return {
          value: keys.map((key) => key.split(SEP)),
          items: keys.map((key) => itemsAlongPath(collection, key.split(SEP))),
        };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context: CascadeContext) => [pathKey(context.highlightedValue)],
      detail: (
        watched: readonly unknown[],
        _event,
        _props,
        context: CascadeContext,
      ) => {
        const key = watched[0];
        const path = typeof key === "string" && key.length > 0
          ? key.split(SEP)
          : [];
        const collection = context.collection;
        return {
          highlightedValue: [...path],
          highlightedItems: itemsAlongPath(collection, path),
        };
      },
    },
  },
} satisfies ComponentDef<
  CascadeContext,
  CascadeEvents,
  Record<string, unknown>,
  CascadeArgs,
  CascadeState
>;

export type CascadeApi = ApiOf<typeof def>;
export const cascade = defineComponent<
  CascadeContext,
  CascadeEvents,
  CascadeApi,
  CascadeArgs,
  CascadeState
>(def);
