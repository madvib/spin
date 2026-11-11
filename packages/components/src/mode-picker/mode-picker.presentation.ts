import {
  type ApiOf,
  ariaHidden,
  type ComponentDef,
  defineComponent,
  type ViewFor,
} from "@spinjs/components/runtime";
import { modePicker as modePickerMachine } from "./mode-picker.machine.ts";
import type {
  ModePickerEvents,
  ModePickerValueChange,
} from "./mode-picker.events.ts";
import type {
  ModeChoice,
  ModePickerArgs,
  ModePickerContext,
  ResolvedMode,
} from "./mode-picker.state.ts";
import {
  isSingleMode,
  nextModeChoice,
  readRuntimeModes,
  resolveEffectiveMode,
} from "./mode-picker.state.ts";
export type { ModeChoice, ModePickerArgs, ModePickerValueChange, ResolvedMode };

type Ctx = ModePickerContext;
type ScopeLike = ViewFor<ModePickerContext, ModePickerEvents, "idle">;

function readStored(storageKey: string): ModeChoice | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : null;
  } catch {
    return null;
  }
}

const observedRoots = new WeakSet<Element>();

function prefersDark(): boolean {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches;
}

function observeSystem(
  root: Element,
  send: (event: { type: string } & Record<string, unknown>) => void,
): void {
  if (typeof matchMedia !== "function") return;
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  const query = matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", () => {
    send({
      type: "SYSTEM.SET",
      systemMode: query.matches ? "dark" : "light",
    });
  });
}

const modesObservedRoots = new WeakSet<Element>();

function observeModes(
  root: Element,
  send: (event: { type: string } & Record<string, unknown>) => void,
): void {
  if (typeof MutationObserver !== "function") return;
  if (modesObservedRoots.has(root)) return;
  modesObservedRoots.add(root);
  const head = docOf(root)?.head;
  if (head === undefined || head === null) return;
  const observer = new MutationObserver(() => {
    const declared = readRuntimeModes(root);
    if (declared.length > 0) send({ type: "MODES.SET", modes: declared });
  });
  observer.observe(head, { childList: true, subtree: true, characterData: true });
}

/** The document the component lives in, via its own root — never the global. */
function docOf(root: Element): Document | null {
  return root.ownerDocument ?? null;
}

function writeDocument(root: Element, mode: ResolvedMode): void {
  const doc = docOf(root);
  if (doc !== null) doc.documentElement.dataset["mode"] = mode;
}

