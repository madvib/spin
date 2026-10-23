import { ariaDisabled, ariaInvalid, defineComponent, isRecord, liveRegion, machineTick, type ApiOf, type ComponentDef, type ScopeFor, type SlotScopeFor } from "@spin/runtime";
import {
  type TagsArgs,
  type TagsContext,
  type TagsLog,
  type TagsState,
} from "./tags.state.ts";
import type { TagsEvents } from "./tags.events.ts";
import { tags as tagsMachine } from "./tags.machine.ts";

export interface TagsTranslations {
  readonly clearTriggerLabel: string;
  readonly deleteTagTriggerLabel: (value: string) => string;
  readonly tagAdded: (value: string) => string;
  readonly tagEdited: (value: string) => string;
  readonly tagUpdated: (value: string) => string;
  readonly tagDeleted: (value: string) => string;
  readonly tagSelected: (value: string) => string;
  readonly tagsPasted: (values: readonly string[]) => string;
  readonly noTagsSelected: string;
}

/**
 * Tags-input definition: the DOM contract as data.
 *
 * Rows are occurrence-keyed: duplicate values render twice.
 */

export type {
  TagsHighlightChange,
  TagsInputValueChange,
  TagsValueChange,
  TagsValueInvalid,
} from "./tags.events.ts";

export interface TagsCommands {
  setValue(value: readonly string[]): void;
  addValue(value: string): void;
  setValueAtIndex(index: number, value: string): void;
  clearValue(id?: string | number): void;
  setInputValue(value: string): void;
  clearInputValue(): void;
  focus(): void;
}

export interface TagsRow {
  readonly value: string;
  readonly occurrence: number;
}

