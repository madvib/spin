import { parseColor, type ColorChannel } from "@zag-js/color-utils";
import {
  dataAttr,
  defineComponent,
  isComposing,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  isOpenPhase,
  valueAsString,
  type ColorFormat,
  type ColorPickerContext,
  type ColorPickerEvent,
} from "./color-picker.machine.ts";

/**
 * Color-picker definition: the DOM contract as data. The machine owns the
 * four phases, the serialized color, the format and the active channel;
 * this file maps props to channels, parts to attribute bags, commands to
 * sends, and value/end/open/format transitions to their events.
 *
 * Everything that needs a node lives here — the area and channel drags
 * (which compute their percent against the node the pointer is over and
 * send events carrying it), the keyboard maps, the channel inputs, the
 * dismissal reflex, and the focus the panel opening owes the content.
 *
 * Thumb positions and gradient stops are CONTINUOUS values — a drag lands
 * between utilities — so the bags carry them as CSS custom properties only
 * (`--picker-x`, `--picker-alpha`...). Concrete properties stay banned:
 * the recipe's utility classes decide what each var feeds. The color object
 * itself is reconstructed per read via parseColor, because context holds
 * the serialized string.
 */

export interface AreaSlotProps {
  readonly xChannel?: ColorChannel | undefined;
  readonly yChannel?: ColorChannel | undefined;
}

export interface ChannelSlotProps {
  readonly channel: ColorChannel;
  readonly orientation?: "horizontal" | "vertical" | undefined;
}

export interface SwatchSlotProps {
  readonly value: string;
  readonly disabled?: boolean | undefined;
}

export interface ColorPickerItemState {
  readonly value: string;
  readonly disabled: boolean;
  readonly checked: boolean;
}

export interface ColorPickerValueChange {
  readonly value: string;
  readonly format: ColorFormat;
}

export interface ColorPickerOpenChange {
  readonly open: boolean;
}

export interface ColorPickerFormatChange {
  readonly format: ColorFormat;
}

export interface ColorPickerApi {
  readonly open: boolean;
  readonly value: string;
  readonly valueAsString: string;
  readonly format: ColorFormat;
  readonly disabled: boolean;
  readonly empty: boolean;
  setValue(value: string): void;
  setFormat(format: ColorFormat): void;
  setOpen(open: boolean): void;
  getChannelValue(channel: ColorChannel | "hex"): string;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getValueTextProps(): Record<string, unknown>;
  getAreaProps(props?: AreaSlotProps): Record<string, unknown>;
  getAreaBackgroundProps(props?: AreaSlotProps): Record<string, unknown>;
  getAreaThumbProps(props?: AreaSlotProps): Record<string, unknown>;
  getTransparencyGridProps(): Record<string, unknown>;
  getChannelSliderProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderTrackProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderThumbProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderLabelProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelSliderValueTextProps(props: ChannelSlotProps): Record<string, unknown>;
  getChannelInputProps(props: { channel: ColorChannel | "hex" }): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
  getEyeDropperTriggerProps(): Record<string, unknown>;
  getFormatSelectProps(): Record<string, unknown>;
  getSwatchGroupProps(): Record<string, unknown>;
  getSwatchTriggerProps(props: SwatchSlotProps): Record<string, unknown>;
  getSwatchIndicatorProps(props: SwatchSlotProps): Record<string, unknown>;
  getSwatchProps(props: SwatchSlotProps): Record<string, unknown>;
}

const FORMATS: readonly ColorFormat[] = ["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsb", "hsba"];

const parseFormat = (raw: unknown): ColorFormat | null =>
  typeof raw === "string" && (FORMATS as readonly string[]).includes(raw) ? (raw as ColorFormat) : null;

const sameValue = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

type Ctx = ColorPickerContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const openOf = (scope: ScopeLike): boolean =>
  isOpenPhase(scope.state, asCtx(scope.context).inline);

/** The live color object, parsed from the serialized context. */
const colorOf = (scope: ScopeLike): ReturnType<typeof parseColor> => {
  try {
    return parseColor(asCtx(scope.context).value);
  } catch {
    return parseColor("#000000");
  }
};

