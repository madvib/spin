import {
  defineComponent,
  textProp,
  type ComponentDef,
} from "@spin/runtime";
import {
  config,
  implementations,
  type SanitizeValue,
  type TagsContext,
  type TagsEvent,
  type TagsLog,
  type TagsValueChange,
  type TagsValueInvalid,
  type ValidateTag,
} from "./tags.machine.ts";

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
 * Tags-input definition: the DOM contract as data. The machine owns the
 * four states, the value list, the input text, the highlight, and the edit
 * model; this file maps props to channels, parts to attribute bags, commands
 * to sends, and value/input/highlight/invalid transitions to their events.
 * Rows are occurrence-keyed (duplicate values render twice); the live region
 * announces the mutation log by swapping its node.
 */

export type {
  TagsHighlightChange,
  TagsInputValueChange,
  TagsValueChange,
  TagsValueInvalid,
} from "./tags.machine.ts";

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

export interface TagsApi extends TagsCommands {
  readonly value: readonly string[];
  readonly inputValue: string;
  readonly valueAsString: string;
  readonly count: number;
  readonly empty: boolean;
  readonly atMax: boolean;
  readonly highlightedIndex: number | null;
  readonly editing: boolean;
  readonly editedIndex: number | null;
  getTags(): readonly TagsRow[];
  getItemState(row: TagsRow): TagsItemState;
  indexOfRow(row: TagsRow): number;
  indexOfId(id: string): number;
  focusInput(): void;
  announceLog(): void;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getInputProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
  getItemProps(row: TagsRow): Record<string, unknown>;
  getItemPreviewProps(row: TagsRow): Record<string, unknown>;
  getItemTextProps(row: TagsRow): Record<string, unknown>;
  getItemInputProps(row: TagsRow): Record<string, unknown>;
  getItemDeleteTriggerProps(row: TagsRow): Record<string, unknown>;
  getLiveRegionProps(): Record<string, unknown>;
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

const defaultSanitize: SanitizeValue = (value: string): string => value.trim();
const defaultValidate: ValidateTag = (): boolean => true;

function parseTranslations(raw: unknown): TagsTranslations {
  if (typeof raw !== "object" || raw === null) return defaultTranslations;
  const record = raw as Record<string, unknown>;
  const text = (name: string, fallback: string): string =>
    typeof record[name] === "string" ? (record[name] as string) : fallback;
  const fn1 = <T>(name: string, fallback: (value: string) => T): ((value: string) => T) =>
    typeof record[name] === "function" ? (record[name] as (value: string) => T) : fallback;
  return {
    clearTriggerLabel: text("clearTriggerLabel", defaultTranslations.clearTriggerLabel),
    deleteTagTriggerLabel: fn1("deleteTagTriggerLabel", defaultTranslations.deleteTagTriggerLabel),
    tagAdded: fn1("tagAdded", defaultTranslations.tagAdded),
    tagEdited: fn1("tagEdited", defaultTranslations.tagEdited),
    tagUpdated: fn1("tagUpdated", defaultTranslations.tagUpdated),
    tagDeleted: fn1("tagDeleted", defaultTranslations.tagDeleted),
    tagSelected: fn1("tagSelected", defaultTranslations.tagSelected),
    tagsPasted: typeof record["tagsPasted"] === "function"
      ? (record["tagsPasted"] as (values: readonly string[]) => string)
      : defaultTranslations.tagsPasted,
    noTagsSelected: text("noTagsSelected", defaultTranslations.noTagsSelected),
  };
}

/** Strings travel the prop channel as JSON text (see the slider bridge:
 * the grammar coerces `= []` to `["[]"]`). Null when nothing arrived. */
const parseStrings = (raw: unknown): string[] | null => {
  if (Array.isArray(raw)) {
    const clean = (raw as unknown[]).filter((item): item is string => typeof item === "string");
    return clean.some((item) => item === "[]") && clean.length === 1 ? [] : clean;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? [...(parsed as string[])]
      : null;
  } catch {
    return null;
  }
};

const sameTags = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

type Ctx = TagsContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

type ScopeLike = {
  readonly props: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly state: string;
  readonly root: () => Element;
  readonly id: (part: string, slot?: unknown) => string;
  readonly send: (event: { type: string } & Record<string, unknown>) => void;
  readonly attr: (value: boolean) => string | undefined;
};

/**
 * One row object per logical tag, reused across value changes. A `for`
 * cell holds the row it captured at render time, so a rebuilt object would
 * leave a surviving cell rendering the previous tag's state. Memoized on
 * the value array's identity — shared across bridges only for identical
 * collections, where sharing is correct.
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

const indexOfRow = (context: Ctx, row: TagsRow): number => {
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
  context: Ctx,
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
  itemStateOf(asCtx(scope.context), scope.state, scope.props["disabled"] === true, scope.id, row);

/** Whether a node belongs to a tag part: the exclusion that keeps a press
 * on a tag from reading as a press outside the input. */
const withinTag = (scope: ScopeLike, node: EventTarget | null): boolean => {
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

/** Zag's `invalid = prop("invalid") || computed("isOverflowing")`: one
 * derived boolean flowing to root, control, label and input alike. */
const invalidOf = (scope: ScopeLike): boolean => {
  const context = asCtx(scope.context);
  return scope.props["invalid"] === true || (context.value as string[]).length > context.max;
};

const focusInput = (id: (part: string, slot?: unknown) => string): void => {
  if (typeof document === "undefined") return;
  (document.getElementById(id("input")) as HTMLInputElement | null)?.focus();
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. Keyed by the
 * bridge's own send fn first, so two bridges sharing one collection
 * identity never share handlers. */
type TagHandlerSet = {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onDblclick: () => void;
  readonly onDeleteClick: (event: MouseEvent) => void;
  readonly onDeletePointerDown: (event: PointerEvent) => void;
};
const tagHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  WeakMap<TagsRow, TagHandlerSet>
>();
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
      const context = asCtx(scope.context);
      if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "POINTER_DOWN_TAG", index });
      focusInput(scope.id);
    },
    onDblclick: (): void => {
      const context = asCtx(scope.context);
      if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "DOUBLE_CLICK_TAG", index });
      if (typeof document === "undefined") return;
      const node = document.getElementById(`${tagIdOf(scope.id, row)}:input`);
      if (node instanceof HTMLInputElement) {
        node.focus();
        node.select();
      }
    },
    onDeleteClick: (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      const context = asCtx(scope.context);
      if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
      const index = indexOfRow(context, row);
      if (index === -1) return;
      scope.send({ type: "CLICK_DELETE_TAG", index });
      focusInput(scope.id);
    },
    // The delete trigger is inside the preview: pressing it must not
    // also highlight the tag. Its only job when inert is to swallow the
    // press so the click that follows never fires.
    onDeletePointerDown: (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const context = asCtx(scope.context);
      if (!scope.props["readOnly"] === true && scope.props["disabled"] !== true) return;
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

/**
 * Announced by swapping the region node for a fresh clone carrying the
 * text: a new node in the live tree is a mutation a screen reader reads
 * even when the message repeats, which rewriting the same node's text
 * two writes deep in one task would not be.
 */
const announce = (scope: { readonly id: (part: string, slot?: number) => string; readonly props: Record<string, unknown> }, log: TagsLog, prev: TagsLog | null): void => {
  if (typeof document === "undefined") return;
  const region = document.getElementById(scope.id("liveRegion"));
  if (region === null || region.parentNode === null) return;
  const fresh = region.cloneNode(false);
  fresh.textContent = message(log, prev, scope.props["translations"] as TagsTranslations);
  region.replaceWith(fresh);
};

const def: ComponentDef<TagsContext, TagsEvent> = {
  name: "tags-input",
  config,
  implementations,
  start: (props) => (props["autoFocus"] === true ? "focused:input" : "idle"),
  seed: () => ({}),
  establish: (props) => {
    const seed = parseStrings(props["defaultValue"]) ?? [];
    const seedInput = typeof props["defaultInputValue"] === "string" ? (props["defaultInputValue"] as string) : "";
    return [
      { type: "SET_VALUE", value: seed },
      ...(seedInput.length > 0 ? [{ type: "SET_INPUT_VALUE", value: seedInput }] : []),
    ];
  },
  channels: {
    value: {
      controlled: true,
      parse: parseStrings,
      event: (value: readonly string[]) => ({ type: "SET_VALUE", value: [...value] }),
      equal: (current, outer) =>
        Array.isArray(current) && Array.isArray(outer) && sameTags(current as string[], outer as string[]),
      assign: true,
    },
    defaultValue: { parse: parseStrings },
    inputValue: {
      controlled: true,
      parse: textProp,
      event: (value: string) => ({ type: "SET_INPUT_VALUE", value }),
      assign: true,
    },
    defaultInputValue: { parse: textProp },
    max: { parse: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : Infinity) },
    allowOverflow: { parse: (raw) => raw === true },
    allowDuplicates: { parse: (raw) => raw === true },
    editable: { parse: (raw) => raw !== false },
    addOnPaste: { parse: (raw) => raw === true },
    addOnBlur: { parse: (raw) => raw === true },
    clearOnBlur: { parse: (raw) => raw === true },
    delimiter: { parse: (raw) => (typeof raw === "string" ? raw : ",") },
    sanitizeValue: {
      parse: (raw, host) => {
        if (typeof raw === "function") return raw;
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "sanitizeValue") : undefined;
        return typeof fromRoot === "function" ? fromRoot : defaultSanitize;
      },
    },
    validate: {
      parse: (raw, host) => {
        if (typeof raw === "function") return raw;
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "validate") : undefined;
        return typeof fromRoot === "function" ? fromRoot : defaultValidate;
      },
    },
    blurBehavior: { parse: textProp },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    placeholder: { parse: textProp },
    maxLength: { parse: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : undefined) },
    name: { parse: textProp },
    form: { parse: textProp },
    label: { parse: textProp },
    translations: {
      parse: (raw, host) => {
        if (typeof raw === "object" && raw !== null) return parseTranslations(raw);
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "translations") : undefined;
        return parseTranslations(fromRoot);
      },
    },
    autoFocus: { parse: (raw) => raw === true },
    onPointerDownOutside: {
      parse: (raw, host) => {
        if (typeof raw === "function") return raw;
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "onPointerDownOutside") : undefined;
        return typeof fromRoot === "function" ? fromRoot : undefined;
      },
    },
    onInteractOutside: {
      parse: (raw, host) => {
        if (typeof raw === "function") return raw;
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "onInteractOutside") : undefined;
        return typeof fromRoot === "function" ? fromRoot : undefined;
      },
    },
    onFocusOutside: {
      parse: (raw, host) => {
        if (typeof raw === "function") return raw;
        const fromRoot = host !== undefined ? Reflect.get(host.root(), "onFocusOutside") : undefined;
        return typeof fromRoot === "function" ? fromRoot : undefined;
      },
    },
  },
  silentSync: true,
  scalarsOf: (parsed) => ({
    max: parsed["max"],
    allowOverflow: parsed["allowOverflow"],
    allowDuplicates: parsed["allowDuplicates"],
    editable: parsed["editable"],
    addOnPaste: parsed["addOnPaste"],
    addOnBlur: parsed["blurBehavior"] === "add",
    clearOnBlur: parsed["blurBehavior"] === "clear",
    delimiter: parsed["delimiter"],
    sanitizeValue: parsed["sanitizeValue"],
    validate: parsed["validate"],
  }),
  settled: ({ before, after, props, id }) => {
    const beforeLog = (before as { readonly context: Ctx }).context.log;
    const afterLog = (after as { readonly context: Ctx }).context.log;
    if (beforeLog !== afterLog && afterLog !== null) {
      announce({ id, props }, afterLog, (after as { readonly context: Ctx }).context.logPrev);
    }
  },
  parts: {
    root: {
      id: "",
      sig: (scope) => [scope.props["dir"], scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], asCtx(scope.context).value.length === 0, scope.state !== "idle"].join(""),
      attrs: (scope) => ({
        id: scope.id("root"),
        dir: scope.props["dir"],
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-focus": scope.attr(scope.state !== "idle"),
        "data-empty": scope.attr(asCtx(scope.context).value.length === 0),
        onPointerDown: () => {
          const context = asCtx(scope.context);
          if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
          scope.send({ type: "POINTER_DOWN" });
        },
      }),
    },
    label: {
      sig: (scope) => [scope.props["dir"], scope.props["disabled"], scope.props["invalid"], scope.props["readOnly"], scope.props["required"]].join(""),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        for: scope.id("input"),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        "data-required": scope.attr(scope.props["required"] === true),
      }),
    },
    control: {
      sig: (scope) => [scope.props["dir"], scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], scope.state !== "idle"].join(""),
      attrs: (scope) => ({
        id: scope.id("control"),
        dir: scope.props["dir"],
        tabIndex: scope.props["readOnly"] === true ? 0 : undefined,
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        "data-invalid": scope.attr(invalidOf(scope)),
        "data-focus": scope.attr(scope.state !== "idle"),
      }),
    },
    input: {
      sig: (scope) => {
        const context = asCtx(scope.context);
        return [scope.props["dir"], scope.props["disabled"], scope.props["readOnly"], scope.props["invalid"], context.value.length === 0, context.inputValue, scope.props["placeholder"], scope.props["maxLength"]].join("");
      },
      attrs: (scope) => {
        const context = asCtx(scope.context);
        const empty = context.value.length === 0;
        return {
          id: scope.id("input"),
          dir: scope.props["dir"],
          type: "text",
          autoComplete: "off",
          autoCorrect: "off",
          autoCapitalize: "none",
          enterKeyHint: "done",
          disabled: scope.props["disabled"] === true || scope.props["readOnly"] === true,
          maxLength: scope.props["maxLength"],
          "aria-invalid": invalidOf(scope),
          "data-invalid": scope.attr(invalidOf(scope)),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          "data-empty": scope.attr(empty),
          placeholder: empty ? (scope.props["placeholder"] as string) : undefined,
          value: context.inputValue,
          onInput: (event: InputEvent) => {
            const ctx = asCtx(scope.context);
            if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
            const target = event.currentTarget;
            if (!(target instanceof HTMLInputElement)) return;
            const value = target.value;
            if (event.inputType === "insertFromPaste") {
              scope.send({ type: "PASTE", value });
              return;
            }
            const delimiter = scope.props["delimiter"] as string;
            if (delimiter.length > 0 && value.endsWith(delimiter)) {
              scope.send({ type: "DELIMITER_KEY" });
              return;
            }
            scope.send({ type: "TYPE", value });
          },
          onFocus: () => scope.send({ type: "FOCUS" }),
          onFocusOut: (event: FocusEvent) => {
            if (typeof document === "undefined") return;
            const input = document.getElementById(scope.id("input"));
            const related = event.relatedTarget;
            if (related === null || related === undefined) {
              if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
            } else {
              if (!(related instanceof Node)) return;
              if (input !== null && (related === input || input.contains(related))) return;
              if (withinTag(scope, related)) return;
              const host = scope.root();
              if (host.contains(related)) return;
            }
            (scope.props["onFocusOutside"] as ((event: FocusEvent) => void) | undefined)?.(event);
            scope.send({ type: "BLUR" });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.isComposing) return;
            if (typeof document === "undefined") return;
            const el = document.getElementById(scope.id("input")) as HTMLInputElement | null;
            const caret = el !== null && el.selectionStart === 0 && el.selectionEnd === 0;
            const ctx = asCtx(scope.context);
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
              (scope.props["onPointerDownOutside"] as ((event: PointerEvent) => void) | undefined)?.(event);
              (scope.props["onInteractOutside"] as ((event: PointerEvent) => void) | undefined)?.(event);
              if (event.defaultPrevented) return;
              if (withinTag(scope, event.target)) return;
              const ctx = asCtx(scope.context);
              if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
              scope.send({ type: "BLUR" });
            },
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => {
        const context = asCtx(scope.context);
        return [scope.props["name"], scope.props["form"], scope.props["disabled"], scope.props["readOnly"], scope.props["required"], context.value.join(", ")].join("");
      },
      attrs: (scope) => {
        const context = asCtx(scope.context);
        return {
          type: "text",
          hidden: true,
          name: scope.props["name"],
          form: scope.props["form"],
          disabled: scope.props["disabled"],
          readOnly: scope.props["readOnly"],
          required: scope.props["required"],
          id: scope.id("hiddenInput"),
          value: context.value.join(", "),
          // Zag's trackFormControl: a form reset returns the tags to the
          // seeded value. The rest of that effect (fieldset disabled) has
          // no consumer in this machine — the api's `disabled` is the prop.
          "use:form-control": {
            onFormReset: () => {
              const seed = parseStrings(scope.props["defaultValue"]) ?? [];
              scope.send({ type: "SET_VALUE", value: [...seed] });
            },
          },
        };
      },
    },
    clearTrigger: {
      id: "clear-btn",
      sig: (scope) => [scope.props["disabled"], scope.props["readOnly"], asCtx(scope.context).value.length === 0, (scope.props["translations"] as TagsTranslations).clearTriggerLabel].join(""),
      attrs: (scope) => {
        const empty = asCtx(scope.context).value.length === 0;
        return {
          id: scope.id("clearTrigger"),
          type: "button",
          dir: scope.props["dir"],
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
          disabled: scope.props["disabled"],
          "aria-label": (scope.props["translations"] as TagsTranslations).clearTriggerLabel,
          hidden: empty,
          onClick: () => {
            const context = asCtx(scope.context);
            if (scope.props["readOnly"] === true || scope.props["disabled"] === true) return;
            scope.send({ type: "CLEAR_VALUE" });
            focusInput(scope.id);
          },
        };
      },
    },
    liveRegion: {
      id: "live-region",
      sig: () => "",
      attrs: (scope) => ({
        id: scope.id("liveRegion"),
        role: "status",
        "aria-live": "assertive",
        "aria-atomic": true,
      }),
    },
  },
  slots: {
    item: {
      indexes: (context, props) => rowsOf(asCtx(context).value).filter(() => true),
      sig: (scope) => {
        const context = asCtx(scope.context);
        return [context.editedIndex, context.highlightedIndex, scope.props["disabled"]].join("");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as TagsRow;
        return {
          dir: scope.props["dir"],
          "data-value": row.value,
          "data-disabled": scope.attr(scope.props["disabled"] === true),
        };
      },
    },
    itemPreview: {
      id: "preview",
      indexes: (context) => rowsOf(asCtx(context).value),
      sig: (scope) => {
        const state = stateOf(scope, scope.slot as unknown as TagsRow);
        return [state.editing, state.highlighted, state.disabled].join("");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as TagsRow;
        const state = stateOf(scope, row);
        return {
          id: tagIdOf(scope.id, row),
          dir: scope.props["dir"],
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
      indexes: (context) => rowsOf(asCtx(context).value),
      sig: (scope) => {
        const state = stateOf(scope, scope.slot as unknown as TagsRow);
        return [state.highlighted, state.disabled].join("");
      },
      attrs: (scope) => {
        const state = stateOf(scope, scope.slot as unknown as TagsRow);
        return {
          dir: scope.props["dir"],
          "data-disabled": scope.attr(state.disabled),
          "data-highlighted": scope.attr(state.highlighted),
        };
      },
    },
    itemInput: {
      id: "tag-input",
      indexes: (context) => rowsOf(asCtx(context).value),
      sig: (scope) => {
        const state = stateOf(scope, scope.slot as unknown as TagsRow);
        return [state.editing, state.disabled, state.index, state.editing ? asCtx(scope.context).editedValue : ""].join("");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as TagsRow;
        const state = stateOf(scope, row);
        return {
          id: `${tagIdOf(scope.id, row)}:input`,
          dir: scope.props["dir"],
          type: "text",
          disabled: state.disabled,
          "aria-label": (scope.props["translations"] as TagsTranslations).tagEdited(row.value),
          hidden: !state.editing,
          maxLength: scope.props["maxLength"],
          tabIndex: -1,
          autoComplete: "off",
          value: state.editing ? asCtx(scope.context).editedValue : "",
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
                focusInput(scope.id);
                break;
              case "Escape":
                scope.send({ type: "TAG_INPUT_ESCAPE" });
                focusInput(scope.id);
                break;
              default:
                break;
            }
          },
          onBlur: (event: FocusEvent) => {
            if (typeof document === "undefined") return;
            const input = document.getElementById(scope.id("input"));
            const related = event.relatedTarget;
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
      indexes: (context) => rowsOf(asCtx(context).value),
      sig: (scope) => {
        const state = stateOf(scope, scope.slot as unknown as TagsRow);
        const row = scope.slot as unknown as TagsRow;
        return [state.highlighted, state.disabled, row.value].join("");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as TagsRow;
        const state = stateOf(scope, row);
        const handlers = tagHandlers(scope, row);
        return {
          id: `${tagIdOf(scope.id, row)}:delete-btn`,
          type: "button",
          dir: scope.props["dir"],
          "data-disabled": scope.attr(state.disabled),
          "aria-disabled": state.disabled,
          "data-highlighted": scope.attr(state.highlighted),
          "aria-label": (scope.props["translations"] as TagsTranslations).deleteTagTriggerLabel(row.value),
          tabIndex: -1,
          disabled: state.disabled,
          onPointerDown: handlers.onDeletePointerDown,
          onClick: handlers.onDeleteClick,
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "SET_VALUE", value: [...(args[0] as readonly string[])] }) },
    addValue: { event: (args) => ({ type: "ADD_TAG", value: args[0] as string }) },
    setValueAtIndex: {
      event: (args) => ({ type: "SET_VALUE_AT_INDEX", index: args[0] as number, value: args[1] as string }),
    },
    clearValue: {
      event: (args, context, id) => {
        const at = args[0] as string | number | undefined;
        if (at === undefined) return { type: "CLEAR_VALUE" };
        if (typeof at === "number") return { type: "CLEAR_TAG", index: at };
        const ctx = asCtx(context);
        for (const row of rowsOf(ctx.value)) {
          const tag = tagIdOf(id, row);
          if (tag === at || `${tag}:delete-btn` === at || `${tag}:input` === at) {
            return { type: "CLEAR_TAG", index: indexOfRow(ctx, row) };
          }
        }
        // An unknown id is a no-op: the machine's delete ignores a
        // missing index, so this lands as a silent clear of nothing.
        return { type: "CLEAR_TAG", index: -1 };
      },
    },
    setInputValue: { event: (args) => ({ type: "SET_INPUT_VALUE", value: args[0] as string }) },
    clearInputValue: { event: () => ({ type: "SET_INPUT_VALUE", value: "" }) },
    focus: { view: ({ focus }) => focus("input") },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    inputValue: { read: (context) => asCtx(context).inputValue },
    valueAsString: { read: (context) => (asCtx(context).value as string[]).join(", ") },
    count: { read: (context) => (asCtx(context).value as string[]).length },
    empty: { read: (context) => (asCtx(context).value as string[]).length === 0 },
    atMax: { read: (context) => { const ctx = asCtx(context); return (ctx.value as string[]).length >= ctx.max; } },
    highlightedIndex: { read: (context) => asCtx(context).highlightedIndex },
    editing: { read: (_context, state) => state === "editing:tag" },
    editedIndex: { read: (context) => asCtx(context).editedIndex },
  },
  methods: {
    getTags: {
      call: (context) => rowsOf(asCtx(context).value),
    },
    getItemState: {
      call: (context, state, args, props, id) =>
        itemStateOf(
          asCtx(context),
          state,
          (props["disabled"] as boolean) === true,
          id,
          args[0] as TagsRow,
        ),
    },
    indexOfRow: {
      call: (context, _state, args) => indexOfRow(asCtx(context), args[0] as TagsRow),
    },
    indexOfId: {
      call: (context, _state, args, props, id) => {
        void props;
        const target = args[0] as string;
        for (const row of rowsOf(asCtx(context).value)) {
          const tag = tagIdOf(id, row);
          if (tag === target || `${tag}:delete-btn` === target || `${tag}:input` === target) {
            return indexOfRow(asCtx(context), row);
          }
        }
        return -1;
      },
    },
    focusInput: {
      call: (_context, _state, _args, _props, id) => focusInput(id),
    },
    announceLog: {
      call: (context, _state, _args, props, id) => {
        const ctx = asCtx(context);
        if (ctx.log === null) return;
        announce({ id, props }, ctx.log, ctx.logPrev);
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [...asCtx(context).value],
      detail: (watched) => ({ value: [...watched] as string[] }),
    },
    "input-value-change": {
      prop: "onInputValueChange",
      watch: (context) => [asCtx(context).inputValue],
      detail: (watched) => ({ inputValue: watched[0] as string }),
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [asCtx(context).highlightedIndex],
      detail: (watched) => ({ highlightedValue: watched[0] as number | null }),
    },
    "value-invalid": {
      prop: "onValueInvalid",
      watch: () => [],
      detail: (watched) => ({ reason: watched[0] as "invalidTag" | "rangeOverflow" }),
      select: (_event, before, after) => {
        const beforeCtx = before as unknown as Ctx;
        const afterCtx = after as unknown as Ctx;
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
};

export const tagsInput = defineComponent<TagsContext, TagsEvent, TagsApi>(def);