export interface TagsItemState {
  readonly id: string;
  readonly index: number;
  readonly editing: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

const defaultTranslations: TagsTranslations = {
  clearTriggerLabel: "Clear all tags",
  deleteTagTriggerLabel: (value: string) => `Delete tag ${value}`,
  tagAdded: (value: string) => `Added tag ${value}`,
  tagEdited: (value: string) =>
    `Editing tag ${value}. Press enter to save or escape to cancel.`,
  tagUpdated: (value: string) => `Tag update to ${value}`,
  tagDeleted: (value: string) => `Tag ${value} deleted`,
  tagSelected: (value: string) =>
    `Tag ${value} selected. Press enter to edit, delete or backspace to remove.`,
  tagsPasted: (values: readonly string[]) => `Pasted ${values.length} tags`,
  noTagsSelected: "No tags selected",
};

type HostFn = (...args: readonly unknown[]) => unknown;

const isHostFn = (value: unknown): value is HostFn =>
  typeof value === "function";

/** Whether the window holds focus: a window blur leaves the field alone
 * (Zag reports nothing), a label-click blur ends the edit. */
const windowFocused = (): boolean => {
  if (typeof document === "undefined") return true;
  if (typeof document.hasFocus !== "function") return true;
  return document.hasFocus();
};

const textOf = (raw: unknown, fallback = ""): string =>
  typeof raw === "string" ? raw : fallback;

const callHostFn = (fn: unknown, event: PointerEvent | FocusEvent): void => {
  if (!isHostFn(fn)) return;
  fn(event);
};

/** Whether the caret sits at the start of the entry field: arrows and
 * delete then move between tags instead of text. Falls back to the entry
 * input in the owned root, since a synthetic event carries no target. */
const caretAtStart = (scope: ScopeLike, target: EventTarget | null): boolean => {
  const at = (node: unknown): boolean => {
    if (!isRecord(node)) return false;
    return node["selectionStart"] === 0 && node["selectionEnd"] === 0;
  };
  if (at(target)) return true;
  const host = scope.root();
  if (typeof host.querySelector !== "function") return false;
  return at(host.querySelector(`[id="${scope.id("input")}"]`));
};

/** Host behavioral props live on the element, not the scope: the scope
 * grammar has no function type. Read through the owned root, never the
 * global document. */
const hostProp = (scope: HostScope, name: string): unknown => {
  const root: unknown = scope.root();
  if (!isRecord(root)) return undefined;
  const found: unknown = root[name];
  return found === undefined ? (scope.context as unknown as Record<string, unknown>)[name] : found;
};

interface HostScope {
  readonly context: TagsContext;
  readonly root: () => Element;
}

const translationsOf = (scope: HostScope): TagsTranslations => {
  const fromRoot: unknown = hostProp(scope, "translations");
  if (fromRoot !== undefined) return parseTranslations(fromRoot);
  const raw: unknown = scope.context.translations;
  return typeof raw === "function" || isRecord(raw) ? parseTranslations(raw) : defaultTranslations;
};

const hostFnOf = (scope: HostScope, name: string): HostFn | undefined => {
  const value: unknown = hostProp(scope, name);
  return isHostFn(value) ? value : undefined;
};

function parseTranslations(raw: unknown): TagsTranslations {
  if (!isRecord(raw)) return defaultTranslations;
  const text = (name: string, fallback: string): string => {
    const value: unknown = raw[name];
    return typeof value === "string" ? value : fallback;
  };
  const fn1 = (name: string, fallback: (value: string) => string): ((value: string) => string) => {
    const value: unknown = raw[name];
    if (!isHostFn(value)) return fallback;
    return (arg: string): string => {
      const out: unknown = value(arg);
      return typeof out === "string" ? out : fallback(arg);
    };
  };
  const pasted: unknown = raw["tagsPasted"];
  return {
    clearTriggerLabel: text("clearTriggerLabel", defaultTranslations.clearTriggerLabel),
    deleteTagTriggerLabel: fn1("deleteTagTriggerLabel", defaultTranslations.deleteTagTriggerLabel),
    tagAdded: fn1("tagAdded", defaultTranslations.tagAdded),
    tagEdited: fn1("tagEdited", defaultTranslations.tagEdited),
    tagUpdated: fn1("tagUpdated", defaultTranslations.tagUpdated),
    tagDeleted: fn1("tagDeleted", defaultTranslations.tagDeleted),
    tagSelected: fn1("tagSelected", defaultTranslations.tagSelected),
    tagsPasted: isHostFn(pasted)
      ? (values: readonly string[]): string => {
        const out: unknown = pasted(values);
        return typeof out === "string" ? out : defaultTranslations.tagsPasted(values);
      }
      : defaultTranslations.tagsPasted,
    noTagsSelected: text("noTagsSelected", defaultTranslations.noTagsSelected),
  };
}

type ScopeLike = ScopeFor<TagsContext, TagsEvents, TagsState>;
type SlotLike<R> = SlotScopeFor<R, TagsContext, TagsEvents, TagsState>;

/**
 * One row object per logical tag, reused across value changes: a `for` cell
 * holds the row it captured, so a rebuilt object would leave it rendering
 * the previous tag's state. Memoized on the value array's identity.
 */
const rowsCache = new WeakMap<readonly string[], readonly TagsRow[]>();
const rowsOf = (value: readonly string[]): readonly TagsRow[] => {
  const hit = rowsCache.get(value);
  if (hit !== undefined) return hit;
  const counts = new Map<string, number>();
  const built: TagsRow[] = [];
  for (const item of value) {
    const occurrence = counts.get(item) ?? 0;
    counts.set(item, occurrence + 1);
    built.push({ value: item, occurrence });
  }
  rowsCache.set(value, built);
  return built;
};

const tagIdOf = (id: (part: string, slot?: unknown) => string, row: TagsRow): string =>
  `${id("tag")}:${row.value}:${row.occurrence}`;

const rowOf = (arg: unknown): TagsRow => {
  if (!isRecord(arg)) return { value: "", occurrence: 0 };
  const value: unknown = arg["value"];
  const occurrence: unknown = arg["occurrence"];
  return {
    value: typeof value === "string" ? value : "",
    occurrence: typeof occurrence === "number" ? occurrence : 0,
  };
};

const indexOfRow = (context: TagsContext, row: TagsRow): number => {
  const value = context.value;
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== row.value) continue;
    if (seen === row.occurrence) return i;
    seen++;
  }
  return -1;
};

