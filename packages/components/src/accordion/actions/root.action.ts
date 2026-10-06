import { createAction } from "@spin/runtime";
import { createMachine, normalizeProps } from "@spin/runtime/zag";
import { connect, machine } from "@zag-js/accordion";

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

export const root = createAction((el) => {
  const bridge = createMachine(machine as never, {
    connect: connect as never,
    normalize: normalizeProps,
    props: {
      multiple: asBool(el.getAttribute("multiple"), false),
      collapsible: asBool(el.getAttribute("collapsible") ?? el.getAttribute("non-collapsible") === null, true),
      defaultValue: asArray(el.getAttribute("default-value")),
      value: asArray(el.getAttribute("value")),
      id: el.id || undefined,
    },
  } as never);
  (el as unknown as Record<string, unknown>).__accordion = bridge.api;
  return {
    destroy: () => {
      delete (el as unknown as Record<string, unknown>).__accordion;
      bridge.dispose();
    },
  };
});
