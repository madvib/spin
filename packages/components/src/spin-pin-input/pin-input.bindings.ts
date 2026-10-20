import { defineComponent, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  pinView,
  type PinInputContext,
  type PinInputEvent,
  type PinInputValueChange,
  type PinInputValueComplete,
  type PinInputValueInvalid,
  type PinInputInitial,
} from "./pin-input.machine.ts";

/**
 * Pin-input definition: the DOM contract as data. The machine owns the
 * value, the focused index, and the count; this file maps props to bindings,
 * parts to attribute bags, commands to sends, and value/complete/invalid
 * transitions to their events. Focus moves and the completion edge (blur,
 * submit) are post-send view reflexes — they run for controlled writes too,
 * because sync routes through the same pipeline.
 */

interface ScopeLike extends PartScope<unknown, PinInputContext> {}
interface SlotLike<R = { readonly index: number }> extends SlotScope<R, PinInputContext> {}

export type PinInputType = "numeric" | "alphabetic" | "alphanumeric";

export type PinInputSanitize = (value: string) => string;

export interface PinInputTranslations {
  readonly inputLabel: (index: number, length: number) => string;
}

export interface PinInputApi {
  focus(): void;
  setValue(value: readonly string[]): void;
  clearValue(): void;
  setValueAtIndex(index: number, value: string): void;
  readonly count: number;
  readonly items: readonly number[];
  readonly value: readonly string[];
  readonly valueAsString: string;
  readonly complete: boolean;
  readonly focused: boolean;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getInputProps(props: { index: number }): Record<string, unknown>;
  getItems(): readonly number[];
}

/** The element's declared cell count, for a prop that arrives unwritten. */
const DEFAULT_COUNT = 4;
/** Zag's placeholder default. */
const DEFAULT_PLACEHOLDER = "\u25CB";

const defaultTranslations: PinInputTranslations = {
  inputLabel: (index: number, length: number): string => `pin code ${index + 1} of ${length}`,
};

const isInputLabel = (value: unknown): value is PinInputTranslations["inputLabel"] => typeof value === "function";

function parseTranslations(raw: unknown): PinInputTranslations {
  if (typeof raw !== "object" || raw === null) return defaultTranslations;
  const inputLabel: unknown = Reflect.get(raw, "inputLabel");
  return {
    inputLabel: isInputLabel(inputLabel) ? inputLabel : defaultTranslations.inputLabel,
  };
}

/** Zag's `REGEX` table, keyed by `type`; `pattern` overrides it wholesale. */
const TYPE_PATTERNS: Readonly<Record<PinInputType, RegExp>> = {
  numeric: /^[0-9]+$/,
  alphabetic: /^[A-Za-z]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/i,
};

/** Zag's `isValidValue`. The pattern path compiles without Zag's `g` flag: a
 * global regex's `lastIndex` makes a repeated test of the same value report
 * differently the second time. */
function isValidValue(value: string, type: PinInputType, pattern: string): boolean {
  if (pattern.length > 0) return new RegExp(pattern).test(value);
  const regex = TYPE_PATTERNS[type];
  return regex !== undefined && regex.test(value);
}

/** Zag's rtl flip: in a right-to-left pin, ArrowLeft walks forward. */
function eventKey(event: KeyboardEvent, dir: string): string {
  if (dir !== "rtl") return event.key;
  if (event.key === "ArrowLeft") return "ArrowRight";
  if (event.key === "ArrowRight") return "ArrowLeft";
  return event.key;
}

/**
 * The value travels the prop channel as an array (a property write) or a
 * comma-joined string (an attribute write), and the grammar's own default
 * for an array prop arrives as the string `"[]"` parsed into one cell. A
 * cell holds exactly one character, so everything else is dropped here
 * rather than trusted at the read.
 */
const parseChars = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim())
      : [];
  return parts.filter((part) => part.length === 1);
};

const sameChars = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const readCount = (raw: unknown): number =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : DEFAULT_COUNT;

type Ctx = PinInputContext;

const resolveTranslations = (scope: ScopeLike): PinInputTranslations => {
  const raw = scope.props["translations"];
  if (typeof raw === "object" && raw !== null) return parseTranslations(raw);
  const fromRoot = Reflect.get(scope.root(), "translations");
  if (typeof fromRoot === "object" && fromRoot !== null) return parseTranslations(fromRoot);
  return defaultTranslations;
};

const isSanitize = (value: unknown): value is PinInputSanitize => typeof value === "function";