const itemStateOf = (
  context: TagsContext,
  state: string,
  disabled: boolean,
  id: (part: string, slot?: unknown) => string,
  row: TagsRow,
): TagsItemState => {
  const index = indexOfRow(context, row);
  const editing = state === "editing:tag" && context.editedIndex === index;
  return {
    id: tagIdOf(id, row),
    index,
    editing,
    highlighted: context.highlightedIndex === index,
    disabled,
  };
};
const stateOf = (scope: ScopeLike, row: TagsRow): TagsItemState =>
  itemStateOf(scope.context, scope.state, scope.context.disabled, scope.id, row);

/** Whether a node belongs to a tag part, so a press on a tag is not read
 * as a press outside the input. */
const withinTag = (scope: ScopeLike, node: unknown): boolean => {
  if (!(node instanceof Element)) return false;
  const host = scope.root();
  const prefix = `${scope.id("tag")}:`;
  let at: Element | null = node;
  while (at !== null) {
    if (at.id.startsWith(prefix)) return true;
    if (at === host) return false;
    at = at.parentElement;
  }
  return false;
};

const invalidOf = (scope: ScopeLike): boolean => {
  const context = scope.context;
  return scope.context.invalid === true || context.value.length > context.max;
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. Keyed by the
 * bridge's own send fn, so two bridges sharing one collection never share
 * handlers. */
type TagHandlerSet = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onDblclick: () => void;
  readonly onDeleteClick: (event: MouseEvent) => void;
  readonly onDeletePointerDown: (event: PointerEvent) => void;
};
const tagHandlersByBridge = new WeakMap<object, WeakMap<TagsRow, TagHandlerSet>>();
const tagHandlers = (scope: ScopeLike, row: TagsRow): TagHandlerSet => {
  let byRow = tagHandlersByBridge.get(scope.send);
  if (byRow === undefined) {
    byRow = new WeakMap();
    tagHandlersByBridge.set(scope.send, byRow);
  }
  const hit = byRow.get(row);
  if (hit !== undefined) return hit;
  const made: TagHandlerSet = {
    onPointerDown: (event: PointerEvent): void => {
      const context = scope.context;
      if (scope.context.readOnly || scope.context.disabled) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "POINTER_DOWN_TAG", index });
    },
    onDblclick: (): void => {
      const context = scope.context;
      if (scope.context.readOnly || scope.context.disabled) return;
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "DOUBLE_CLICK_TAG", index });
    },
    onDeleteClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      const context = scope.context;
      if (scope.context.readOnly || scope.context.disabled) return;
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "CLICK_DELETE_TAG", index });
    },
    // The delete trigger is inside the preview: pressing it must not also
    // highlight the tag. When inert it only swallows the press, so the
    // click that follows never fires.
    onDeletePointerDown: (event: PointerEvent): void => {
      if (event.button !== 0) return;
      if (!scope.context.readOnly && !scope.context.disabled) return;
      event.preventDefault();
    },
  };
  byRow.set(row, made);
  return made;
};

const message = (log: TagsLog, prev: TagsLog | null, t: TagsTranslations): string => {
  switch (log.type) {
    case "add":
      return t.tagAdded(log.value);
    case "delete":
      return t.tagDeleted(log.value);
    case "update":
      return t.tagUpdated(log.value);
    case "paste":
      return t.tagsPasted(log.values);
    case "clear":
      return t.noTagsSelected;
    case "select": {
      const head = prev !== null && prev.type === "delete"
        ? t.tagDeleted(prev.value)
        : prev !== null && prev.type === "update"
        ? t.tagUpdated(prev.value)
        : null;
      const body = t.tagSelected(log.value);
      return head === null ? body : `${head}. ${body}`;
    }
  }
};

type IdFn = (part: string, slot?: unknown) => string;

/** Announced by swapping the region node for a fresh clone: a new node in
 * the live tree is a mutation a screen reader reads even when the message
 * repeats, which rewriting the same node's text would not be. Scoped to
 * the owned root — never the global document. */
const rootByBridge = new WeakMap<IdFn, Element>();
const rememberRoot = (id: IdFn, root: Element): void => {
  rootByBridge.set(id, root);
};

