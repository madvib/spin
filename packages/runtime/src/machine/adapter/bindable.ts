/**
 * Zag's `Bindable`: a controlled-or-uncontrolled value over one signal.
 *
 * `params` is a getter rather than a value, so a controlled prop that changes
 * mid-flight is picked up on the next read.
 */

import { type Bindable, type BindableParams, type ValueOrFn } from "@zag-js/core";
import { isFunction } from "@zag-js/utils";
import { signal } from "../../core/signal.ts";

/**
 * A bindable over one alien signal.
 *
 * `params` is a getter, not a value, because a controlled prop can change
 * mid-flight: `get` re-reads it on every access, so a machine under a
 * controlled `value` follows its owner without being told anything.
 */
export function createBindable<TValue>(
  params: () => BindableParams<TValue>,
  register: (dispose: VoidFunction) => void,
): Bindable<TValue> {
  const first = params();
  const initial = (first.value ?? first.defaultValue) as TValue;
  const inner = signal<TValue>(initial);
  const ref = { current: initial };

  function controlled(): boolean {
    return params().value !== undefined;
  }

  function get(): TValue {
    const value = controlled() ? params().value : inner();
    return (isFunction(value) ? value() : value) as TValue;
  }

  function set(value: ValueOrFn<TValue>): void {
    const previous = get();
    const next = isFunction(value) ? value(previous) : value;
    if (!controlled()) inner(next);
    const equal = params().isEqual ?? Object.is;
    if (!equal(next, previous)) params().onChange?.(next, previous);
    ref.current = next;
  }

  return {
    initial,
    ref,
    get,
    set,
    invoke(next, previous) {
      params().onChange?.(next, previous);
    },
    hash(value) {
      return params().hash?.(value) ?? String(value);
    },
  };
}
