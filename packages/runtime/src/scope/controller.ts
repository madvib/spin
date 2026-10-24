/**
 * A component's controller surface: what an app controller may reach.
 *
 * A component owns its state — a machine does, or the platform does behind a
 * thin layer. Either way it exposes one controller: the commands an app
 * controller may call and the state it may read. The element registers that
 * controller here, and the host hooks read it back. Nothing here owns state;
 * this is the handle, not the engine.
 *
 * Why an element-indexed registry and not the scope table: the table's
 * lookup walks the scope chain, which answers "the nearest controller above
 * me" — a different question from "the controller THIS component provides".
 * Markup's `consume` answers the chain question; this answers the other one,
 * for hosts that hold the element.
 *
 * The view is built LAZILY, on the host's first read, not at registration.
 * Reflecting an api walks it, and some components' reads run connect-time
 * effects — doing that during the element's build executes them outside the
 * build's scope, where `own` refuses to run.
 */

/** What an app controller can do with a component. */
export interface SpinController {
  /** Imperative calls, keyed by the name the element installs them under. */
  readonly commands: Readonly<Record<string, (...args: never[]) => unknown>>;
  /** Reactive reads, one thunk per observable field. */
  readonly state: Readonly<Record<string, () => unknown>>;
}

const controllers = new WeakMap<Element, SpinController>();

/** The controller view of a component's api: its non-function members as
 * reactive reads, and the declared commands as calls.
 *
 * The field list is a reflection of the api, not a declaration — a field the
 * api stops carrying stops being observable, with no list to keep in step. */
export function controllerView(
  api: object,
  commands?: readonly string[],
): SpinController {
  const record = api as Record<string, unknown>;
  const state: Record<string, () => unknown> = {};
  for (const key of Object.keys(record)) {
    if (typeof record[key] !== "function") state[key] = () => record[key];
  }
  const calls: Record<string, (...args: never[]) => unknown> = {};
  for (const name of commands ?? []) {
    const method = record[name];
    if (typeof method === "function") {
      calls[name] = method as (...args: never[]) => unknown;
    }
  }
  return { commands: calls, state };
}

/** Register the controller `el` provides, built when a host first asks. */
export function provideController(
  el: Element,
  build: () => SpinController,
): void {
  let made: SpinController | undefined;
  const view = (): SpinController => (made ??= build());
  controllers.set(el, {
    get commands() {
      return view().commands;
    },
    get state() {
      return view().state;
    },
  });
}

/** The controller `el` provides, or undefined before it connects. */
export function controllerOf(el: Element): SpinController | undefined {
  return controllers.get(el);
}