/** Sync the element's host functions into context, silently and pre-send:
 * commands run before their event transmits, so assigns read fresh host
 * behavior on the very send that needs it. Bag sends sync in settled
 * instead (post-send, silent) — one send behind, which beats never. The
 * check is against the raw fn: a wrapper is fresh per sync. */
const syncHostFns = (context: TagsContext, id: (part: string, slot?: unknown) => string): void => {
  const root = rootByBridge.get(id);
  if (root === undefined) return;
  const seen = seenOf(id);
  const scope: HostScope = { context: context as unknown as TagsContext, root: () => root };
  const sanitize = hostFnOf(scope, "sanitizeValue");
  if (sanitize !== undefined && seen.sanitize !== sanitize) {
    seen.sanitize = sanitize;
    const fn = sanitize;
    context.sanitizeValue = (value) => {
      const out: unknown = fn(value);
      return typeof out === "string" ? out : value;
    };
  }
  const check = hostFnOf(scope, "validate");
  if (check !== undefined && seen.validate !== check) {
    seen.validate = check;
    const fn = check;
    context.validate = (details) => {
      const out: unknown = fn(details);
      return typeof out === "boolean" ? out : true;
    };
  }
};

const seenByBridge = new WeakMap<IdFn, { sanitize?: HostFn; validate?: HostFn }>();
const seenOf = (id: IdFn): { sanitize?: HostFn; validate?: HostFn } => {
  let seen = seenByBridge.get(id);
  if (seen === undefined) {
    seen = {};
    seenByBridge.set(id, seen);
  }
  return seen;
};

const announce = (
  root: Element,
  regionId: string,
  translations: TagsTranslations,
  log: TagsLog,
  prev: TagsLog | null,
): void => {
  // The id carries colons, invalid in an id selector, so the attribute form
  // matches it exactly.
  const region = root.querySelector(`[id="${regionId}"]`);
  if (region === null || region.parentNode === null) return;
  const fresh = region.cloneNode(false);
  fresh.textContent = message(log, prev, translations);
  region.replaceWith(fresh);
};

const blurBehaviorOf = (
  value: unknown,
  authored: boolean,
): { addOnBlur?: boolean; clearOnBlur?: boolean } => {
  if (!authored) return {};
  return { addOnBlur: value === "add", clearOnBlur: value === "clear" };
};

