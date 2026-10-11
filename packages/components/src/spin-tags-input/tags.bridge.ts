import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotTagsInput,
  type TagsFsmApi,
  type TagsFsmConnectProps,
  type TagsTranslations,
} from "./tags.connect.ts";
import {
  config,
  implementations,
  type SanitizeValue,
  type TagsContext,
  type TagsEvent,
  type TagsHighlightChange,
  type TagsInputValueChange,
  type TagsValueChange,
  type TagsValueInvalid,
  type ValidateTag,
} from "./tags.machine.ts";

export type {
  TagsHighlightChange,
  TagsInputValueChange,
  TagsValueChange,
  TagsValueInvalid,
};

/** The element's imperative surface, declared in the def's `commands` and
 * typed once here so hosts (and tests) call it without a cast. */
export interface TagsCommands {
  setValue(value: readonly string[]): void;
  addValue(value: string): void;
  setValueAtIndex(index: number, value: string): void;
  clearValue(id?: string | number): void;
  setInputValue(value: string): void;
  clearInputValue(): void;
  focus(): void;
}

const defaultTranslations: TagsTranslations = {
  clearTriggerLabel: "Clear all tags",
  deleteTagTriggerLabel: (value: string): string => `Delete tag ${value}`,
  tagAdded: (value: string): string => `Added tag ${value}`,
  tagEdited: (value: string): string =>
    `Editing tag ${value}. Press enter to save or escape to cancel.`,
  tagUpdated: (value: string): string => `Tag update to ${value}`,
  tagDeleted: (value: string): string => `Tag ${value} deleted`,
  tagSelected: (value: string): string =>
    `Tag ${value} selected. Press enter to edit, delete or backspace to remove.`,
  tagsPasted: (values: readonly string[]): string => `Pasted ${values.length} tags`,
  noTagsSelected: "No tags selected",
};

const defaultSanitize: SanitizeValue = (value: string): string => value.trim();
const defaultValidate: ValidateTag = (): boolean => true;

/**
 * Zag's `mergeWithDefault(defaultTranslations, prop("translations"))`: a
 * host overrides individual members and the rest keep their English
 * default. The shape is validated here rather than trusted at every read.
 */
function parseTranslations(raw: unknown): TagsTranslations {
  if (typeof raw !== "object" || raw === null) return defaultTranslations;
  const text = (key: string, fallback: string): string => {
    const value: unknown = Reflect.get(raw, key);
    return typeof value === "string" ? value : fallback;
  };
  const one = (
    key: string,
    fallback: (value: string) => string,
  ): ((value: string) => string) => {
    const value: unknown = Reflect.get(raw, key);
    return typeof value === "function"
      ? (value as (input: string) => string)
      : fallback;
  };
  const many = (
    key: string,
    fallback: (values: readonly string[]) => string,
  ): ((values: readonly string[]) => string) => {
    const value: unknown = Reflect.get(raw, key);
    return typeof value === "function"
      ? (value as (input: readonly string[]) => string)
      : fallback;
  };
  return {
    clearTriggerLabel: text("clearTriggerLabel", defaultTranslations.clearTriggerLabel),
    deleteTagTriggerLabel: one("deleteTagTriggerLabel", defaultTranslations.deleteTagTriggerLabel),
    tagAdded: one("tagAdded", defaultTranslations.tagAdded),
    tagEdited: one("tagEdited", defaultTranslations.tagEdited),
    tagUpdated: one("tagUpdated", defaultTranslations.tagUpdated),
    tagDeleted: one("tagDeleted", defaultTranslations.tagDeleted),
    tagSelected: one("tagSelected", defaultTranslations.tagSelected),
    tagsPasted: many("tagsPasted", defaultTranslations.tagsPasted),
    noTagsSelected: text("noTagsSelected", defaultTranslations.noTagsSelected),
  };
}

