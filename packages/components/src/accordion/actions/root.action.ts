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

const asArray = (v: unknown): string[] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v as string[];
  const s = String(v);
  return s.length > 0 ? s.split(",") : undefined;
};

const asBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (s === "" || s === "true") return true;
  if (s === "false") return false;
  return fallback;
};

export const root: ElementAction<AccordionOptions> = createAction<AccordionOptions>((el, param) => {
  const fromAttr = (name: string): string | undefined => el.getAttribute(name) ?? undefined;
  const raw = (param ?? {}) as Record<string, unknown>;
  const multiple = raw["multiple"] ?? fromAttr("multiple");
  const collapsible = raw["collapsible"] ?? fromAttr("collapsible") ?? fromAttr("non-collapsible") === null;
  const defaultValue = raw["defaultValue"] ?? raw["default-value"] ?? fromAttr("default-value");
  const value = raw["value"] ?? fromAttr("value");
  const bridge = createMachine(machine as never, {
    connect: connect as never,
    normalize: normalizeProps,
    props: {
      multiple: asBool(multiple, false),
      collapsible: asBool(collapsible, true),
      defaultValue: asArray(defaultValue),
      value: asArray(value),
      id: el.id || undefined,
    },
  } as never);
  provide("accordion:api", bridge.api);

  provide(el, "accordion:api", bridge.api);

  return {
    destroy: () => bridge.dispose(),
  };
});