/** The component's public state: the names the markup may key on. */
export const def = {
  name: "tags-input",
  machine: (args: TagsArgs, authored: (name: string) => boolean) => tagsMachine(args, authored),
  start: (raw: Record<string, unknown>) => (raw["autoFocus"] === true ? "focused:input" : "idle"),
  reconcile: ({ context, parsed, authored }) => {
    let moved = false;
    // The authored `invalid` wins outright: a host write lands even when
    // the channel was never declared authored.
    const invalid = parsed["invalid"] === true ? true : undefined;
    if (context.invalid !== invalid) {
      context.invalid = invalid;
      moved = true;
    }
    const input = parsed["inputValue"];
    if (authored("inputValue") && typeof input === "string") {
      if (context.inputValue !== input) {
        context.inputValue = input;
        moved = true;
      }
    }
    const behavior = blurBehaviorOf(parsed["blurBehavior"], authored("blurBehavior"));
    if (behavior.addOnBlur !== undefined && behavior.addOnBlur !== context.addOnBlur) {
      context.addOnBlur = behavior.addOnBlur;
      moved = true;
    }
    if (behavior.clearOnBlur !== undefined && behavior.clearOnBlur !== context.clearOnBlur) {
      context.clearOnBlur = behavior.clearOnBlur;
      moved = true;
    }
    // A silent write changes the context without a send, so the bags that
    // read it through a snapshot need the invalidation bus.
    if (moved) machineTick(machineTick() + 1);
    return moved;
  },

  mounted: ({ root, id }) => {
    // The host's functions ride the element, so the root must be known
    // before the first command: a command syncs them pre-send.
    rememberRoot(id, root());
  },

  settled: ({ event, before, after, root, id, focus }: {
    readonly event: { readonly type: string } & Record<string, unknown>;
    readonly before: { readonly context: TagsContext; readonly state: TagsState };
    readonly after: { readonly context: TagsContext; readonly state: TagsState };
    readonly root: () => Element;
    readonly id: (part: string, slot?: unknown) => string;
    readonly focus: (part: string, slot?: unknown) => void;
  }) => {
    rememberRoot(id, root());
    syncHostFns(after.context, id);
    if (before.context.log !== after.context.log && after.context.log !== null) {
      announce(root(), id("liveRegion"), translationsOf({ context: after.context, root }), after.context.log, after.context.logPrev);
    }
    // A rename opening takes the edit input: its id appends `:input` to its
    // tag id, which the slot path expresses as one more segment.
    if (
      after.state === "editing:tag" &&
      before.state !== "editing:tag" &&
      after.context.editedIndex !== null
    ) {
      const row = rowsOf(after.context.value)[after.context.editedIndex];
      if (row !== undefined) focus("tag", `${row.value}:${row.occurrence}:input`);
      return;
    }
    if (
      event.type === "POINTER_DOWN_TAG" ||
      event.type === "CLICK_DELETE_TAG" ||
      event.type === "TAG_INPUT_ENTER" ||
      event.type === "TAG_INPUT_ESCAPE" ||
      event.type === "CLEAR_VALUE" ||
      event.type === "ENTER" ||
      event.type === "BACKSPACE" ||
      event.type === "DELETE" ||
      event.type === "DOUBLE_CLICK_TAG"
    ) focus("input");
  },
  parts: {
    root: {
      id: "",
      // The overflow is part of the signature: a list that grows past the cap
      // does not change its emptiness, and the root has to learn it went
      // invalid.
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        "data-disabled": scope.attr(scope.context.disabled),
        "data-readonly": scope.attr(scope.context.readOnly),
        "data-focus": scope.attr(scope.state !== "idle"),
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-empty": scope.attr(scope.context.value.length === 0),
        onPointerDown: () => {
          if (scope.context.readOnly || scope.context.disabled) return;
          scope.send({ type: "POINTER_DOWN" });
        },
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        for: scope.id("input"),
        "data-disabled": scope.attr(scope.context.disabled),
        "data-readonly": scope.attr(scope.context.readOnly),
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-required": scope.attr(scope.context.required),
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
        tabIndex: scope.context.readOnly ? 0 : undefined,
        "data-disabled": scope.attr(scope.context.disabled),
        "data-readonly": scope.attr(scope.context.readOnly),
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-focus": scope.attr(scope.state !== "idle"),
      }),
    },
    input: {
      attrs: (scope: ScopeLike) => {
        const context = scope.context;
        const empty = context.value.length === 0;
        return {
          dir: scope.context.dir,
          type: "text",
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          enterKeyHint: "done",
          disabled: scope.context.disabled || scope.context.readOnly,
          maxLength: scope.context.maxLength ?? undefined,
          ...ariaInvalid(invalidOf(scope)),
          "data-invalid": scope.attr(invalidOf(scope)),
          "data-readonly": scope.attr(scope.context.readOnly),
          "data-empty": scope.attr(empty),
          placeholder: empty ? textOf(scope.context.placeholder) : undefined,
          value: context.inputValue,
          onInput: (event: InputEvent) => {
            if (scope.context.readOnly || scope.context.disabled) return;
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            const value = target.value;
            if (event.inputType === "insertFromPaste") {
              scope.send({ type: "PASTE", value });
              return;
            }
            const delimiter = textOf(scope.context.delimiter, ",");
            if (delimiter.length > 0 && value.endsWith(delimiter)) {
              scope.send({ type: "DELIMITER_KEY" });
              return;
            }
            scope.send({ type: "TYPE", value });
          },
          onFocus: () => scope.send({ type: "FOCUS" }),
          onFocusOut: (event: FocusEvent) => {
            const host = scope.root();
            const input = host.querySelector(`[id="${scope.id("input")}"]`);
            const related: unknown = event.relatedTarget;
            // A null target is a label-click blur when the window holds focus,
            // and a window blur when it does not — the platform owns that
            // distinction, read here, once.
            if ((related === null || related === undefined) && !windowFocused()) return;
            if (related !== null && related !== undefined && !(related instanceof Node)) return;
            const node: Node | null = related === null || related === undefined ? null : related;
            if (input !== null && node !== null && (related === input || (input instanceof Node && input.contains(node)))) return;
            if (node !== null) {
              if (withinTag(scope, node)) return;
              if (host.contains(node)) return;
            }
            callHostFn(hostFnOf(scope, "onFocusOutside"), event);
            scope.send({ type: "BLUR" });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.isComposing) return;
            const caret = caretAtStart(scope, event.currentTarget);
            const ctx = scope.context;
            switch (event.key) {
              case "ArrowDown":
                scope.send({ type: "ARROW_DOWN" });
                break;
              case "ArrowLeft":
                scope.send({ type: "ARROW_LEFT", caretAtStart: caret });
                break;
              case "ArrowRight":
                if (ctx.highlightedIndex !== null) event.preventDefault();
                scope.send({ type: "ARROW_RIGHT", caretAtStart: caret });
                break;
              case "Escape":
                event.preventDefault();
                scope.send({ type: "ESCAPE" });
                break;
              case "Backspace":
                scope.send({ type: "BACKSPACE", caretAtStart: caret });
                break;
              case "Delete":
                scope.send({ type: "DELETE", caretAtStart: caret });
                break;
              case "Enter":
                scope.send({ type: "ENTER" });
                event.preventDefault();
                break;
              default:
                return;
            }
          },
          "use:dismissable": {
            onOutside: (event: PointerEvent) => {
              callHostFn(hostFnOf(scope, "onPointerDownOutside"), event);
              callHostFn(hostFnOf(scope, "onInteractOutside"), event);
              if (event.defaultPrevented) return;
              if (withinTag(scope, event.target)) return;
              if (scope.context.readOnly || scope.context.disabled) return;
              scope.send({ type: "BLUR" });
            },
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      attrs: (scope) => {
        const context = scope.context;
        return {
          type: "text",
          hidden: true,
          name: scope.context.name,
          form: scope.context.form,
          disabled: scope.context.disabled,
          readOnly: scope.context.readOnly,
          required: scope.context.required,
          value: context.value.join(", "),
          // Zag's trackFormControl: a form reset returns the tags to the seeded
          // value. The rest of that effect (fieldset disabled) has no
          // consumer here — the api's `disabled` is the prop.
          "use:form-control": {
            onFormReset: () => {
              scope.send({ type: "SET_VALUE", value: [...scope.context.initialValue] });
            },
          },
        };
      },
    },
    clearTrigger: {
      id: "clear-btn",
      attrs: (scope: ScopeLike) => {
        const empty = scope.context.value.length === 0;
        return {
          type: "button",
          dir: scope.context.dir,
          disabled: scope.context.disabled,
          "data-readonly": scope.attr(scope.context.readOnly),
          "aria-label": translationsOf(scope).clearTriggerLabel,
          hidden: empty,
          onClick: () => {
            if (scope.context.readOnly || scope.context.disabled) return;
            scope.send({ type: "CLEAR_VALUE" });
          },
        };
      },
    },
    liveRegion: {
      id: "live-region",
      attrs: (_scope: ScopeLike) => ({
        role: "status",
        ...liveRegion({ live: "assertive", atomic: true }),
      }),
    },
  },
  slots: {
    item: {
      indexes: (context) => rowsOf(context.value).filter(() => true),
      attrs: (scope: SlotLike<TagsRow>) => {
        const row = scope.slot;
        return {
          dir: scope.context.dir,
          "data-value": row.value,
          "data-disabled": scope.attr(scope.context.disabled),
        };
      },
    },
    itemPreview: {
      id: "preview",
      indexes: (context) => rowsOf(context.value),
      attrs: (scope: SlotLike<TagsRow>) => {
        const row = scope.slot;
        const state = stateOf(scope, row);
        return {
          id: tagIdOf(scope.id, row),
          dir: scope.context.dir,
          hidden: state.editing,
          "data-value": row.value,
          "data-disabled": scope.attr(state.disabled),
          "data-highlighted": scope.attr(state.highlighted),
          onPointerDown: tagHandlers(scope, row).onPointerDown,
          onDblclick: tagHandlers(scope, row).onDblclick,
        };
      },
    },
    itemText: {
      id: "text",
      indexes: (context) => rowsOf(context.value),
      attrs: (scope: SlotLike<TagsRow>) => {
        const state = stateOf(scope, scope.slot);
        return {
          dir: scope.context.dir,
          "data-disabled": scope.attr(state.disabled),
          "data-highlighted": scope.attr(state.highlighted),
        };
      },
    },
    itemInput: {
      id: "tag-input",
      indexes: (context) => rowsOf(context.value),
      attrs: (scope: SlotLike<TagsRow>) => {
        const row = scope.slot;
        const state = stateOf(scope, row);
        return {
          id: `${tagIdOf(scope.id, row)}:input`,
          dir: scope.context.dir,
          type: "text",
          disabled: state.disabled,
          "aria-label": translationsOf(scope).tagEdited(row.value),
          hidden: !state.editing,
          maxLength: scope.context.maxLength ?? undefined,
          tabIndex: -1,
          autoComplete: "off",
          value: state.editing ? scope.context.editedValue : "",
          onInput: (event: InputEvent) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            scope.send({ type: "TAG_INPUT_TYPE", value: target.value });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.isComposing) return;
            switch (event.key) {
              case "Enter":
                scope.send({ type: "TAG_INPUT_ENTER" });
                break;
              case "Escape":
                scope.send({ type: "TAG_INPUT_ESCAPE" });
                break;
              default:
                break;
            }
          },
          onBlur: (event: FocusEvent) => {
            const host = scope.root();
            const input = host.querySelector(`[id="${scope.id("input")}"]`);
            const related: unknown = event.relatedTarget;
            const relatedToInput = related !== null && input !== null && related === input;
            queueMicrotask(() => {
              scope.send({ type: "TAG_INPUT_BLUR", relatedToInput });
              if (!relatedToInput) scope.send({ type: "EXTERNAL_BLUR" });
            });
          },
        };
      },
    },
    itemDeleteTrigger: {
      id: "delete-btn",
      indexes: (context) => rowsOf(context.value),
      attrs: (scope: SlotLike<TagsRow>) => {
        const row = scope.slot;
        const state = stateOf(scope, row);
        const handlers = tagHandlers(scope, row);
        return {
          id: `${tagIdOf(scope.id, row)}:delete-btn`,
          type: "button",
          dir: scope.context.dir,
          "data-disabled": scope.attr(state.disabled),
          ...ariaDisabled(state.disabled),
          "data-highlighted": scope.attr(state.highlighted),
          "aria-label": translationsOf(scope).deleteTagTriggerLabel(row.value),
          tabIndex: -1,
          disabled: state.disabled,
          onPointerDown: handlers.onDeletePointerDown,
          onClick: handlers.onDeleteClick,
        };
      },
    },
  },
  commands: {
    setValue: {
      event: ([value]: [value: readonly string[]]) => ({ type: "SET_VALUE" as const, value: [...value] }),
    },
    addValue: {
      event: ([value]: [value: string], context: TagsContext, id) => {
        syncHostFns(context, id);
        return { type: "ADD_TAG" as const, value };
      },
    },
    setValueAtIndex: {
      event: ([index, value]: [index: number, value: string]) => ({
        type: "SET_VALUE_AT_INDEX" as const,
        index: Math.trunc(index),
        value,
      }),
    },
    clearValue: {
      event: (args, context: TagsContext, id) => {
        const at: unknown = args[0];
        if (at === undefined) return { type: "CLEAR_VALUE" };
        if (typeof at === "number") return { type: "CLEAR_TAG", index: at };
        const ctx = context;
        for (const row of rowsOf(ctx.value)) {
          const tag = tagIdOf(id, row);
          if (tag === at || `${tag}:delete-btn` === at || `${tag}:input` === at) {
            return { type: "CLEAR_TAG", index: indexOfRow(ctx, row) };
          }
        }
        // An unknown id is a no-op: the delete lands on index -1, which the
        // machine ignores.
        return { type: "CLEAR_TAG", index: -1 };
      },
    },
    setInputValue: {
      event: (args) => {
        const value = args[0];
        return { type: "SET_INPUT_VALUE", value: typeof value === "string" ? value : "" };
      },
    },
    clearInputValue: { event: () => ({ type: "SET_INPUT_VALUE", value: "" }) },
    focus: { view: ({ focus }) => focus("input") },
  },
  readers: {
    value: { read: (context) => context.value },
    inputValue: { read: (context) => context.inputValue },
    valueAsString: { read: (context) => context.value.join(", ") },
    count: { read: (context) => context.value.length },
    empty: { read: (context) => context.value.length === 0 },
    atMax: { read: (context: TagsContext) => context.value.length >= context.max },
    highlightedIndex: { read: (context) => context.highlightedIndex },
    editing: { read: (_context, state) => state === "editing:tag" },
    editedIndex: { read: (context) => context.editedIndex },
  },
  methods: {
    getTags: {
      call: (context: TagsContext) => rowsOf(context.value),
    },
    getItemState: {
      call: (context: TagsContext, state, args, props, id) =>
        itemStateOf(
          context,
          state,
          props["disabled"] === true,
          id,
          rowOf(args[0]),
        ),
    },
    indexOfRow: {
      call: (context: TagsContext, _state, [row]: [row: TagsRow]): number => indexOfRow(context, rowOf(row)),
    },
    indexOfId: {
      call: (context: TagsContext, _state, args, props, id) => {
        void props;
        const target: unknown = args[0];
        if (typeof target !== "string") return -1;
        for (const row of rowsOf(context.value)) {
          const tag = tagIdOf(id, row);
          if (tag === target || `${tag}:delete-btn` === target || `${tag}:input` === target) {
            return indexOfRow(context, row);
          }
        }
        return -1;
      },
    },
    announceLog: {
      call: (context: TagsContext, _state: TagsState, _args: readonly unknown[], _props: Record<string, unknown>, id: (part: string, slot?: unknown) => string) => {
        const ctx = context;
        if (ctx.log === null) return;
        const root = rootByBridge.get(id);
        if (root === undefined) return;
        announce(root, id("liveRegion"), translationsOf({ context: ctx, root: () => root }), ctx.log, ctx.logPrev);
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...context.value],
      detail: (watched: readonly unknown[]) => ({ value: watched.filter((v): v is string => typeof v === "string") }),
    },
    "input-value-change": {
      prop: "onInputValueChange",
      watch: (context) => [context.inputValue],
      detail: (watched: readonly unknown[]) => {
        const text = watched[0];
        return { inputValue: typeof text === "string" ? text : "" };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [context.highlightedIndex],
      detail: (watched: readonly unknown[]) => {
        const index = watched[0];
        return { highlightedValue: typeof index === "number" ? index : null };
      },
    },
    "value-invalid": {
      prop: "onValueInvalid",
      watch: () => [],
      detail: () => ({ reason: "invalidTag" as const }),
      select: (_event, before: TagsContext, after: TagsContext) => {
        const beforeCtx = before;
        const afterCtx = after;
        // A refused add reports once, then clears: the fork's send is
        // synchronous, so the report-and-clear is one atomic step.
        if (afterCtx.refusal !== null) {
          const reason = afterCtx.refusal;
          afterCtx.refusal = null;
          return { reason };
        }
        // Zag's invokeOnInvalid watch: the overflow report is an edge, so
        // it fires on the way into the state and never while already there.
        const wasOver = beforeCtx.value.length > beforeCtx.max;
        const isOver = afterCtx.value.length > afterCtx.max;
        if (!wasOver && isOver) return { reason: "rangeOverflow" };
        return null;
      },
    },
  },
} satisfies ComponentDef<TagsContext, TagsEvents, Record<string, unknown>, TagsArgs, TagsState>;

export type TagsApi = ApiOf<typeof def>;
export const tags = defineComponent<TagsContext, TagsEvents, TagsApi, TagsArgs, TagsState>(def);