const areaChannels = (props?: AreaSlotProps): { x: ColorChannel; y: ColorChannel } => ({
  x: props?.xChannel ?? "saturation",
  y: props?.yChannel ?? "brightness",
});

/** Percent of a pointer within a node, 0..1 on each axis. */
const pointPercent = (node: Element, clientX: number, clientY: number): { x: number; y: number } => {
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
};

/** Percent along a channel track, honoring orientation and direction. */
const trackPercent = (
  node: Element,
  orientation: "horizontal" | "vertical",
  clientX: number,
  clientY: number,
  dir: "ltr" | "rtl",
): number => {
  const rect = node.getBoundingClientRect();
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  if (orientation === "vertical") return clamp((clientY - rect.top) / rect.height);
  const raw = clamp((clientX - rect.left) / rect.width);
  return dir === "rtl" ? 1 - raw : raw;
};

type Capturable = Element & { setPointerCapture?: (id: number) => void };

/** The arrow step: shift multiplies by ten, like a native range input. */
const arrowStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

const onAreaKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  if (isComposing(event)) return;
  const step = arrowStep(event);
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.props["dir"] === "rtl" ? step : -step });
      return;
    case "ArrowRight":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "x", delta: scope.props["dir"] === "rtl" ? -step : step });
      return;
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "y", delta: step });
      return;
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "AREA.ARROW", channel: "y", delta: -step });
      return;
    case "Home":
      event.preventDefault();
      scope.send({ type: "AREA.HOME_END", channel: "x", toMax: false });
      return;
    case "End":
      event.preventDefault();
      scope.send({ type: "AREA.HOME_END", channel: "x", toMax: true });
      return;
    default:
      return;
  }
};

const onChannelKeydown = (scope: ScopeLike, event: KeyboardEvent, channel: ColorChannel): void => {
  if (event.defaultPrevented) return;
  if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
  if (isComposing(event)) return;
  const step = arrowStep(event);
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: -step });
      return;
    case "ArrowRight":
    case "ArrowUp":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: step });
      return;
    case "Home":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: false });
      return;
    case "End":
      event.preventDefault();
      scope.send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: true });
      return;
    default:
      return;
  }
};

interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** Per-slot memos keyed by stable owner objects: the recipe hands the
 * getters fresh literals per render, which would defeat an identity memo.
 * Owners persist by channel key, so bags survive re-renders. */
