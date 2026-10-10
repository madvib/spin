import type { MachineDef } from "@spin/runtime";
import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import { connectRobotTreeView, type TreeFsmApi, type TreeFsmConnectProps, type TreeNode } from "./tree-view.fsm-connect.ts";
import {
  config,
  implementations,
  type TreeCallbacks,
  type TreeCheckedChange,
  type TreeContext,
  type TreeEvent,
  type TreeExpandedChange,
  type TreeFocusChange,
  type TreeLoadComplete,
  type TreeSelectionChange,
} from "./tree-view.machine.ts";

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v) => b.includes(v));



/**
 * The tree arrives as JSON text: the scope grammar types props as
 * `string|string[]|int|bool|{fields}[]`, which has no recursive shape for a
 * tree. A named recursive prop type is the fix the grammar owes; until then
 * this is the transport, validated here rather than trusted at each read.
 * Known gap: attribute-authored trees lose per-field coercion.
 */
function parseNodes(raw: unknown): readonly TreeNode[] {
  if (Array.isArray(raw)) return raw as TreeNode[];
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TreeNode[];
  } catch {
    return [];
  }
  return [];
}

/**
 * The tree-view bridge: scope values in, machine state out.
 *
 * Three jobs, and only three: seed the machine from `default*` props, sync
 * the scalar props the guards read, and publish the connect api through the
 * live-view proxy. Controlled alternation (authored props) and the change
 * callbacks live here too — the machine itself stays pure state.
 */

