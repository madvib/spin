import { own } from "../core/signal.ts";
import { signal } from "../core/signal.ts";

export type Signal<T> = { (): T; (value: T): void };

export interface MachineService<S = unknown> {
  getState(): S;
  subscribe(onChange: (state: S) => void): () => void;
}

export interface MachineApi<S = unknown> {
  readonly state: Signal<S>;
  send(event: unknown): void;
}

export function useMachine<S, C>(
  create: (options: C) => MachineService<S>,
  connect: (service: MachineService<S>) => MachineApi<S>,
  options: () => C,
): (state: Signal<S>) => (node: Element, param: C) => void {
  return (state) => (_node, param) => {
    const service = create(param ?? options());
    const api = connect(service);
    state(api.state());
    const unsubscribe = service.subscribe((next) => state(next));
    own(unsubscribe);
  };
}