const resolveSanitize = (scope: ScopeLike): PinInputSanitize => {
  const raw: unknown = scope.props["sanitizeValue"];
  if (isSanitize(raw)) return raw;
  const fromRoot: unknown = Reflect.get(scope.root(), "sanitizeValue");
  if (isSanitize(fromRoot)) return fromRoot;
  return (value: string) => value;
};

const slotIndex = (scope: SlotLike<{ readonly index: number }>): number => scope.slot.index;

/** The type union has three members; anything else is numeric. Narrowed
 * once here instead of a cast at every keystroke/paste/aria site. */
const pinTypeOf = (props: Record<string, unknown>): PinInputType => {
  const raw: unknown = props["type"];
  return raw === "alphabetic" || raw === "alphanumeric" ? raw : "numeric";
};

/** The cell indices, cached per count: the `for` directive iterates this
 * array, and a fresh one per read would re-sync every cell on every move. */
const itemsCache = new Map<number, readonly number[]>();
const cellIndexes = (count: number): readonly number[] => {
  const hit = itemsCache.get(count);
  if (hit !== undefined) return hit;
  const made = Array.from({ length: count }, (_unused, at) => at);
  itemsCache.set(count, made);
  return made;
};

type CellHandlerSet = {
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly onPaste: (event: ClipboardEvent) => void;
  readonly onBeforeInput: (event: InputEvent) => void;
  readonly onInput: (event: InputEvent) => void;
};
const cellHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  Map<number, CellHandlerSet>
>();
const cellHandlers = (scope: ScopeLike, index: number): CellHandlerSet => {
  let byIndex = cellHandlersByBridge.get(scope.send);
  if (byIndex === undefined) {
    byIndex = new Map();
    cellHandlersByBridge.set(scope.send, byIndex);
  }
  const hit = byIndex.get(index);
  if (hit !== undefined) return hit;
  const made: CellHandlerSet = {
    onFocus: () => scope.send({ type: "INPUT.FOCUS", index }),
    onBlur: (event: FocusEvent) => {
      // Focus moving to another cell of this pin is not a blur: the
      // machine would drop to idle and back on every arrow step.
      const target = event.relatedTarget;
      if (target instanceof Element && scope.root().contains(target)) return;
      scope.send({ type: "INPUT.BLUR", index });
    },
    onKeyDown: (event: KeyboardEvent) => {
      const props = scope.props;
      if (event.defaultPrevented) return;
      if (event.isComposing === true || event.keyCode === 229) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const interactive = props["disabled"] !== true && props["readOnly"] !== true;
      const type = pinTypeOf(props);
      // A re-typed character does not rewrite the cell: it advances, which
      // is what makes a filled pin retypeable from the top.
      const retyped = pinView(scope.context.value, scope.context.count).chars[scope.context.focusedIndex] ?? "";
      if (event.key.length === 1 && retyped === event.key) {
        event.preventDefault();
        scope.send({ type: "INPUT.ADVANCE" });
        return;
      }
      switch (eventKey(event, (typeof props["dir"] === "string" ? props["dir"] : ""))) {
        case "Backspace":
          scope.send({ type: "INPUT.BACKSPACE" });
          break;
        case "Delete":
          scope.send({ type: "INPUT.DELETE" });
          break;
        case "ArrowLeft":
          scope.send({ type: "INPUT.ARROW_LEFT" });
          break;
        case "ArrowRight":
          scope.send({ type: "INPUT.ARROW_RIGHT" });
          break;
        case "Enter": {
          // Zag's requestFormSubmit: the hidden input's form, when the
          // host named the pin and the value is complete.
          const ctx = scope.context;
          const view = pinView(ctx.value, ctx.count);
          const name = props["name"];
          if (view.complete && typeof name === "string" && name.length > 0) {
            for (const node of Array.from(scope.root().getElementsByTagName("input"))) {
              if (node instanceof HTMLInputElement && node.id === scope.id("hidden")) {
                node.form?.requestSubmit();
              }
            }
          }
          break;
        }
        case "Home":
          scope.send({ type: "INPUT.HOME" });
          break;
        case "End":
          scope.send({ type: "INPUT.END" });
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    onPaste: (event: ClipboardEvent) => {
      const props = scope.props;
      if (props["disabled"] === true || props["readOnly"] === true) return;
      const raw = event.clipboardData?.getData("text/plain");
      if (raw === undefined || raw.length === 0) return;
      const pasted = resolveSanitize(scope)(raw);
      if (!isValidValue(pasted, pinTypeOf(props), (typeof props["pattern"] === "string" ? props["pattern"] : ""))) {
        // An invalid paste is refused AND reported: the host shows why.
        scope.send({ type: "VALUE.INVALID", value: pasted });
        event.preventDefault();
        return;
      }
      event.preventDefault();
      scope.send({ type: "INPUT.PASTE", value: pasted });
    },
    onBeforeInput: (event: InputEvent) => {
      const props = scope.props;
      if (props["disabled"] === true || props["readOnly"] === true) return;
      const target = event.currentTarget;
      if (!(target instanceof HTMLInputElement)) return;
      if ((event.inputType ?? "").startsWith("delete")) return;
      // The cell as the keystroke would leave it: the character is valid
      // or the keystroke never lands.
      const from = target.selectionStart ?? 0;
      const to = target.selectionEnd ?? from;
      const value = target.value.slice(0, from) + (event.data ?? "") + target.value.slice(to);
      if (!isValidValue(value, pinTypeOf(props), (typeof props["pattern"] === "string" ? props["pattern"] : ""))) {
        scope.send({ type: "VALUE.INVALID", value });
        event.preventDefault();
      }
      // Two characters in one cell can only be the first: keep the second
      // selected so the next keystroke replaces it.
      if (value.length > 1 && typeof target.setSelectionRange === "function") {
        target.setSelectionRange(0, 1, "forward");
      }
    },
    onInput: (event: InputEvent) => {
      const props = scope.props;
      if (props["disabled"] === true || props["readOnly"] === true) return;
      const target = event.currentTarget;
      if (!(target instanceof HTMLInputElement)) return;
      const value = target.value;
      if (event.inputType === "insertFromPaste") {
        // The paste was distributed by INPUT.PASTE already; the cell keeps
        // its first character and no event is sent.
        target.value = value[0] ?? "";
        return;
      }
      if (value.length > 2) {
        // A multi-character insertion that did not come from the clipboard
        // (a drop, an autofill) is a paste for the machine's purposes.
        scope.send({ type: "INPUT.PASTE", value });
        target.value = value[0] ?? "";
        event.preventDefault();
        return;
      }
      if (event.inputType === "deleteContentBackward") {
        scope.send({ type: "INPUT.BACKSPACE" });
        return;
      }
      if (event.inputType === "deleteByCut") {
        scope.send({ type: "INPUT.DELETE" });
        return;
      }
      // The browser reports the character the machine already holds (a
      // selection replaced with the same character): nothing to write.
      const current = pinView(scope.context.value, scope.context.count);
      const focusedValue = current.chars[scope.context.focusedIndex] ?? "";
      if (value === focusedValue) return;
      scope.send({ type: "INPUT.CHANGE", index, value });
    },
  };
  byIndex.set(index, made);
  return made;
};


/** Transport guarantees the raw prop bag is a PinInputInitial-shaped object. */
const isPinInputInitial = (raw: unknown): raw is PinInputInitial =>
  raw !== null && typeof raw === "object";

const def: ComponentDef<PinInputContext, PinInputEvent> = {
  name: "pin-input",
  config,
  implementations,
  // The start state is the machine's own initial; the seed sends below fill
  // the pin through the assigns.
  /** Transport guarantees the raw prop bag is a PinInputInitial-shaped object;
   * the guard asserts that trust point instead of a silent `as`. */
  seed: (raw, authored) => ({ ...initial(isPinInputInitial(raw) ? raw : {}, authored) }),
  reconcile: ({ context, parsed, authored, send }) => {
    const ctx = context;
    if (!authored("value")) return false;
    const chars = parseChars(parsed["value"]);
    if (sameChars(ctx.value, chars)) return false;
    send({ type: "VALUE.SET", value: chars });
    return true;
  },
  scalars: ["count"],
  mounted: ({ props, focus }) => {
    // Zag's entry `choose(autoFocus)`: the index starts on the first cell
    // and that cell takes focus. One microtask out: the bridge is built
    // while the markup renders, so the cells exist but are not in the
    // document yet.
    if (props["autoFocus"] !== true) return;
    queueMicrotask(() => {
      focus("input", 0);
    });
  },
  settled: ({ before, after, props, id, root, focus }) => {
    const beforeCtx = before.context;
    const afterCtx = after.context;
    const index = afterCtx.focusedIndex;
    if (index !== beforeCtx.focusedIndex && index >= 0) {
      focus("input", index);
      // GAP: selectOnFocus requires input.select(); runtime focuser only
      // focuses. Recorded; not reimplemented via node access.
      void props;
    }
    // Zag's watch on `isValueComplete`: the completion is an edge, so the
    // blur and the submit happen once, on the way in.
    const wasComplete = pinView(beforeCtx.value, beforeCtx.count).complete;
    const isComplete = pinView(afterCtx.value, afterCtx.count).complete;
    if (!wasComplete && isComplete) {
      if (props["blurOnComplete"] === true) {
        // The focus leaves the pin: the cell that took it drops it, so the
        // host's own field can take it next.
        const active = root().ownerDocument.activeElement;
        if (active instanceof HTMLElement && root().contains(active)) active.blur();
      }
      if (props["autoSubmit"] === true) {
        const name = props["name"];
        if (typeof name === "string" && name.length > 0) {
          for (const node of Array.from(root().getElementsByTagName("input"))) {
            if (node instanceof HTMLInputElement && node.id === id("hidden")) {
              node.form?.requestSubmit();
            }
          }
        }
      }
    }
    // selectOnFocus handled above is a gap; keep the prop read to avoid
    // unused-prop lint? props already used.
    void id;
  },
  parts: {
    root: {
      id: "",
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.props["dir"], scope.props["invalid"], scope.props["disabled"], scope.props["readOnly"], pinView(ctx.value, ctx.count).complete].join("");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id(""),
            "data-scope": "pin-input",
            "data-part": "root",
          dir: scope.props["dir"],
          "data-invalid": scope.attr(scope.props["invalid"] === true),
          "data-disabled": scope.attr(scope.props["disabled"] === true),
          "data-complete": scope.attr(pinView(ctx.value, ctx.count).complete),
          "data-readonly": scope.attr(scope.props["readOnly"] === true),
        };
      },
    },
    label: {
      sig: (scope) => {
        const ctx = scope.context;
        return [scope.props["dir"], scope.props["invalid"], scope.props["disabled"], scope.props["readOnly"], scope.props["required"], pinView(ctx.value, ctx.count).complete].join("");
      },
      attrs: (scope) => ({
        id: scope.id("label"),
          "data-scope": "pin-input",
          "data-part": "label",
        dir: scope.props["dir"],
        for: scope.id("hidden"),
        "data-invalid": scope.attr(scope.props["invalid"] === true),
        "data-disabled": scope.attr(scope.props["disabled"] === true),
        "data-complete": scope.attr(pinView(scope.context.value, scope.context.count).complete),
        "data-required": scope.attr(scope.props["required"] === true),
        "data-readonly": scope.attr(scope.props["readOnly"] === true),
        onClick: (event: MouseEvent) => {
          // The label's control is the hidden input, which cannot take
          // focus; the first cell can.
          event.preventDefault();
          scope.send({ type: "INPUT.FOCUS", index: 0 });
        },
      }),
    },
    control: {
      sig: (scope) => [scope.props["dir"]].join(""),
      attrs: (scope) => ({
        id: scope.id("control"),
          "data-scope": "pin-input",
          "data-part": "control",
        dir: scope.props["dir"],
      }),
    },
    hiddenInput: {
      id: "hidden",
      sig: (scope) => {
        const ctx = scope.context;
        const joined = pinView(ctx.value, ctx.count);
        return [joined.asString, joined.length, scope.props["name"], scope.props["form"], scope.props["disabled"], scope.props["readOnly"], scope.props["required"]].join("");
      },
      attrs: (scope) => {
        const ctx = scope.context;
        const joined = pinView(ctx.value, ctx.count);
        return {
          id: scope.id("hiddenInput"),
            "data-scope": "pin-input",
            "data-part": "hidden-input",
          "aria-hidden": true,
          type: "text",
          tabIndex: -1,
          hidden: true,
          disabled: scope.props["disabled"],
          readOnly: scope.props["readOnly"],
          required: scope.props["required"],
          name: scope.props["name"],
          form: scope.props["form"],
          maxLength: joined.length,
          // The value rides the assignable path, so a machine move writes it
          // without a hand-rolled sync.
          value: joined.asString,
        };
      },
    },
  },
  slots: {
    input: {
      indexes: (context) => cellIndexes(context.count),
      sig: (scope: SlotLike<{ readonly index: number }>) => {
        const index = slotIndex(scope);
        const ctx = scope.context;
        const filled = pinView(ctx.value, ctx.count);
        const char = filled.chars[index] ?? "";
        const focused = ctx.focusedIndex;
        const tabbable = focused !== -1 ? focused : Math.min(filled.filled, filled.length - 1);
        const label = resolveTranslations(scope).inputLabel(index, filled.length);
        return [char, filled.complete, scope.props["invalid"], scope.props["disabled"], scope.props["readOnly"], scope.props["dir"], scope.props["mask"], scope.props["otp"], scope.props["type"], scope.props["placeholder"], scope.props["required"], label, index === tabbable, focused === index, filled.length].join("");
      },
      attrs: (scope: SlotLike<{ readonly index: number }>) => {
        const index = slotIndex(scope);
        const ctx = scope.context;
        const props = scope.props;
        const filled = pinView(ctx.value, ctx.count);
        const char = filled.chars[index] ?? "";
        const focused = ctx.focusedIndex;
        const tabbable = focused !== -1 ? focused : Math.min(filled.filled, filled.length - 1);
        const label = resolveTranslations(scope).inputLabel(index, filled.length);
        const type = pinTypeOf(props);
        const interactive = props["disabled"] !== true && props["readOnly"] !== true;
        return {
          id: scope.id("input", index),
            "data-scope": "pin-input",
            "data-part": "input",
          dir: props["dir"],
          disabled: props["disabled"],
          tabIndex: index === tabbable ? 0 : -1,
          "data-index": index,
          "data-disabled": scope.attr(props["disabled"] === true),
          "data-complete": scope.attr(filled.complete),
          "data-filled": scope.attr(char !== ""),
          "data-invalid": scope.attr(props["invalid"] === true),
          "aria-invalid": props["invalid"] === true ? true : undefined,
          "aria-label": label,
          inputMode: props["otp"] === true || type === "numeric" ? "numeric" : "text",
          enterKeyHint: index === filled.length - 1 ? "done" : "next",
          type: props["mask"] === true ? "password" : type === "numeric" ? "tel" : "text",
          // The assignable path: a machine move writes the character here.
          value: char,
          readOnly: props["readOnly"],
          autoCapitalize: "none",
          autoComplete: props["otp"] === true ? "one-time-code" : "off",
          placeholder: focused === index ? "" : (typeof props["placeholder"] === "string" ? props["placeholder"] : DEFAULT_PLACEHOLDER),
          ...cellHandlers(scope, index),
        };
      },
    },
  },
  commands: {
    focus: { view: ({ focus }) => focus("input", 0) },
    setValue: { event: (args: readonly unknown[]) => { const v = args[0]; return { type: "VALUE.SET", value: Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? [...v] : [] }; } },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
    setValueAtIndex: {
      event: (args: readonly unknown[]) => { const v = args[1]; const i = args[0]; return { type: "VALUE.SET", value: typeof v === "string" ? v : "", index: typeof i === "number" ? Math.trunc(i) : 0 }; },
    },
  },
  readers: {
    count: { read: (context) => context.count },
    items: { read: (context) => cellIndexes(context.count) },
    value: { read: (context) => [...context.value] },
    valueAsString: { read: (context) => pinView(context.value, context.count).asString },
    complete: {
      read: (context) => {
        const ctx = context;
        return pinView(ctx.value, ctx.count).complete;
      },
    },
    focused: { read: (_context, state) => state === "focused" },
  },
  methods: {
    getItems: {
      call: (context) => cellIndexes(context.count),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => {
        const ctx = context;
        return [...pinView(ctx.value, ctx.count).chars];
      },
      detail: (watched, _event, _props, context) => {
        if (context === undefined) return { value: [], valueAsString: "" };
        const view = pinView(context.value, context.count);
        void watched;
        return { value: [...view.chars], valueAsString: view.asString };
      },
    },
    "value-complete": {
      prop: "onValueComplete",
      watch: (context) => {
        const ctx = context;
        return [pinView(ctx.value, ctx.count).complete];
      },
      detail: (_watched, _event, _props, context) => {
        if (context === undefined) return { value: [], valueAsString: "" };
        const view = pinView(context.value, context.count);
        return { value: [...view.chars], valueAsString: view.asString };
      },
    },
    "value-invalid": {
      prop: "onValueInvalid",
      watch: () => [],
      detail: (watched: readonly [string, number]) => ({ value: watched[0], index: watched[1] }),
      select: (event, _before, after) => {
        if (event.type !== "VALUE.INVALID") return null;
        const ctx = after;
        return {
          value: typeof event.value === "string" ? event.value : "",
          index: ctx.focusedIndex,
        };
      },
    },
  },
};

export const pinInput = defineComponent<PinInputContext, PinInputEvent, PinInputApi>(def);
