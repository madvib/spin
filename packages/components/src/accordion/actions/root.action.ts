import { createAction } from "@spin/runtime";
import { createMachine, normalizeProps } from "@spin/runtime/zag";
import { provide } from "@spin/runtime/load";
import { connect, machine } from "@zag-js/accordion";
import type { ElementAction } from "@spin/runtime";

export interface AccordionOptions {
  multiple?: boolean;
  collapsible?: boolean;
  defaultValue?: string[];
  value?: string[];
}

export const root: ElementAction<AccordionOptions> = createAction<AccordionOptions>((el, param) => {
  const bridge = createMachine(machine as never, {
    connect: connect as never,
    normalize: normalizeProps,
    props: {
      multiple: param?.multiple ?? false,
      collapsible: param?.collapsible ?? true,
      defaultValue: param?.defaultValue,
      value: param?.value,
      id: el.id || undefined,
    },
  } as never);
  provide(el, "accordion:api", bridge.api);
  return {
    destroy: () => bridge.dispose(),
  };
});
