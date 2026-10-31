import { componentExamples } from "@spinjs/spin/preset";

export interface PrimitiveExample {
  readonly name: string;
  readonly html: string;
  readonly source?: string;
  readonly onLoad?: string;
}

export interface PrimitivePage {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly examples: readonly PrimitiveExample[];
  readonly onLoad?: string;
}

const TITLES: Readonly<Record<string, string>> = {
  alert: "Alert",
  badge: "Badge",
  breadcrumbs: "Breadcrumbs",
  button: "Button",
  card: "Card",
  checkbox: "Checkbox",
  details: "Details",
  dialog: "Dialog",
  hr: "Divider",
  fieldset: "Fieldset & legend",
  icon: "Icon",
  input: "Input",
  join: "Join",
  kbd: "Keycap",
  label: "Label",
  meter: "Meter",
  progress: "Progress",
  prose: "Prose",
  radio: "Radio",
  skeleton: "Skeleton",
  stat: "Stat",
  switch: "Switch",
  table: "Table",
  textarea: "Textarea",
  typography: "Typography",
};

/**
 * Every primitive page, sourced from `@spinjs/preset`'s `componentExamples`.
 */
export const PRIMITIVES: readonly PrimitivePage[] = Object.values(
  componentExamples,
).map((entry) => ({
  id: entry.id,
  title: TITLES[entry.id] ?? entry.id,
  kind: "primitive",
  note: entry.note,
  ...(entry.onLoad !== undefined ? { onLoad: entry.onLoad } : {}),
  examples: [...entry.rows],
}));
