import { ariaHidden, ariaInvalid, defineComponent, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  pinInput as pinInputMachine,
  pinView,
  type PinInputArgs,
  type PinInputContext,
  type PinInputEvents,
  type PinInputValueChange,
  type PinInputValueComplete,
  type PinInputValueInvalid,
} from "./pin-input.machine.ts";

/** Pin-input definition: the DOM contract as data. */

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

/** The type union has three members; anything else is numeric. */
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
          // The hidden input's form submits, when the host named the pin
          // and the value is complete.
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

const def: ComponentDef<PinInputContext, PinInputEvents> = {
  name: "pin-input",
  machine: (props, authored) => pinInputMachine(props as PinInputArgs, authored),
  mounted: ({ props, focus }) => {
    // One microtask out: the bridge is built while the markup renders, so
    // the cells exist but are not in the document yet.
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
      // selectOnFocus is a gap: the runtime focuser only focuses.
      void props;
    }
    // The completion is an edge, so the blur and the submit happen once,
    // on the way in.
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
    void id;
  },
  parts: {
    root: {
      id: "",
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
      attrs: (scope) => ({
        id: scope.id("control"),
          "data-scope": "pin-input",
          "data-part": "control",
        dir: scope.props["dir"],
      }),
    },
    hiddenInput: {
      id: "hidden",
      attrs: (scope) => {
        const ctx = scope.context;
        const joined = pinView(ctx.value, ctx.count);
        return {
          id: scope.id("hiddenInput"),
            "data-scope": "pin-input",
            "data-part": "hidden-input",
          ...ariaHidden(true),
          type: "text",
          tabIndex: -1,
          hidden: true,
          disabled: scope.props["disabled"],
          readOnly: scope.props["readOnly"],
          required: scope.props["required"],
          name: scope.props["name"],
          form: scope.props["form"],
          maxLength: joined.length,
          // The value rides the assignable path: a machine move writes it.
          value: joined.asString,
        };
      },
    },
  },
  slots: {
    input: {
      indexes: (context) => cellIndexes(context.count),
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
          ...ariaInvalid(props["invalid"] === true ? true : undefined),
          "aria-label": label,
          inputMode: props["otp"] === true || type === "numeric" ? "numeric" : "text",
          enterKeyHint: index === filled.length - 1 ? "done" : "next",
          type: props["mask"] === true ? "password" : type === "numeric" ? "tel" : "text",
          // The assignable path: a machine move writes the character.
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

export const pinInput = defineComponent<PinInputContext, PinInputEvents, PinInputApi>(def);
