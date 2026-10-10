import { createAction, type ElementAction } from "./action.ts";

/**
 * formControl — report the ancestor fieldset's disabled state and the form's
 * reset.
 *
 * Both are the FORM's state, not the widget's: a control inside a disabled
 * fieldset is inert, and a reset returns it to its seeded value. The machine
 * decides what either report means.
 *
 * Written for the rating-group port: Zag's `trackFormControl` effect has no
 * equivalent in the action catalog.
 */

export interface FormControlParam {
  onDisabledChange?: (disabled: boolean) => void;
  onFormReset?: () => void;
}

export const formControl: ElementAction<FormControlParam | undefined> = createAction((node, param) => {
  const stops: Array<() => void> = [];
  let observer: MutationObserver | undefined;

  const reportFieldset = (fieldset: HTMLFieldSetElement | null): void => {
    param?.onDisabledChange?.(fieldset !== null && fieldset.disabled);
  };

  const onReset = (event: Event): void => {
    // The machine owns the value, so the native reset must not fight it: it
    // would restore the input's default attribute, which is not where this
    // port stores the value.
    event.preventDefault();
    param?.onFormReset?.();
  };

  // Actions run while the view is still being built, so the node is
  // detached: `closest` finds no form and no fieldset yet. The lookup is one
  // microtask out, by which point the caller has inserted the fragment.
  queueMicrotask(() => {
    const fieldset = node.closest<HTMLFieldSetElement>("fieldset");
    const form = node.closest<HTMLFormElement>("form");
    reportFieldset(fieldset);
    if (fieldset !== null && typeof MutationObserver === "function") {
      observer = new MutationObserver(() => reportFieldset(fieldset));
      observer.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    }
    if (form !== null) {
      // Not passive: the machine owns the value, so the reset's default
      // action — restoring each control's default attribute, which is not
      // where this port stores the value — has to be cancelled.
      form.addEventListener("reset", onReset);
      stops.push(() => form.removeEventListener("reset", onReset));
    }
  });

  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      observer?.disconnect();
      for (const stop of stops) stop();
    },
  };
});
