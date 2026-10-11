import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotEditable,
  type EditableFsmApi,
  type EditableFsmConnectProps,
  type EditableHooks,
  type EditableService,
} from "./editable.connect.ts";
import type { InteractOutsideEvent } from "./actions/interact-outside.action.ts";
import {
  config,
  implementations,
  type EditableContext,
  type EditableEvent,
} from "./editable.machine.ts";

export interface EditableValueChange {
  readonly value: string;
}

export interface EditableEditChange {
  readonly edit: boolean;
}

export type { InteractOutsideEvent };

export interface EditableCallbacks {
  readonly onValueChange: ((details: EditableValueChange) => void) | undefined;
  readonly onEditChange: ((details: EditableEditChange) => void) | undefined;
  readonly onValueCommit: ((details: EditableValueChange) => void) | undefined;
  readonly onValueRevert: ((details: EditableValueChange) => void) | undefined;
  readonly onFocusOutside: ((event: InteractOutsideEvent) => void) | undefined;
  readonly onPointerDownOutside: ((event: InteractOutsideEvent) => void) | undefined;
  readonly onInteractOutside: ((event: InteractOutsideEvent) => void) | undefined;
}

const ACTIVATION_MODES = ["focus", "click", "dblclick", "none"] as const;
const SUBMIT_MODES = ["enter", "blur", "both", "none"] as const;

const pickMode = <T extends string>(raw: unknown, modes: readonly T[], fallback: T): T =>
  typeof raw === "string" && (modes as readonly string[]).includes(raw) ? (raw as T) : fallback;

/**
 * The editable bridge: scope values in, machine state out.
 *
 * Four jobs: seed the first state from `default*`, alternate it from an
 * authored `value`/`edit`, sync the scalars the assigns read, and report the
 * four callbacks Zag's machine fired from inside its actions — this machine
 * is pure, so the transition the bridge watches IS the callback.
 *
 * The controlled channel is the authored-prop predicate (`@@authored`) — a
 * coerced default is never a write, which is the `value` vs `defaultValue`
 * distinction Zag gets from its bindables and the scope grammar cannot make
 * on its own.
 */