/**
 * A prop the scope grammar cannot declare. Function- and object-valued
 * host inputs (`validate`, `sanitizeValue`, `translations`, the three
 * interact-outside callbacks) have no `bool|string|int|string[]` form, so
 * the element property they are written to is the channel: the framework
 * hooks write every host prop as an element property, and the bridge reads
 * it back off the root. Read live, so a late write reaches the next send.
 */
const hostProp = (root: () => Element, name: string): unknown => Reflect.get(root(), name);

const sameTags = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

type ScalarKey =
  | "max"
  | "allowOverflow"
  | "allowDuplicates"
  | "editable"
  | "addOnPaste"
  | "addOnBlur"
  | "clearOnBlur"
  | "delimiter"
  | "sanitizeValue"
  | "validate";

const SCALAR_KEYS: readonly ScalarKey[] = [
  "max",
  "allowOverflow",
  "allowDuplicates",
  "editable",
  "addOnPaste",
  "addOnBlur",
  "clearOnBlur",
  "delimiter",
  "sanitizeValue",
  "validate",
];

/** The scalars the guards and assigns read. `sanitizeValue` and `validate`
 * are the two behavioral functions; they are host props, not callbacks. */
const readScalars = (
  props: () => Record<string, unknown>,
  root: () => Element,
): Pick<TagsContext, ScalarKey> => {
  const p = props();
  const max = p["max"];
  const blur = p["blurBehavior"];
  const delimiter = p["delimiter"];
  const sanitize = hostProp(root, "sanitizeValue");
  const validate = hostProp(root, "validate");
  return {
    max: typeof max === "number" && Number.isFinite(max) ? max : Infinity,
    allowOverflow: p["allowOverflow"] === true,
    allowDuplicates: p["allowDuplicates"] === true,
    editable: p["editable"] !== false,
    addOnPaste: p["addOnPaste"] === true,
    addOnBlur: blur === "add",
    clearOnBlur: blur === "clear",
    delimiter: typeof delimiter === "string" ? delimiter : ",",
    sanitizeValue: typeof sanitize === "function"
      ? (sanitize as SanitizeValue)
      : defaultSanitize,
    validate: typeof validate === "function" ? (validate as ValidateTag) : defaultValidate,
  };
};

/**
 * The tags-input bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from `defaultValue`/`defaultInputValue`
 * (and `autoFocus`), alternate the controlled `value`/`inputValue` from
 * authored props, sync the scalars the assigns read, and publish the
 * connect api through the live-view proxy. The change callbacks and the
 * live-region announcements are fired from one funnel after every send —
 * the fork's send is synchronous, so a post-send read already sees the
 * new value and a "before" snapshot is the only honest diff.
 */
