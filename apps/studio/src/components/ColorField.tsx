import { createEffect, createSignal, Show } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { colorPicker } from "@spinjs/components/color-picker";
import { toHex } from "@spinjs/spin/theme";

export function ColorField(props: {
  value: string;
  onCommit: (value: string) => boolean;
  /** Picker only, no spelling row: the caller owns every sibling. */
  bare?: boolean;
  id?: string;
  label?: string;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, colorPicker);
  createEffect(() => {
    const current = toHex(props.value);
    if (current === undefined) return;
    // Returned, so the disposer runs on re-bind: a dropped disposer leaks
    // the listener, and one machine event would commit once per bind.
    return ctl.bind(
      { value: current, format: "hex" },
      {
        "value-change-end": (event: CustomEvent<{ value: string }>) => {
          const ok = props.onCommit(event.detail.value);
          if (!ok) {
            ctl.bind({ value: current, format: "hex" });
          }
        },
      },
    );
  });
  // The trigger is stable across document changes: the panel's hex input
  // is the machine's, and the bind above owns it, so no draft element is
  // needed to drop stale panel state. The hidden input follows the
  // document through an effect: its property holds the author's last
  // keystroke, and an undo that moves the document without touching the
  // property would leave the control showing the undone value.
  function Trigger(props2: { current: string }) {
    let hidden: HTMLInputElement | undefined;
    createEffect(() => {
      const next = props2.current;
      if (hidden !== undefined && hidden.value !== next) hidden.value = next;
    });
    return (
      <>
        <studio-color-picker
          ref={(el: HTMLElement) => setElement(el)}
          prop:value={props2.current}
          prop:format="hex"
        />
        <Show when={props.id !== undefined || props.label !== undefined}>
          <input
            type="color"
            id={props.id}
            aria-label={props.label}
            value={props2.current}
            ref={(el) => { hidden = el as HTMLInputElement; }}
            tabIndex={-1}
            class="sr-only"
            onChange={(e) => {
              const ok = props.onCommit(e.currentTarget.value);
              if (!ok) e.currentTarget.value = props2.current;
            }}
          />
        </Show>
      </>
    );
  }
  // Bare is the trigger and the caller's actions, one row, nothing else:
  // no spelling row — spellings are the picker's panel business. Inline
  // keeps the compact either-or for token rows.
  return (
    <Show
      when={props.bare}
      fallback={
        <Show
          // The hex itself, not a boolean: `<Show>` hands its children the `when`
          // value, and a `!== undefined` test would hand them `true` — which
          // `String()`-ed into a colour input and rendered black.
          when={toHex(props.value)}
          fallback={<span class="text-xs opacity-80">No picker for this spelling</span>}
        >
          {(current) => <Trigger current={String(current())} />}
        </Show>
      }
    >
      <div class="row-sm">
        <Show
          when={toHex(props.value)}
          fallback={<span class="text-xs opacity-80">No picker for this spelling</span>}
        >
          {(current) => <Trigger current={String(current())} />}
        </Show>
      </div>
    </Show>
  );
}

export default ColorField;