export function createTreeFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: TreeFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<TreeContext, TreeEvent>(config, implementations);

  let service: FsmService<TreeContext, TreeEvent> | undefined;

  const readCallbacks = (): TreeCallbacks => {
    const p = props();
    return {
      onExpandedChange: p["onExpandedChange"] as ((d: TreeExpandedChange) => void) | undefined,
      onSelectionChange: p["onSelectionChange"] as ((d: TreeSelectionChange) => void) | undefined,
      onFocusChange: p["onFocusChange"] as ((d: TreeFocusChange) => void) | undefined,
      onCheckedChange: p["onCheckedChange"] as ((d: TreeCheckedChange) => void) | undefined,
      onLoadComplete: p["onLoadComplete"] as ((d: TreeLoadComplete) => void) | undefined,
    };
  };

  /**
   * Sync the scalar props the guards read. NOT the value sets: those are
   * machine state, seeded once from `defaultExpandedValue` etc.
   *
   * The tempting design — a controlled `expandedValue` prop re-seeded when
   * its reference changes — does not work on this runtime yet: scope
   * coercion materializes a default for every declared prop, so a
   * `readProps` identity check always sees a "fresh" array and clobbers the
   * machine's own state on the next send. Zag's bindables distinguish
   * `value` from `defaultValue` at the prop layer; our grammar cannot yet.
   * Until it can, controlled alternates for these sets are out, and the
   * out-side is events (which work and are verified).
   */
  /**
   * Controlled alternation, done at the layer that can actually tell a host
   * write from a default: the element's authored-prop predicate, surfaced to
   * bridges as the reserved `@@authored` prop key. A coerced default is
   * never a write — this is the `value` vs `defaultValue` distinction Zag
   * gets from its bindables, and the runtime previously could not make.
   *
   * Seeding stays on `default*`; alternate sets only when authored.
   */
  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const controlled = (key: "expandedValue" | "selectedValue" | "checkedValue"): string[] | undefined => {
    const outer = props()[key];
    return authored(key) && Array.isArray(outer) ? [...(outer as string[])] : undefined;
  };

  const readProps = (): Pick<TreeContext, "selectionMode" | "expandOnClick" | "rename"> => {
    const p = props();
    return {
      selectionMode: p["selectionMode"] === "multiple" ? "multiple" : "single",
      expandOnClick: p["expandOnClick"] !== false,
      rename: p["rename"] !== false,
    };
  };

  const connectProps = (p: Record<string, unknown>): TreeFsmConnectProps => ({
    selectionMode: p["selectionMode"] === "multiple" ? "multiple" : "single",
    expandOnClick: p["expandOnClick"] !== false,
    typeahead: p["typeahead"] !== false,
    rename: p["rename"] !== false,
  });

  const ensureService = (): FsmService<TreeContext, TreeEvent> => {
    if (!service) {
      const p = props();
      const seed = {
        expandedValue: Array.isArray(p["defaultExpandedValue"]) ? [...(p["defaultExpandedValue"] as string[])] : [],
        selectedValue: Array.isArray(p["defaultSelectedValue"]) ? [...(p["defaultSelectedValue"] as string[])] : [],
        ...readProps(),
      };
      service = owner.run(() => {
        const svc = interpret(machine).start();
        Object.assign(svc.state.context, seed);
        return svc;
      });
    }
    return service;
  };

  /**
   * Controlled writes alternate on their own, not on the next machine
   * event: an owned effect reads the live props (so it subscribes to the
   * prop signals) and applies them straight into context. A bridge without
   * this only appears to work when the host always clicks something.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      for (const key of ["expandedValue", "selectedValue", "checkedValue"] as const) {
        const next = controlled(key);
        if (next && !sameSet(next, svc.state.context[key])) {
          svc.state.context[key] = next;
          moved = true;
        }
      }
      // Scalars move too: a selectionMode write changes what the connect
      // emits (the checkbox part), so it must re-render like a controlled
      // value does.
      const scalars = readProps();
      const syncScalar = <K extends "selectionMode" | "expandOnClick" | "rename">(
        key: K,
        value: TreeContext[K],
      ): void => {
        if (svc.state.context[key] !== value) {
          svc.state.context[key] = value;
          moved = true;
        }
      };
      syncScalar("selectionMode", scalars.selectionMode);
      syncScalar("expandOnClick", scalars.expandOnClick);
      syncScalar("rename", scalars.rename);
      if (moved) {
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  const send = (event: TreeEvent): void => {
    const svc = ensureService();
    const before = {
      expandedValue: [...svc.state.context.expandedValue],
      selectedValue: [...svc.state.context.selectedValue],
      checkedValue: [...svc.state.context.checkedValue],
      focusedValue: svc.state.context.focusedValue,
    };
    Object.assign(svc.state.context, readProps());
    for (const key of ["expandedValue", "selectedValue", "checkedValue"] as const) {
      const next = controlled(key);
      if (next) svc.state.context[key] = next;
    }
    svc.send(event);
    const after = svc.state.context;
    const cb = readCallbacks();
    if (!sameSet(before.expandedValue, after.expandedValue)) {
      cb.onExpandedChange?.({ expandedValue: after.expandedValue });
    }
    if (!sameSet(before.selectedValue, after.selectedValue)) {
      cb.onSelectionChange?.({ selectedValue: after.selectedValue });
    }
    if (!sameSet(before.checkedValue, after.checkedValue)) {
      cb.onCheckedChange?.({ checkedValue: after.checkedValue });
    }
    if (before.focusedValue !== after.focusedValue) {
      cb.onFocusChange?.({ focusedValue: after.focusedValue });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    const adapted = {
      send: send as (event: { type: string } & Record<string, unknown>) => void,
      get context() {
        return svc.state.context;
      },
    };
    return connectRobotTreeView(
      adapted,
      connectProps(props()),
      () => parseNodes(props()["nodes"]),
      (nodes) => {
        // The tree crosses the prop channel as JSON text (the grammar has no
        // recursive type); lazy grafting writes the host's data back the same
        // way it arrived.
        (root() as unknown as { nodes?: unknown }).nodes = JSON.stringify(nodes);
      },
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
      props,
    );
  });

  const api = new Proxy({} as TreeFsmApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return { api, dispose: () => {
    service?.stop();
    owner.dispose();
  } };
}

export const treeView: MachineDef = {
  machine: config,
  connect: (() => {
    throw new Error("tree-view fsm runs through createTreeFsmBridge");
  }) as never,
  createBridge: createTreeFsmBridge,
  events: {
    "expanded-change": {
      on: "onExpandedChange",
      detail: (change: TreeExpandedChange) => ({ expandedValue: change.expandedValue }),
    },
    "selection-change": {
      on: "onSelectionChange",
      detail: (change: TreeSelectionChange) => ({ selectedValue: change.selectedValue }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (change: TreeFocusChange) => ({ focusedValue: change.focusedValue }),
    },
    "checked-change": {
      on: "onCheckedChange",
      detail: (change: TreeCheckedChange) => ({ checkedValue: change.checkedValue }),
    },
    "load-complete": {
      on: "onLoadComplete",
      detail: (change: TreeLoadComplete) => ({ value: change.value }),
    },
  },
};