export function createTagsFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: TagsFsmApi & TagsCommands; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<TagsContext, TagsEvent>(config, implementations);

  let service: FsmService<TagsContext, TagsEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  let seedValue: readonly string[] = [];

  const ensureService = (): FsmService<TagsContext, TagsEvent> => {
    if (service) return service;
    const p = props();
    const seed = Array.isArray(p["defaultValue"]) ? [...(p["defaultValue"] as string[])] : [];
    const seedInput = typeof p["defaultInputValue"] === "string" ? p["defaultInputValue"] : "";
    service = owner.run(() => {
      // Seeded through events, not a write: the fork's initial context IS
      // the config's object until a transition folds a copy, so two tags
      // inputs on a page would otherwise share one context until their
      // first interaction. `focused:input` as the start state is Zag's
      // autoFocus, and its focus reflex is the connect's, not the config's.
      const svc = interpret(machine).start(p["autoFocus"] === true ? "focused:input" : "idle");
      svc.send({ type: "SET_VALUE", value: seed });
      if (seedInput.length > 0) svc.send({ type: "SET_INPUT_VALUE", value: seedInput });
      Object.assign(svc.state.context, readScalars(props, root));
      return svc;
    });
    seedValue = seed;
    return service;
  };

  const controlledValue = (): string[] | undefined => {
    if (!authored("value")) return undefined;
    const outer = props()["value"];
    return Array.isArray(outer) ? [...(outer as string[])] : undefined;
  };

  const controlledInputValue = (): string | undefined => {
    if (!authored("inputValue")) return undefined;
    const outer = props()["inputValue"];
    return typeof outer === "string" ? outer : undefined;
  };

  /** One context scalar, when the prop moved. Generic over the key so the
   * write stays type-checked across the union. */
  const syncScalar = <K extends ScalarKey>(
    ctx: TagsContext,
    key: K,
    value: TagsContext[K],
  ): boolean => {
    if (ctx[key] === value) return false;
    ctx[key] = value;
    return true;
  };

  const applyHostWrites = (ctx: TagsContext): boolean => {
    let moved = false;
    const scalars = readScalars(props, root);
    for (const key of SCALAR_KEYS) {
      if (syncScalar(ctx, key, scalars[key])) moved = true;
    }
    const outerValue = controlledValue();
    if (outerValue !== undefined && !sameTags(outerValue, ctx.value)) {
      ctx.value = outerValue;
      moved = true;
    }
    const outerInput = controlledInputValue();
    if (outerInput !== undefined && outerInput !== ctx.inputValue) {
      ctx.inputValue = outerInput;
      moved = true;
    }
    return moved;
  };

  /**
   * Host writes alternate on their own, not on the next machine event: an
   * owned effect reads the live props (so it subscribes to the prop
   * signals) and applies them straight into context. The wake-up write is
   * untracked and comes from a plain counter — a tick read or a tracked
   * write here would subscribe this effect to the very signal every
   * machine move bumps, and each move would re-run it and re-impose the
   * authored prop over the machine's own transition (the controlled-value
   * lesson).
   */
  let revision = 0;
  // Created before the effect exists: the seed is sent through the service,
  // and a first creation inside the effect would subscribe it to the very
  // machineTick every later move bumps.
  ensureService();
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      if (applyHostWrites(svc.state.context)) {
        // Read-modify-write inside untrack: the read is what guarantees the
        // new value differs from the one a send just wrote (a private
        // counter can collide and leave the api's computed un-invalidated),
        // and untrack keeps this effect from subscribing to the signal it
        // bumps — otherwise every machine move would re-run it and
        // re-impose the authored prop.
        revision++;
        untrack(() => tick(tick() + 1));
      }
    }),
  );

  const fireCallbacks = (
    before: {
      value: readonly string[];
      inputValue: string;
      highlightedIndex: number | null;
      overflowing: boolean;
    },
    after: TagsContext,
  ): void => {
    const p = props();
    if (!sameTags(before.value, after.value)) {
      (p["onValueChange"] as ((d: TagsValueChange) => void) | undefined)?.({
        value: [...after.value],
      });
    }
    if (before.inputValue !== after.inputValue) {
      (p["onInputValueChange"] as ((d: TagsInputValueChange) => void) | undefined)?.({
        inputValue: after.inputValue,
      });
    }
    if (before.highlightedIndex !== after.highlightedIndex) {
      (p["onHighlightChange"] as ((d: TagsHighlightChange) => void) | undefined)?.({
        highlightedValue: after.highlightedIndex,
      });
    }
    const invalid = p["onValueInvalid"] as ((d: TagsValueInvalid) => void) | undefined;
    if (after.refusal !== null) {
      invalid?.({ reason: after.refusal });
      after.refusal = null;
    }
    // Zag's invokeOnInvalid watch: the overflow report is an edge, so it
    // fires on the way into the state and never while already there.
    const overflowing = after.value.length > after.max;
    if (!before.overflowing && overflowing) invalid?.({ reason: "rangeOverflow" });
  };

  const send = (event: TagsEvent): void => {
    const svc = ensureService();
    const before = {
      value: [...svc.state.context.value],
      inputValue: svc.state.context.inputValue,
      highlightedIndex: svc.state.context.highlightedIndex,
      overflowing: svc.state.context.value.length > svc.state.context.max,
      log: svc.state.context.log,
    };
    applyHostWrites(svc.state.context);
    svc.send(event);
    const after = svc.state.context;
    fireCallbacks(before, after);
    if (before.log !== after.log) ensureConnect().announceLog();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The behavioral props, read per connect call rather than snapshotted:
   * the connect is long-lived, so a host write has to reach the handlers
   * it holds. */
  const readConnectProps = (): TagsFsmConnectProps => {
    const p = props();
    const svc = ensureService();
    const state = svc.state.context;
    const dir = p["dir"];
    const maxLength = p["maxLength"];
    const name = p["name"];
    const form = p["form"];
    const placeholder = p["placeholder"];
    const label = p["label"];
    const pointerDownOutside = hostProp(root, "onPointerDownOutside");
    const interactOutside = hostProp(root, "onInteractOutside");
    const focusOutside = hostProp(root, "onFocusOutside");
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true || state.value.length > state.max,
      required: p["required"] === true,
      dir: dir === "rtl" ? "rtl" : "ltr",
      placeholder: typeof placeholder === "string" ? placeholder : "",
      maxLength: typeof maxLength === "number" && Number.isFinite(maxLength) ? maxLength : undefined,
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      form: typeof form === "string" && form.length > 0 ? form : undefined,
      label: typeof label === "string" ? label : "",
      delimiter: state.delimiter,
      initialValue: seedValue,
      translations: parseTranslations(hostProp(root, "translations")),
      onPointerDownOutside: typeof pointerDownOutside === "function"
        ? (pointerDownOutside as (event: PointerEvent) => void)
        : undefined,
      onInteractOutside: typeof interactOutside === "function"
        ? (interactOutside as (event: PointerEvent) => void)
        : undefined,
      onFocusOutside: typeof focusOutside === "function"
        ? (focusOutside as (event: FocusEvent) => void)
        : undefined,
    };
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state and its row handlers against the rows
   * themselves, so rebuilding it per move is what orphaned listeners and
   * re-inserted rows in the menu port. */
  let tagsConnect: TagsFsmApi | undefined;
  const ensureConnect = (): TagsFsmApi => {
    tagsConnect ??= connectRobotTagsInput(
      {
        send: send as (event: { type: string } & Record<string, unknown>) => void,
        get context() {
          return ensureService().state.context;
        },
        get state() {
          return ensureService().state;
        },
      },
      readConnectProps,
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      root,
    );
    return tagsConnect;
  };

  /** The api is read on every machine move, so this depends on the tick.
   * The hand-out is a fresh object per tick — a stable one would leave the
   * `for` bindings that read it un-notified — while the connect behind it
   * is long-lived: its bags and row handlers are memoized inside it, so no
   * listener is re-attached and no row node is re-inserted. */
  const connected = computed(() => {
    tick();
    return { ...ensureConnect() };
  });

  // Imperative commands resolve INSIDE the trap: assigning onto a live-view
  // proxy is shadowed by its own get trap and the host would call undefined.
  const commands: TagsCommands = {
    setValue: (value: readonly string[]): void => send({ type: "SET_VALUE", value: [...value] }),
    addValue: (value: string): void => send({ type: "ADD_TAG", value }),
    setValueAtIndex: (index: number, value: string): void =>
      send({ type: "SET_VALUE_AT_INDEX", index, value }),
    clearValue: (id?: string | number): void => {
      if (id === undefined) {
        send({ type: "CLEAR_VALUE" });
        return;
      }
      const index = typeof id === "number" ? id : ensureConnect().indexOfId(id);
      if (index === -1) return;
      send({ type: "CLEAR_TAG", index });
    },
    setInputValue: (value: string): void => send({ type: "SET_INPUT_VALUE", value }),
    clearInputValue: (): void => send({ type: "SET_INPUT_VALUE", value: "" }),
    focus: (): void => ensureConnect().focusInput(),
  };

  const api = new Proxy({} as TagsFsmApi & TagsCommands, {
    get: (_target, key) =>
      key in commands ? Reflect.get(commands, key) : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: Reflect.get(commands, key) };
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