export function createEditableFsmBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: EditableFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // `config.context` is the module's object: a bridge per element must get
  // its own, or two editables on a page hold one value.
  const machine = createMachine<EditableContext, EditableEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: FsmService<EditableContext, EditableEvent> | undefined;
  // The reflexes the connect fills; the bridge calls them on a transition.
  const hooks: EditableHooks = {};

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): EditableCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value: unknown = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: EditableValueChange) => void>("onValueChange"),
      onEditChange: pick<(d: EditableEditChange) => void>("onEditChange"),
      onValueCommit: pick<(d: EditableValueChange) => void>("onValueCommit"),
      onValueRevert: pick<(d: EditableValueChange) => void>("onValueRevert"),
      onFocusOutside: pick<(e: InteractOutsideEvent) => void>("onFocusOutside"),
      onPointerDownOutside: pick<(e: InteractOutsideEvent) => void>("onPointerDownOutside"),
      onInteractOutside: pick<(e: InteractOutsideEvent) => void>("onInteractOutside"),
    };
  };

  /** The scalars the assigns read, synced from scope. */
  const readContextProps = (): Pick<EditableContext, "maxLength" | "editControlled"> => {
    const p = props();
    const max: unknown = p["maxLength"];
    return {
      maxLength: typeof max === "number" && max > 0 ? Math.trunc(max) : null,
      editControlled: authored("editing"),
    };
  };

  const readConnectProps = (): EditableFsmConnectProps => {
    const p = props();
    const placeholder = typeof p["placeholder"] === "string" ? p["placeholder"] : "";
    const name = typeof p["name"] === "string" && p["name"].length > 0 ? p["name"] : undefined;
    const form = typeof p["form"] === "string" && p["form"].length > 0 ? p["form"] : undefined;
    const finalFocus =
      typeof p["finalFocus"] === "string" && p["finalFocus"].length > 0 ? p["finalFocus"] : undefined;
    const callbacks = readCallbacks();
    return {
      activationMode: pickMode(p["activationMode"], ACTIVATION_MODES, "focus"),
      submitMode: pickMode(p["submitMode"], SUBMIT_MODES, "both"),
      autoResize: p["autoResize"] === true,
      selectOnFocus: p["selectOnFocus"] !== false,
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      maxLength: readContextProps().maxLength,
      dir: typeof p["dir"] === "string" && p["dir"].length > 0 ? p["dir"] : "ltr",
      name,
      form,
      placeholder:
        placeholder.length === 0
          ? { edit: undefined, preview: undefined }
          : { edit: placeholder, preview: placeholder },
      finalFocus,
      onFocusOutside: callbacks.onFocusOutside,
      onPointerDownOutside: callbacks.onPointerDownOutside,
      onInteractOutside: callbacks.onInteractOutside,
    };
  };

  const ensureService = (): FsmService<EditableContext, EditableEvent> => {
    if (service) return service;
    const p = props();
    const edit = authored("editing") ? p["editing"] === true : p["defaultEdit"] === true;
    const seeded = authored("value") && typeof p["value"] === "string"
      ? p["value"]
      : typeof p["defaultValue"] === "string"
        ? p["defaultValue"]
        : "";
    service = owner.run(() => {
      const started = edit ? interpret(machine).start("edit") : interpret(machine).start();
      Object.assign(started.state.context, readContextProps(), { value: seeded });
      return started;
    });
    return service;
  };

  /** The last event sent, which is what a controlled close reads to tell a
   * commit from a cancel — Zag's `previousEvent`. */
  let lastEventType = "";

  /**
   * Every event the view sends goes through here, so one place reports the
   * four callbacks. The cursors advance only after the callbacks: the fork's
   * send is synchronous, so a post-send check would already see the new
   * state.
   */
  const send = (event: EditableEvent): void => {
    const svc = ensureService();
    const wasEditing = svc.state.matches("edit");
    const before = svc.state.context.value;
    Object.assign(svc.state.context, readContextProps());
    lastEventType = event.type;
    svc.send(event);
    const after = svc.state.context;
    const callbacks = readCallbacks();
    if (after.value !== before) {
      callbacks.onValueChange?.({ value: after.value });
    }
    const editing = svc.state.matches("edit");
    if (wasEditing && !editing) {
      // A controlled close right after a submit commits; anything else
      // reverts, exactly as the machine's `isSubmitEvent` guard decides.
      const committed =
        event.type === "SUBMIT" ||
        (event.type === "CONTROLLED.PREVIEW" && event.previousEvent === "SUBMIT");
      if (committed) callbacks.onValueCommit?.({ value: after.value });
      else callbacks.onValueRevert?.({ value: after.previousValue });
      hooks.onEnterPreview?.(
        event.type === "SUBMIT" || event.type === "CANCEL" ? event.focusable === true : false,
      );
    } else if (!wasEditing && editing) {
      hooks.onEnterEdit?.();
    }
    // The two moves the view asks for. A controlled close reports nothing:
    // the host wrote the prop, so it already knows — Zag's
    // CONTROLLED.EDIT/PREVIEW carry no invoke callbacks, while the
    // unguarded branch of a controlled SUBMIT or CANCEL does.
    if (event.type === "EDIT") callbacks.onEditChange?.({ edit: true });
    if (event.type === "SUBMIT" || event.type === "CANCEL") {
      callbacks.onEditChange?.({ edit: false });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: a tick read here would be a dependency, and
   * every later send would re-run this effect and re-impose the authored prop
   * over the machine's own move. The send inside a move reports itself through
   * `machineTick`, which is what wakes the bindings.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const next = readContextProps();
      if (svc.state.context.maxLength !== next.maxLength) {
        svc.state.context.maxLength = next.maxLength;
      }
      if (svc.state.context.editControlled !== next.editControlled) {
        svc.state.context.editControlled = next.editControlled;
      }
      if (authored("value")) {
        const outer: unknown = props()["value"];
        const nextValue = typeof outer === "string" ? outer : "";
        if (svc.state.context.value !== nextValue) {
          untrack(() => send({ type: "VALUE.SET", value: nextValue }));
        }
      }
      if (authored("editing")) {
        const wants = props()["editing"] === true;
        if (wants !== svc.state.matches("edit")) {
          untrack(() =>
            send(
              wants
                ? { type: "CONTROLLED.EDIT" }
                : { type: "CONTROLLED.PREVIEW", previousEvent: lastEventType },
            ),
          );
        }
      }
    }),
  );

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: EditableService = {
    get context() {
      return ensureService().state.context;
    },
    get editing() {
      return ensureService().state.matches("edit");
    },
    send: send as (event: { type: string } & Record<string, unknown>) => void,
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, and rebuilding it per move would hand out fresh
   * bag objects each read. */
  let editableConnect: EditableFsmApi | undefined;
  const ensureConnect = (): EditableFsmApi => {
    if (editableConnect !== undefined) return editableConnect;
    editableConnect = connectRobotEditable(serviceApi, readConnectProps, id, hooks);
    // Zag's `entry: focusInputIfNeeded`: a field that opens in edit mode
    // takes focus on mount.
    if (editableConnect.editing) hooks.onEnterEdit?.();
    return editableConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as EditableFsmApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
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