export const def = {
  name: "mode-picker",
  machine: (args: ModePickerArgs, authored) =>
    modePickerMachine(args, authored),
  start: "idle",
  scalars: ["hideWhenSingle", "storageKey", "syncDocument"],
  parts: {
    root: {
      attrs: (scope: ScopeLike) => {
        const single = isSingleMode(scope.context.modes);
        return {
          "data-mode": resolveEffectiveMode(
            scope.context.value,
            scope.context.modes,
            scope.context.systemMode,
          ),
          "data-choice": scope.context.value,
          "data-single-mode": scope.attr(single),
          hidden:
            scope.context.hideWhenSingle && single ? true : undefined,
        };
      },
    },
    trigger: {
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        const single = isSingleMode(ctx.modes);
        const resolved = resolveEffectiveMode(
          ctx.value,
          ctx.modes,
          ctx.systemMode,
        );
        return {
          type: "button",
          disabled: single ? true : undefined,
          hidden: ctx.hideWhenSingle && single ? true : undefined,
          "aria-label": single
            ? `Only ${ctx.modes[0] ?? "light"} mode`
            : `Switch to ${nextModeChoice(ctx.value)} mode`,
          title: single
            ? `Only ${ctx.modes[0] ?? "light"} mode`
            : `Switch to ${nextModeChoice(ctx.value)} mode`,
          "data-mode": ctx.value,
          "data-resolved-mode": resolved,
          "data-single-mode": scope.attr(single),
          onClick: () => {
            scope.send({ type: "CYCLE" });
          },
        };
      },
    },
    icon: {
      attrs: (scope: ScopeLike) => {
        const resolved = resolveEffectiveMode(
          scope.context.value,
          scope.context.modes,
          scope.context.systemMode,
        );
        return {
          ...ariaHidden(true),
          "data-mode": scope.context.value,
          "data-resolved-mode": resolved,
        };
      },
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        "data-mode": scope.context.value,
      }),
    },
  },
  commands: {
    cycle: {
      event: () => ({ type: "CYCLE" }),
    },
    setValue: {
      event: ([value]: [value: ModeChoice]) => ({
        type: "VALUE.SET",
        value,
      }),
    },
    setModes: {
      event: ([modes]: [modes: readonly string[] | string]) => ({
        type: "MODES.SET",
        modes,
      }),
    },
  },
  readers: {
    value: { read: (context: Ctx) => context.value },
    resolvedMode: {
      read: (context: Ctx) =>
        resolveEffectiveMode(context.value, context.modes, context.systemMode),
    },
    modes: { read: (context: Ctx) => context.modes },
    singleMode: { read: (context: Ctx) => isSingleMode(context.modes) },
    disabled: { read: (context: Ctx) => isSingleMode(context.modes) },
    hidden: {
      read: (context: Ctx) =>
        context.hideWhenSingle && isSingleMode(context.modes),
    },
    label: {
      read: (context: Ctx) =>
        isSingleMode(context.modes)
          ? `Only ${context.modes[0] ?? "light"} mode`
          : `Switch to ${nextModeChoice(context.value)} mode`,
    },
    next: { read: (context: Ctx) => nextModeChoice(context.value) },
  },
  methods: {
    getModes: {
      call: (context: Ctx) => context.modes,
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context: Ctx) => [
        context.value,
        resolveEffectiveMode(
          context.value,
          context.modes,
          context.systemMode,
        ),
      ],
      detail: (watched: readonly unknown[]) => ({
        value: watched[0] as ModeChoice,
        resolvedMode: watched[1] as ResolvedMode,
      }),
    },
  },
  establish: (props) => {
    const out: ({ type: string } & Record<string, unknown>)[] = [];
    const sync = props["syncDocument"] !== false;
    if (sync && typeof localStorage !== "undefined") {
      const key = typeof props["storageKey"] === "string" &&
          (props["storageKey"] as string).length > 0
        ? (props["storageKey"] as string)
        : "spin:mode";
      const stored = readStored(key);
      if (stored !== null) out.push({ type: "VALUE.SET", value: stored });
    }
    out.push({
      type: "SYSTEM.SET",
      systemMode: prefersDark() ? "dark" : "light",
    });
    return out;
  },
  settled: ({ after, props, root, send }) => {
    const node = root();
    observeSystem(node, send);
    if (props["modes"] === undefined) {
      observeModes(node, send);
      const declared = readRuntimeModes(node);
      const current = after.context.modes;
      const same = declared.length === current.length &&
        declared.every((mode, index) => mode === current[index]);
      if (!same && declared.length > 0) {
        send({ type: "MODES.SET", modes: declared });
      } else if (current.length === 0) {
        send({ type: "MODES.SET", modes: ["light", "dark"] });
      }
    }
    if (props["syncDocument"] === false) return;
    const ctx = after.context;
    const resolved = resolveEffectiveMode(
      ctx.value,
      ctx.modes,
      ctx.systemMode,
    );
    writeDocument(node, resolved);
    try {
      localStorage.setItem(ctx.storageKey, ctx.value);
    } catch {
      // Private mode: the session keeps it.
    }
  },
} satisfies ComponentDef<
  ModePickerContext,
  ModePickerEvents,
  Record<string, unknown>,
  ModePickerArgs,
  "idle"
>;

export type ModePickerApi = ApiOf<typeof def>;
export const modePicker = defineComponent<
  ModePickerContext,
  ModePickerEvents,
  ModePickerApi,
  ModePickerArgs,
  "idle"
>(def);
