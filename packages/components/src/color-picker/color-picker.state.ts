import { defaultTwin } from "@spinjs/runtime";
import { type ColorChannel, parseColor } from "./color.ts";

export type ColorFormat =
  | "hex"
  | "hexa"
  | "rgb"
  | "rgba"
  | "hsl"
  | "hsla"
  | "hsb"
  | "hsba";

export interface ColorPickerContext {
  value: string;
  format: ColorFormat;
  activeChannel: ColorChannel | null;
  areaX: ColorChannel;
  areaY: ColorChannel;
  disabled: boolean;
  readOnly: boolean;
  closeOnSelect: boolean;
  inline: boolean;
  dir: "ltr" | "rtl";
  name: string | undefined;
}

export type ColorPickerState = "idle" | "focused" | "active" | "dragging";

/** The color-picker's arguments: the values the host may set. */
export interface ColorPickerArgs {
  value?: string;
  format?: string;
  inline?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  closeOnSelect?: boolean;
  defaultInline?: boolean;
  dir?: string;
  name?: string;
}

export const parse = (
  value: string,
  fallback: string,
): { color: ReturnType<typeof parseColor>; raw: string } => {
  try {
    return { color: parseColor(value), raw: value };
  } catch {
    return { color: parseColor(fallback), raw: fallback };
  }
};

export const serialize = (
  color: ReturnType<typeof parseColor>,
  format: ColorFormat,
): string => {
  try {
    return color.toString(format);
  } catch {
    return color.toString("hex");
  }
};

export type AreaFormat = "hsla" | "hsba";

const FORMATS: readonly string[] = [
  "hex",
  "hexa",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hsb",
  "hsba",
];

export const isFormat = (raw: unknown): raw is ColorFormat =>
  typeof raw === "string" && (FORMATS as readonly string[]).includes(raw);

const textOf = (raw: unknown, fallback: string): string =>
  typeof raw === "string" && raw.length > 0 ? raw : fallback;

/**
 * The color the host wrote, normalized the way the machine's own assigns
 * would: the value first in hex, then reserialized in the format — a color
 * with an alpha loses it in hex and keeps it in the format.
 */
const valueOf = (raw: unknown, format: ColorFormat): string => {
  const hex = serialize(parse(textOf(raw, "#000000"), "#000000").color, "hex");
  return serialize(parse(hex, "#000000").color, format);
};

export function initial(
  args: ColorPickerArgs,
  authored: (name: string) => boolean,
): ColorPickerContext {
  // A host that wrote the twin (`defaultValue`) wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const format = written("format")
    ? (isFormat(args.format) ? args.format : "hex")
    : "hex";
  return {
    value: written("value")
      ? valueOf(args.value, format)
      : valueOf("#000000", format),
    format,
    activeChannel: null,
    areaX: "saturation",
    areaY: "brightness",
    disabled: written("disabled") ? args.disabled === true : false,
    readOnly: written("readOnly") ? args.readOnly === true : false,
    closeOnSelect: written("closeOnSelect")
      ? args.closeOnSelect === true
      : false,
    inline: written("inline") ? args.inline === true : false,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
  };
}

export function startOpen(raw: Record<string, unknown>): boolean {
  if (typeof raw["open"] === "boolean") return raw["open"];
  return raw["inline"] === true || raw["defaultOpen"] === true;
}

/** True when the panel shows; inline is always open. */
export const isOpenPhase = (phase: string, inline: boolean): boolean =>
  inline || phase === "active" || phase === "dragging";

export const valueAsString = (ctx: ColorPickerContext): string => ctx.value;