const ownerBags = new WeakMap<object, BagMemo>();
const keyedOwner = (
  owner: object,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> => {
  const hit = ownerBags.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  ownerBags.set(owner, { sig, bag });
  return bag;
};
const owners = new Map<string, object>();
const ownerFor = (key: string): object => {
  let owner = owners.get(key);
  if (owner === undefined) {
    owner = { key };
    owners.set(key, owner);
  }
  return owner;
};

/** Zag's `getItemState` for a swatch: what one preset color is worth. */
const swatchState = (scope: ScopeLike, props: SwatchSlotProps): ColorPickerItemState => ({
  value: props.value,
  disabled: scope.props["disabled"] === true || props.disabled === true,
  checked: asCtx(scope.context).value.toLowerCase() === props.value.toLowerCase(),
});

const channelValueOf = (
  context: Record<string, unknown>,
  props: Record<string, unknown>,
  channel: ColorChannel | "hex",
): string => {
  const ctx = asCtx(context);
  let color: ReturnType<typeof parseColor>;
  try {
    color = parseColor(ctx.value);
  } catch {
    color = parseColor("#000000");
  }
  void props;
  if (channel === "hex") {
    try {
      return color.toString("hex");
    } catch {
      return ctx.value;
    }
  }
  // Hue/saturation/brightness are not rgb channels: read them off the
  // area value, the way the machine steps them. Alpha reads natively.
  try {
    const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
    const source = channel === "alpha" ? color : color.toFormat(area);
    return String(source.getChannelValue(channel));
  } catch {
    return "";
  }
};

const def: ComponentDef<ColorPickerContext, ColorPickerEvent> = {
  name: "color-picker",
  config,
  implementations,
  start: (props, authored) => {
    if (authored("open")) return (props["open"] as boolean) === true ? "active" : "idle";
    const inline = props["inline"] === true;
    if (inline || props["open"] === true || props["defaultOpen"] === true) return "active";
    return "idle";
  },
  seed: (props, authored) => ({
    // The authored value wins; the default seeds. A coerced channel
    // default is never a host write — `@@authored` is the distinction.
    disabled: props["disabled"] === true,
    readOnly: props["readOnly"] === true,
    closeOnSelect: props["closeOnSelect"] === true,
    inline: props["inline"] === true,
    areaX: "saturation" as ColorPickerContext["areaX"],
    areaY: "brightness" as ColorPickerContext["areaY"],
    value: (authored("value") ? props["value"] : props["defaultValue"]) as string,
    format: (authored("format") ? props["format"] : props["defaultFormat"]) as ColorFormat,
  }),
  establish: (props, authored) => {
    // Normalize the seed through the machine's own parser, so the context
    // always holds a serialized color rather than the host's raw text.
    // Silent: establish sends run before the watch cursors prime.
    return [
      {
        type: "VALUE.SET",
        value: authored("value") ? props["value"] : props["defaultValue"],
      },
      {
        type: "FORMAT.SET",
        format: authored("format") ? props["format"] : props["defaultFormat"],
      },
    ];
  },
  channels: {
    value: {
      controlled: true,
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "#000000"),
      event: (value: string) => ({ type: "VALUE.SET", value }),
      equal: (current, outer) =>
        typeof current === "string" && typeof outer === "string" && sameValue(current, outer),
    },
    defaultValue: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "#000000"),
    },
    format: {
      controlled: true,
      parse: (raw) => parseFormat(raw) ?? "hex",
      event: (value: ColorFormat) => ({ type: "FORMAT.SET", format: value }),
    },
    defaultFormat: {
      parse: (raw) => parseFormat(raw) ?? "hex",
    },
    open: {
      controlled: true,
      parse: (raw) => raw === true,
      event: (value: boolean) => ({ type: value ? "CONTROLLED.OPEN" : "CONTROLLED.CLOSE" }),
      current: (context, state) =>
        isOpenPhase(state, (context["inline"] as boolean) === true),
    },
    defaultOpen: { parse: (raw) => raw === true },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    closeOnSelect: { parse: (raw) => raw === true },
    inline: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    name: { parse: textProp },
    swatches: {
      parse: (raw) => Array.isArray(raw)
        ? (raw as readonly unknown[]).filter((v): v is string => typeof v === "string")
        : [],
    },
  },
  scalars: ["disabled", "readOnly", "closeOnSelect", "inline"],
  parts: {
    root: {
      sig: (scope) => [scope.state, scope.props["disabled"], scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    label: {
      sig: (scope) => [scope.props["disabled"], scope.props["dir"]].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    control: {
      sig: (scope) => [`${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    trigger: {
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [scope.state, ctx.value, scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        const value = valueAsString(ctx);
        const open = openOf(scope);
        return {
          id: scope.id("trigger"),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": `select color. current color is ${value}`,
          "aria-controls": scope.id("content"),
          "aria-labelledby": scope.id("label"),
          "aria-haspopup": scope.props["inline"] === true ? undefined : "dialog",
          "aria-expanded": open ? "true" : "false",
          "data-state": open ? "open" : "closed",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          onClick: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "TRIGGER.CLICK" });
          },
          onBlur: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "TRIGGER.BLUR" });
          },
        };
      },
    },
    positioner: {
      // data-state drives the recipe's closed utilities: the `hidden`
      // attribute alone loses to the content's own `display` utility.
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("positioner"),
        "data-state": openOf(scope) ? "open" : "closed",
      }),
    },
    content: {
      sig: (scope) => [scope.state, asCtx(scope.context).value].join(" "),
      attrs: (scope) => {
        const open = openOf(scope);
        return {
          id: scope.id("content"),
          role: scope.props["inline"] === true ? undefined : "dialog",
          tabindex: "-1",
          dir: scope.props["dir"],
          "data-state": open ? "open" : "closed",
          hidden: open ? undefined : "",
          // The layer: a press outside the panel dismisses, and Escape
          // while it is up does too.
          "use:dismissable": {
            onEscape: (): void => {
              if (!openOf(scope)) return;
              scope.send({ type: "CLOSE" });
            },
            onOutside: (): void => {
              if (!openOf(scope)) return;
              scope.send({ type: "LAYER.INTERACT_OUTSIDE" });
            },
          },
        };
      },
    },
    valueText: {
      id: "value-text",
      sig: (scope) => [asCtx(scope.context).value].join(" "),
      attrs: (scope) => ({
        id: scope.id("valueText"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    area: {
      sig: (scope, arg) => {
        const { x, y } = areaChannels(arg as AreaSlotProps | undefined);
        return [asCtx(scope.context).value, x, y, scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as AreaSlotProps | undefined;
        const { x, y } = areaChannels(slots);
        const color = colorOf(scope);
        return keyedOwner(ownerFor(`area:${x}:${y}`), `${asCtx(scope.context).value}:${x}:${y}`, () => ({
          id: scope.id("area"),
          role: "group",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          "data-channel-x": x,
          "data-channel-y": y,
          style: { "--picker-area": color.toString("css") },
          onPointerdown: (event: PointerEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const node = event.currentTarget as Element | null;
            if (node === null) return;
            const at = pointPercent(node, event.clientX, event.clientY);
            event.preventDefault();
            (node as Capturable).setPointerCapture?.(event.pointerId);
            scope.send({ type: "AREA.POINTER_DOWN", x: at.x, y: at.y });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const node = event.currentTarget as Element | null;
            if (node === null) return;
            const at = pointPercent(node, event.clientX, event.clientY);
            scope.send({ type: "AREA.POINTER_MOVE", x: at.x, y: at.y });
          },
          onPointerup: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "AREA.POINTER_UP" });
          },
        }));
      },
    },
    areaBackground: {
      id: "area-background",
      sig: (scope, arg) => {
        const { x, y } = areaChannels(arg as AreaSlotProps | undefined);
        return [asCtx(scope.context).value, x, y].join(" ");
      },
      attrs: (scope, arg) => {
        const { x, y } = areaChannels(arg as AreaSlotProps | undefined);
        return {
          id: scope.id("areaBackground"),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          style: {
            "--picker-area": colorOf(scope).toString("css"),
            backgroundColor: "var(--picker-area)",
          },
        };
      },
    },
    areaThumb: {
      id: "area-thumb",
      sig: (scope, arg) => {
        const { x, y } = areaChannels(arg as AreaSlotProps | undefined);
        return [asCtx(scope.context).value, x, y, scope.props["dir"], scope.props["disabled"]].join(" ");
      },
      attrs: (scope, arg) => {
        const { x, y } = areaChannels(arg as AreaSlotProps | undefined);
        const ctx = asCtx(scope.context);
        const color = colorOf(scope);
        // The area's channels live in the area format: read them off the
        // converted value, because an rgb color has no saturation channel
        // and the raw read throws (which is why the thumb sat at 0,0).
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = color.toFormat(area);
        } catch {
          // Unparseable stays home.
        }
        let xp = 0;
        let yp = 0;
        try {
          xp = source.getChannelValuePercent(x);
          yp = 1 - source.getChannelValuePercent(y);
        } catch {
          // Unparseable stays home.
        }
        if (scope.props["dir"] === "rtl") xp = 1 - xp;
        const xv = (() => {
          try {
            return source.getChannelValue(x);
          } catch {
            return 0;
          }
        })();
        const yv = (() => {
          try {
            return source.getChannelValue(y);
          } catch {
            return 0;
          }
        })();
        return {
          id: scope.id("areaThumb"),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          dir: scope.props["dir"],
          "aria-label": `${x} and ${y}`,
          "aria-roledescription": "2d slider",
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": String(xv),
          "aria-valuetext": `${x} ${xv}, ${y} ${yv}`,
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          style: {
            "--picker-x": `${xp * 100}%`,
            "--picker-y": `${yp * 100}%`,
            "--picker-color": color.toString("css"),
            left: "var(--picker-x, 50%)",
            top: "var(--picker-y, 50%)",
            transform: "translate(-50%, -50%)",
            background: "var(--picker-color)",
          },
          onFocus: (): void => scope.send({ type: "AREA.ACTIVATE" }),
          onKeydown: (event: KeyboardEvent): void => onAreaKeydown(scope, event),
        };
      },
    },
    transparencyGrid: {
      id: "transparency-grid",
      sig: () => "grid",
      attrs: () => ({ "--picker-grid": "12px" }),
    },
    channelSlider: {
      id: "channel-slider",
      sig: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        return [scope.props["disabled"], scope.props["readOnly"], orientation].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        return keyedOwner(ownerFor(`slider:${slots.channel}:${orientation}`), `${orientation}`, () => ({
          role: "presentation",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          onPointerdown: (event: PointerEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const node = event.currentTarget as Element | null;
            if (node === null) return;
            const percent = trackPercent(node, orientation, event.clientX, event.clientY, scope.props["dir"] as "ltr" | "rtl");
            event.preventDefault();
            (node as Capturable).setPointerCapture?.(event.pointerId);
            scope.send({ type: "CHANNEL_SLIDER.POINTER_DOWN", channel: slots.channel, percent });
          },
          onPointermove: (event: PointerEvent): void => {
            if (scope.state !== "dragging") return;
            const node = event.currentTarget as Element | null;
            if (node === null) return;
            const percent = trackPercent(node, orientation, event.clientX, event.clientY, scope.props["dir"] as "ltr" | "rtl");
            scope.send({ type: "CHANNEL_SLIDER.POINTER_MOVE", channel: slots.channel, percent });
          },
          onPointerup: (): void => {
            if (scope.state !== "dragging") return;
            scope.send({ type: "CHANNEL_SLIDER.POINTER_UP" });
          },
        }));
      },
    },
    channelSliderTrack: {
      id: "track",
      sig: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        return [asCtx(scope.context).value, orientation, scope.props["dir"]].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        const color = colorOf(scope);
        return {
          id: scope.id("track", slots.channel),
          role: "group",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          style: {
            "--picker-track": color.toString("css"),
            background: "var(--picker-track)",
          },
        };
      },
    },
    channelSliderThumb: {
      id: "thumb",
      sig: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        return [asCtx(scope.context).value, orientation, scope.props["dir"], scope.props["disabled"]].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        const orientation = slots.orientation ?? "horizontal";
        const ctx = asCtx(scope.context);
        const color = colorOf(scope);
        // Hue/saturation/brightness are not rgb channels: read them off
        // the area value, the way the machine steps them. Alpha natively.
        const area: "hsla" | "hsba" = ctx.format.startsWith("hsl") ? "hsla" : "hsba";
        let source = color;
        try {
          source = slots.channel === "alpha" ? color : color.toFormat(area);
        } catch {
          // Unparseable stays home.
        }
        let offset = 0;
        let now = 0;
        let min = 0;
        let max = 100;
        try {
          const range = source.getChannelRange(slots.channel);
          now = source.getChannelValue(slots.channel);
          min = range.minValue;
          max = range.maxValue;
          offset = max === min ? 0 : (now - min) / (max - min);
        } catch {
          // Unparseable stays home.
        }
        if (orientation === "horizontal" && scope.props["dir"] === "rtl") offset = 1 - offset;
        return {
          id: scope.id("thumb", slots.channel),
          role: "slider",
          tabindex: scope.props["disabled"] === true ? undefined : "0",
          "aria-label": slots.channel,
          "aria-orientation": orientation,
          "aria-valuemin": String(min),
          "aria-valuemax": String(max),
          "aria-valuenow": String(now),
          "aria-valuetext": `${slots.channel} ${now}`,
          "aria-disabled": scope.props["disabled"] === true ? "true" : undefined,
          "data-channel": slots.channel,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-orientation": orientation,
          style: {
            "--picker-offset": `${offset * 100}%`,
            "--picker-color": color.toString("css"),
            left: "var(--picker-offset, 0%)",
            top: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--picker-color)",
          },
          onFocus: (): void => scope.send({ type: "CHANNEL_SLIDER.ACTIVATE", channel: slots.channel }),
          onKeydown: (event: KeyboardEvent): void => onChannelKeydown(scope, event, slots.channel),
        };
      },
    },
    channelSliderLabel: {
      id: "channel-slider-label",
      sig: (scope) => [`${scope.props["dir"]}`].join(" "),
      attrs: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        return { "data-channel": slots.channel, dir: scope.props["dir"] };
      },
    },
    channelSliderValueText: {
      id: "channel-slider-value-text",
      sig: (scope) => [asCtx(scope.context).value].join(" "),
      attrs: (scope, arg) => {
        const slots = arg as ChannelSlotProps;
        return { "data-channel": slots.channel };
      },
    },
    channelInput: {
      id: "channel-input",
      sig: (scope, arg) => {
        const slots = arg as { channel: ColorChannel | "hex" };
        const ctx = asCtx(scope.context);
        return [slots.channel, channelValueOf(scope.context, scope.props, slots.channel), scope.props["disabled"], scope.props["readOnly"]].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as { channel: ColorChannel | "hex" };
        const isText = slots.channel === "hex";
        const current = channelValueOf(scope.context, scope.props, slots.channel);
        return {
          type: isText ? "text" : "number",
          dir: scope.props["dir"],
          "data-channel": slots.channel,
          "aria-label": slots.channel,
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-readonly": dataAttr(scope.props["readOnly"] === true),
          value: current,
          onFocus: (event: FocusEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "CHANNEL_INPUT.FOCUS", channel: slots.channel });
            (event.currentTarget as HTMLInputElement | null)?.select?.();
          },
          onBlur: (event: FocusEvent): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            const node = event.currentTarget as HTMLInputElement | null;
            const raw = node === null ? "" : node.value;
            scope.send({ type: "CHANNEL_INPUT.BLUR", channel: slots.channel, value: raw });
          },
          onKeydown: (event: KeyboardEvent): void => {
            if (event.defaultPrevented || isComposing(event)) return;
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            if (event.key !== "Enter") return;
            const node = event.currentTarget as HTMLInputElement | null;
            const raw = node === null ? "" : node.value;
            event.preventDefault();
            scope.send({ type: "CHANNEL_INPUT.CHANGE", channel: slots.channel, value: raw });
          },
        };
      },
    },
    hiddenInput: {
      id: "hidden-input",
      sig: (scope) => [asCtx(scope.context).value, `${scope.props["name"]}`].join(" "),
      attrs: (scope) => {
        const name = scope.props["name"] as string;
        return {
          id: scope.id("hiddenInput"),
          type: "text",
          name: name.length > 0 ? name : undefined,
          tabindex: "-1",
          readonly: scope.props["readOnly"] === true ? "" : undefined,
          value: valueAsString(asCtx(scope.context)),
        };
      },
    },
    eyeDropperTrigger: {
      id: "eyedropper",
      sig: (scope) => {
        const supported = typeof (globalThis as Record<string, unknown>)["EyeDropper"] !== "undefined";
        return [`${scope.props["disabled"] === true}`, `${supported}`].join(" ");
      },
      attrs: (scope) => {
        const supported = typeof (globalThis as Record<string, unknown>)["EyeDropper"] !== "undefined";
        return {
          id: scope.id("eyeDropper"),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": "Pick a color from the screen",
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          hidden: supported ? undefined : "",
          onClick: (): void => {
            if (scope.props["disabled"] === true || scope.props["readOnly"] === true) return;
            scope.send({ type: "EYEDROPPER.CLICK" });
          },
        };
      },
    },
    formatSelect: {
      id: "format-select",
      sig: (scope) => [asCtx(scope.context).format, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("formatSelect"),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
        value: asCtx(scope.context).format,
        onChange: (event: Event): void => {
          const node = event.currentTarget as HTMLSelectElement | null;
          const next = node === null ? "" : node.value;
          const format = (["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsb", "hsba"] as const).find(
            (f) => f === next,
          );
          if (format === undefined) return;
          scope.send({ type: "FORMAT.SET", format });
        },
      }),
    },
    swatchGroup: {
      id: "swatch-group",
      sig: () => "group",
      attrs: (scope) => ({ id: scope.id("swatchGroup"), role: "group" }),
    },
    swatchTrigger: {
      id: "swatch",
      sig: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        const state = swatchState(scope, slots);
        return [state.checked, state.disabled, asCtx(scope.context).format].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        const state = swatchState(scope, slots);
        return {
          id: scope.id("swatch", slots.value),
          type: "button",
          dir: scope.props["dir"],
          "aria-label": `select ${slots.value} as the color`,
          "data-state": state.checked ? "checked" : "unchecked",
          "data-value": slots.value,
          "data-disabled": dataAttr(state.disabled),
          style: { "--picker-swatch": slots.value },
          onClick: (): void => {
            if (state.disabled || scope.props["readOnly"] === true) return;
            scope.send({ type: "SWATCH_TRIGGER.CLICK", value: slots.value });
          },
        };
      },
    },
    swatchIndicator: {
      id: "swatch-indicator",
      sig: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        return [`${swatchState(scope, slots).checked}`].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        const checked = swatchState(scope, slots).checked;
        return {
          "aria-hidden": "true",
          "data-state": checked ? "checked" : "unchecked",
          hidden: checked ? undefined : "",
        };
      },
    },
    swatch: {
      id: "swatch",
      sig: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        return [`${swatchState(scope, slots).checked}`].join(" ");
      },
      attrs: (scope, arg) => {
        const slots = arg as SwatchSlotProps;
        const checked = swatchState(scope, slots).checked;
        return {
          "data-state": checked ? "checked" : "unchecked",
          "data-value": slots.value,
          style: { "--picker-swatch": slots.value },
        };
      },
    },
  },
  commands: {
    setValue: { event: (args) => ({ type: "VALUE.SET", value: args[0] as string }) },
    setFormat: { event: (args) => ({ type: "FORMAT.SET", format: args[0] as ColorFormat }) },
    setOpen: { event: (args) => ({ type: (args[0] as boolean) ? "OPEN" : "CLOSE" }) },
  },
  readers: {
    open: {
      read: (context, state) =>
        isOpenPhase(state, (context as unknown as Ctx).inline),
    },
    value: { read: (context) => asCtx(context).value },
    valueAsString: { read: (context) => valueAsString(asCtx(context)) },
    format: { read: (context) => asCtx(context).format },
    disabled: { read: (_context, _state, props) => (props["disabled"] as boolean) === true },
    empty: { read: () => false },
  },
  methods: {
    getChannelValue: {
      call: (context, _state, args, props) =>
        channelValueOf(context, props, args[0] as ColorChannel | "hex"),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [asCtx(context).value.toLowerCase()],
      detail: (watched, _event, _props, context) => {
        void watched;
        const ctx = context as unknown as Ctx;
        return { value: ctx.value, format: ctx.format };
      },
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (context, state) => [isOpenPhase(state, asCtx(context).inline)],
      detail: (watched) => ({ open: watched[0] as boolean }),
    },
    "format-change": {
      prop: "onFormatChange",
      watch: (context) => [asCtx(context).format],
      detail: (watched) => ({ format: watched[0] as ColorFormat }),
    },
    "value-change-end": {
      prop: "onValueChangeEnd",
      watch: (context) => [asCtx(context).value.toLowerCase()],
      detail: (watched, _event, _props, context) => {
        void watched;
        const ctx = context as unknown as Ctx;
        return { value: ctx.value, format: ctx.format };
      },
      // Drag release and committed inputs only — every move already
      // reported above.
      select: (event, _before, after) =>
        event.type === "AREA.POINTER_UP" ||
          event.type === "CHANNEL_SLIDER.POINTER_UP" ||
          event.type === "CHANNEL_INPUT.BLUR" ||
          event.type === "SWATCH_TRIGGER.CLICK"
          ? {
            value: (after as unknown as Ctx).value,
            format: (after as unknown as Ctx).format,
          }
          : null,
    },
  },
};

export const colorPicker = defineComponent<ColorPickerContext, ColorPickerEvent, ColorPickerApi>(def);
