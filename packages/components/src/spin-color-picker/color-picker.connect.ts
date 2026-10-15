/**
 * Color-picker connect: the DOM contract, the view-owned geometry, and the
 * reflexes the parts carry.
 *
 * What the machine owns stays there: the four phases, the serialized color,
 * the format, the active channel. Everything that needs a node lives here —
 * the area and channel drags (which compute their percent against the node
 * the pointer is over and send events carrying it), the keyboard maps, the
 * channel inputs, the dismissal reflex, and the focus the panel opening
 * owes the content.
 *
 * Thumb positions and gradient stops are CONTINUOUS values — a drag lands
 * between utilities — so the bags carry them as CSS custom properties only
 * (`--picker-x`, `--picker-alpha`...), serialized by bindSpread's existing
 * path. Concrete properties stay banned: the recipe's utility classes decide
 * what each var feeds. The color object itself is reconstructed per read via
 * parseColor, because context holds the serialized string.
 */

import { parseColor, type ColorChannel } from "@zag-js/color-utils";
import { isOpenPhase, valueAsString, type ColorFormat, type ColorPickerContext } from "./color-picker.machine.ts";

export interface ColorPickerConnectProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly inline: boolean;
  readonly dir: "ltr" | "rtl";
  readonly name: string;
  readonly swatches: readonly string[];
}

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

export interface ColorPickerCommands {
  setValue(value: string): void;
  setFormat(format: ColorFormat): void;
  setOpen(open: boolean): void;
}

export interface ColorPickerApi extends ColorPickerCommands {
  readonly open: boolean;
  readonly value: string;
  readonly valueAsString: string;
  readonly format: ColorFormat;
  readonly disabled: boolean;
  readonly empty: boolean;
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

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** The part-id namespace. */
const NAMESPACE = "color-picker";

export interface ColorPickerService {
  readonly context: ColorPickerContext;
  readonly phase: string;
  send(event: { type: string } & Record<string, unknown>): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside the
 * handlers it caches. */
export type ReadColorPickerProps = () => ColorPickerConnectProps;

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** `cached` per owner: slots are stable objects, so the memo dies with the
 * slot it came from. */
function keyed<K extends object>(
  store: WeakMap<K, BagMemo>,
  owner: K,
  sig: string,
  build: () => Record<string, unknown>,
): Record<string, unknown> {
  const hit = store.get(owner);
  if (hit !== undefined && hit.sig === sig) return hit.bag;
  const bag = build();
  store.set(owner, { sig, bag });
  return bag;
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise, which is what `hidden`-style utilities key on. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** Zag's `isComposingEvent`: a composing keystroke is not a navigation. */
const isComposing = (event: KeyboardEvent): boolean =>
  event.isComposing === true || event.keyCode === 229;

/** The arrow step: shift multiplies by ten, like a native range input. */
const arrowStep = (event: KeyboardEvent): number => (event.shiftKey ? 10 : 1);

export function connectRobotColorPicker(
  service: ColorPickerService,
  readProps: ReadColorPickerProps,
  id: string,
): ColorPickerApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const rootId = ownerId;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const triggerId = `${ownerId}:trigger`;
  const positionerId = `${ownerId}:positioner`;
  const contentId = `${ownerId}:content`;
  const valueTextId = `${ownerId}:value-text`;
  const areaId = `${ownerId}:area`;
  const areaThumbId = `${ownerId}:area-thumb`;
  const hiddenInputId = `${ownerId}:hidden-input`;
  const eyeDropperId = `${ownerId}:eyedropper`;
  const formatSelectId = `${ownerId}:format-select`;
  const swatchGroupId = `${ownerId}:swatch-group`;
  const trackId = (channel: string): string => `${ownerId}:track:${channel}`;
  const thumbId = (channel: string): string => `${ownerId}:thumb:${channel}`;
  const swatchId = (value: string): string => `${ownerId}:swatch:${value}`;
  const ctx = (): ColorPickerContext => service.context;
  const send: Send = (event): void => {
    service.send(event);
  };

  const open = (): boolean => isOpenPhase(service.phase, ctx().inline);

  /** The live color object, parsed from the serialized context. */
  const colorOf = (): ReturnType<typeof parseColor> => {
    try {
      return parseColor(ctx().value);
    } catch {
      return parseColor("#000000");
    }
  };

  const areaChannels = (props?: AreaSlotProps): { x: ColorChannel; y: ColorChannel } => ({
    x: props?.xChannel ?? "saturation",
    y: props?.yChannel ?? "brightness",
  });

  // ---- geometry -----------------------------------------------------------

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
    channel: string,
    orientation: "horizontal" | "vertical",
    clientX: number,
    clientY: number,
    dir: "ltr" | "rtl",
  ): number => {
    const rect = node.getBoundingClientRect();
    const clamp = (n: number): number => Math.min(1, Math.max(0, n));
    void channel;
    if (orientation === "vertical") return clamp((clientY - rect.top) / rect.height);
    const raw = clamp((clientX - rect.left) / rect.width);
    return dir === "rtl" ? 1 - raw : raw;
  };

  // ---- drags --------------------------------------------------------------

  /** One area drag: press owns the pointer, moves report, release ends. */
  const areaDrag = {
    onPointerDown: (event: PointerEvent, slots?: AreaSlotProps): void => {
      const props = readProps();
      if (props.disabled || props.readOnly) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
      const node = event.currentTarget as Element | null;
      if (node === null) return;
      const at = pointPercent(node, event.clientX, event.clientY);
      void slots;
      event.preventDefault();
      (node as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
      send({ type: "AREA.POINTER_DOWN", x: at.x, y: at.y });
    },
    onPointerMove: (event: PointerEvent): void => {
      if (service.phase !== "dragging") return;
      const node = event.currentTarget as Element | null;
      if (node === null) return;
      const at = pointPercent(node, event.clientX, event.clientY);
      send({ type: "AREA.POINTER_MOVE", x: at.x, y: at.y });
    },
    onPointerUp: (): void => {
      if (service.phase !== "dragging") return;
      send({ type: "AREA.POINTER_UP" });
    },
  };

  /** One channel drag, per channel slot. */
  const channelDrag = {
    onPointerDown: (event: PointerEvent, channel: ColorChannel, orientation: "horizontal" | "vertical"): void => {
      const props = readProps();
      if (props.disabled || props.readOnly) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
      const node = event.currentTarget as Element | null;
      if (node === null) return;
      const percent = trackPercent(node, channel, orientation, event.clientX, event.clientY, props.dir);
      event.preventDefault();
      (node as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
      send({ type: "CHANNEL_SLIDER.POINTER_DOWN", channel, percent });
    },
    onPointerMove: (event: PointerEvent, channel: ColorChannel, orientation: "horizontal" | "vertical"): void => {
      if (service.phase !== "dragging") return;
      const node = event.currentTarget as Element | null;
      if (node === null) return;
      const props = readProps();
      const percent = trackPercent(node, channel, orientation, event.clientX, event.clientY, props.dir);
      send({ type: "CHANNEL_SLIDER.POINTER_MOVE", channel, percent });
    },
    onPointerUp: (): void => {
      if (service.phase !== "dragging") return;
      send({ type: "CHANNEL_SLIDER.POINTER_UP" });
    },
  };

  // ---- keyboard maps ------------------------------------------------------

  const onAreaKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    if (props.disabled || props.readOnly) return;
    if (isComposing(event)) return;
    const step = arrowStep(event);
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        send({ type: "AREA.ARROW", channel: "x", delta: props.dir === "rtl" ? step : -step });
        return;
      case "ArrowRight":
        event.preventDefault();
        send({ type: "AREA.ARROW", channel: "x", delta: props.dir === "rtl" ? -step : step });
        return;
      case "ArrowUp":
        event.preventDefault();
        send({ type: "AREA.ARROW", channel: "y", delta: step });
        return;
      case "ArrowDown":
        event.preventDefault();
        send({ type: "AREA.ARROW", channel: "y", delta: -step });
        return;
      case "Home":
        event.preventDefault();
        send({ type: "AREA.HOME_END", channel: "x", toMax: false });
        return;
      case "End":
        event.preventDefault();
        send({ type: "AREA.HOME_END", channel: "x", toMax: true });
        return;
      default:
        return;
    }
  };

  const onChannelKeydown = (event: KeyboardEvent, channel: ColorChannel): void => {
    if (event.defaultPrevented) return;
    const props = readProps();
    if (props.disabled || props.readOnly) return;
    if (isComposing(event)) return;
    const step = arrowStep(event);
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: -step });
        return;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        send({ type: "CHANNEL_SLIDER.ARROW", channel, delta: step });
        return;
      case "Home":
        event.preventDefault();
        send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: false });
        return;
      case "End":
        event.preventDefault();
        send({ type: "CHANNEL_SLIDER.HOME_END", channel, toMax: true });
        return;
      default:
        return;
    }
  };

  /** The panel's dismissal, attached to the ROOT part: the root wraps the
   * trigger, so a press on it is inside and only a press elsewhere dismisses
   * — which is Zag's `trackDismissableElement` with its exclude list. */
  const dismiss = {
    onEscape: (): void => {
      if (!open()) return;
      send({ type: "CLOSE" });
    },
    onOutside: (): void => {
      if (!open()) return;
      send({ type: "LAYER.INTERACT_OUTSIDE" });
    },
  };

  // ---- cached bags --------------------------------------------------------

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const triggerBag = cached();
  const positionerBag = cached();
  const contentBag = cached();
  const valueTextBag = cached();
  const areaBag = cached();
  const areaBgBag = cached();
  const areaThumbBag = cached();
  const gridBag = cached();
  const hiddenBag = cached();
  const eyeDropperBag = cached();
  const formatSelectBag = cached();
  const swatchGroupBag = cached();
  interface SlotKey { readonly key: string }
  const trackBags = new WeakMap<SlotKey, BagMemo>();
  const thumbBags = new WeakMap<SlotKey, BagMemo>();
  const sliderBags = new WeakMap<SlotKey, BagMemo>();
  const sliderLabelBags = new WeakMap<SlotKey, BagMemo>();
  const sliderTextBags = new WeakMap<SlotKey, BagMemo>();
  const inputBags = new WeakMap<SlotKey, BagMemo>();
  const swatchBags = new WeakMap<SlotKey, BagMemo>();
  const swatchTriggerBags = new WeakMap<SlotKey, BagMemo>();
  const swatchIndicatorBags = new WeakMap<SlotKey, BagMemo>();
  const slotKey = (parts: readonly string[]): SlotKey => ({ key: parts.join("|") });

  /** Zag's `getItemState` for a swatch: what one preset color is worth. */
  const swatchState = (props: SwatchSlotProps): ColorPickerItemState => {
    const own = readProps();
    return {
      value: props.value,
      disabled: own.disabled || props.disabled === true,
      checked: ctx().value.toLowerCase() === props.value.toLowerCase(),
    };
  };

  return {
    get open(): boolean {
      return open();
    },
    get value(): string {
      return ctx().value;
    },
    get valueAsString(): string {
      return valueAsString(ctx());
    },
    get format(): ColorFormat {
      return ctx().format;
    },
    get disabled(): boolean {
      return readProps().disabled;
    },
    get empty(): boolean {
      return false;
    },
    setValue: (value: string): void => send({ type: "VALUE.SET", value }),
    setFormat: (format: ColorFormat): void => send({ type: "FORMAT.SET", format }),
    setOpen: (next: boolean): void => {
      if (next === open()) return;
      send({ type: next ? "OPEN" : "CLOSE" });
    },
    getChannelValue: (channel: ColorChannel | "hex"): string => {
      const color = colorOf();
      if (channel === "hex") {
        try {
          return color.toString("hex");
        } catch {
          return ctx().value;
        }
      }
      // Hue/saturation/brightness are not rgb channels: read them off the
      // area value, the way the machine steps them. Alpha reads natively.
      try {
        const area: "hsla" | "hsba" = ctx().format.startsWith("hsl") ? "hsla" : "hsba";
        const source = channel === "alpha" ? color : color.toFormat(area);
        return String(source.getChannelValue(channel));
      } catch {
        return "";
      }
    },
    getRootProps: () => {
      const props = readProps();
      return rootBag(
        [service.phase, props.disabled, props.dir, rootId].join("|"),
        () => ({
          id: rootId,
          dir: props.dir,
          "data-disabled": dataAttr(props.disabled),
        }),
      );
    },
    getLabelProps: () => {
      const props = readProps();
      return labelBag([props.disabled, props.dir, labelId].join("|"), () => ({
        id: labelId,
        dir: props.dir,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getControlProps: () => {
      const props = readProps();
      return controlBag([props.disabled, controlId].join("|"), () => ({
        id: controlId,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getTriggerProps: () => {
      const props = readProps();
      const value = valueAsString(ctx());
      return triggerBag(
        [service.phase, ctx().value, props.disabled, props.readOnly, triggerId].join("|"),
        () => ({
          id: triggerId,
          type: "button",
          dir: props.dir,
          "aria-label": `select color. current color is ${value}`,
          "aria-controls": contentId,
          "aria-labelledby": labelId,
          "aria-haspopup": props.inline ? undefined : "dialog",
          "aria-expanded": open() ? "true" : "false",
          "data-state": open() ? "open" : "closed",
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          onClick: () => {
            if (props.disabled || props.readOnly) return;
            send({ type: "TRIGGER.CLICK" });
          },
          onBlur: () => {
            if (props.disabled || props.readOnly) return;
            send({ type: "TRIGGER.BLUR" });
          },
        }),
      );
    },
    getPositionerProps: () =>
      // data-state drives the recipe's closed utilities: the `hidden`
      // attribute alone loses to the content's own `display` utility, so a
      // closed panel without this stays hittable over the page.
      positionerBag([positionerId, service.phase].join("|"), () => ({
        id: positionerId,
        "data-state": open() ? "open" : "closed",
      })),
    getContentProps: () => {
      const props = readProps();
      return contentBag([service.phase, ctx().value, contentId].join("|"), () => ({
        id: contentId,
        role: props.inline ? undefined : "dialog",
        tabindex: "-1",
        dir: props.dir,
        "data-state": open() ? "open" : "closed",
        hidden: open() ? undefined : "",
        // The layer: a press outside the panel dismisses, and Escape
        // while it is up does too.
        "use:dismissable": dismiss,
      }));
    },
    getValueTextProps: () => {
      const props = readProps();
      return valueTextBag([ctx().value, valueTextId].join("|"), () => ({
        id: valueTextId,
        dir: props.dir,
        "data-disabled": dataAttr(props.disabled),
      }));
    },
    getAreaProps: (slots?: AreaSlotProps) => {
      const props = readProps();
      const { x, y } = areaChannels(slots);
      const color = colorOf();
      return areaBag(
        [ctx().value, x, y, props.disabled, props.readOnly, areaId].join("|"),
        () => ({
          id: areaId,
          role: "group",
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          "data-channel-x": x,
          "data-channel-y": y,
          "--picker-area": color.toString("css"),
          onPointerdown: (event: PointerEvent) => areaDrag.onPointerDown(event, slots),
          onPointermove: (event: PointerEvent) => areaDrag.onPointerMove(event),
          onPointerup: () => areaDrag.onPointerUp(),
        }),
      );
    },
    getAreaBackgroundProps: (slots?: AreaSlotProps) => {
      const props = readProps();
      const { x, y } = areaChannels(slots);
      return areaBgBag([ctx().value, x, y, areaId].join("|"), () => ({
        id: `${areaId}:background`,
        "data-disabled": dataAttr(props.disabled),
        "data-readonly": dataAttr(props.readOnly),
        "--picker-area": colorOf().toString("css"),
      }));
    },
    getAreaThumbProps: (slots?: AreaSlotProps) => {
      const props = readProps();
      const { x, y } = areaChannels(slots);
      const color = colorOf();
      // The area's channels live in the area format: read them off the
      // converted value, because an rgb color has no saturation channel and
      // the raw read throws (which is why the thumb sat at 0,0 for red).
      const area: "hsla" | "hsba" = ctx().format.startsWith("hsl") ? "hsla" : "hsba";
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
      if (props.dir === "rtl") xp = 1 - xp;
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
      return areaThumbBag(
        [ctx().value, x, y, props.dir, props.disabled, areaThumbId].join("|"),
        () => ({
          id: areaThumbId,
          role: "slider",
          tabindex: props.disabled ? undefined : "0",
          dir: props.dir,
          "aria-label": `${x} and ${y}`,
          "aria-roledescription": "2d slider",
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": String(xv),
          "aria-valuetext": `${x} ${xv}, ${y} ${yv}`,
          "aria-disabled": props.disabled ? "true" : undefined,
          "data-disabled": dataAttr(props.disabled),
          "--picker-x": `${xp * 100}%`,
          "--picker-y": `${yp * 100}%`,
          "--picker-color": color.toString("css"),
          onFocus: () => send({ type: "AREA.ACTIVATE" }),
          onKeydown: onAreaKeydown,
        }),
      );
    },
    getTransparencyGridProps: () =>
      gridBag(["grid"].join("|"), () => ({ "--picker-grid": "12px" })),
    getChannelSliderProps: (slots: ChannelSlotProps) => {
      const props = readProps();
      const orientation = slots.orientation ?? "horizontal";
      return keyed(
        sliderBags,
        slotKey([slots.channel, orientation]),
        [props.disabled, props.readOnly, orientation].join("|"),
        () => ({
          role: "presentation",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          onPointerdown: (event: PointerEvent) =>
            channelDrag.onPointerDown(event, slots.channel, orientation),
          onPointermove: (event: PointerEvent) =>
            channelDrag.onPointerMove(event, slots.channel, orientation),
          onPointerup: () => channelDrag.onPointerUp(),
        }),
      );
    },
    getChannelSliderTrackProps: (slots: ChannelSlotProps) => {
      const props = readProps();
      const orientation = slots.orientation ?? "horizontal";
      return keyed(
        trackBags,
        slotKey([slots.channel, orientation, ctx().value]),
        [ctx().value, orientation, props.dir].join("|"),
        () => ({
          id: trackId(slots.channel),
          role: "group",
          "data-channel": slots.channel,
          "data-orientation": orientation,
          "--picker-track": colorOf().toString("css"),
        }),
      );
    },
    getChannelSliderThumbProps: (slots: ChannelSlotProps) => {
      const props = readProps();
      const orientation = slots.orientation ?? "horizontal";
      const color = colorOf();
      // Hue/saturation/brightness are not rgb channels: read them off the
      // area value, the way the machine steps them. Alpha reads natively.
      const area: "hsla" | "hsba" = ctx().format.startsWith("hsl") ? "hsla" : "hsba";
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
      if (orientation === "horizontal" && props.dir === "rtl") offset = 1 - offset;
      return keyed(
        thumbBags,
        slotKey([slots.channel, orientation, ctx().value]),
        [ctx().value, orientation, props.dir, props.disabled].join("|"),
        () => ({
          id: thumbId(slots.channel),
          role: "slider",
          tabindex: props.disabled ? undefined : "0",
          "aria-label": slots.channel,
          "aria-orientation": orientation,
          "aria-valuemin": String(min),
          "aria-valuemax": String(max),
          "aria-valuenow": String(now),
          "aria-valuetext": `${slots.channel} ${now}`,
          "aria-disabled": props.disabled ? "true" : undefined,
          "data-channel": slots.channel,
          "data-disabled": dataAttr(props.disabled),
          "data-orientation": orientation,
          "--picker-offset": `${offset * 100}%`,
          "--picker-color": color.toString("css"),
          onFocus: () =>
            send({ type: "CHANNEL_SLIDER.ACTIVATE", channel: slots.channel }),
          onKeydown: (event: KeyboardEvent) => onChannelKeydown(event, slots.channel),
        }),
      );
    },
    getChannelSliderLabelProps: (slots: ChannelSlotProps) => {
      const props = readProps();
      return keyed(
        sliderLabelBags,
        slotKey([slots.channel]),
        [props.dir].join("|"),
        () => ({ "data-channel": slots.channel, dir: props.dir }),
      );
    },
    getChannelSliderValueTextProps: (slots: ChannelSlotProps) =>
      keyed(sliderTextBags, slotKey([slots.channel, ctx().value]), [ctx().value].join("|"), () => ({
        "data-channel": slots.channel,
      })),
    getChannelInputProps: (slots: { channel: ColorChannel | "hex" }) => {
      const props = readProps();
      const isText = slots.channel === "hex";
      let current = "";
      try {
        current = slots.channel === "hex"
          ? colorOf().toString("hex")
          : String(colorOf().getChannelValue(slots.channel));
      } catch {
        // Unparseable shows empty.
      }
      return keyed(
        inputBags,
        slotKey([slots.channel, ctx().value, ctx().format]),
        [slots.channel, current, props.disabled, props.readOnly].join("|"),
        () => ({
          type: isText ? "text" : "number",
          dir: props.dir,
          "data-channel": slots.channel,
          "aria-label": slots.channel,
          "data-disabled": dataAttr(props.disabled),
          "data-readonly": dataAttr(props.readOnly),
          value: current,
          onFocus: (event: FocusEvent) => {
            if (props.disabled || props.readOnly) return;
            send({ type: "CHANNEL_INPUT.FOCUS", channel: slots.channel });
            (event.currentTarget as HTMLInputElement | null)?.select?.();
          },
          onBlur: (event: FocusEvent) => {
            if (props.disabled || props.readOnly) return;
            const node = event.currentTarget as HTMLInputElement | null;
            const raw = node === null ? "" : node.value;
            send({ type: "CHANNEL_INPUT.BLUR", channel: slots.channel, value: raw });
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.defaultPrevented || isComposing(event)) return;
            if (props.disabled || props.readOnly) return;
            if (event.key !== "Enter") return;
            const node = event.currentTarget as HTMLInputElement | null;
            const raw = node === null ? "" : node.value;
            event.preventDefault();
            send({ type: "CHANNEL_INPUT.CHANGE", channel: slots.channel, value: raw });
          },
        }),
      );
    },
    getHiddenInputProps: () => {
      const props = readProps();
      return hiddenBag([ctx().value, props.name].join("|"), () => ({
        id: hiddenInputId,
        type: "text",
        name: props.name.length > 0 ? props.name : undefined,
        tabindex: "-1",
        readonly: props.readOnly ? "" : undefined,
        value: valueAsString(ctx()),
      }));
    },
    getEyeDropperTriggerProps: () => {
      const props = readProps();
      const supported = typeof (globalThis as Record<string, unknown>)["EyeDropper"] !== "undefined";
      return eyeDropperBag([props.disabled, supported].join("|"), () => ({
        id: eyeDropperId,
        type: "button",
        dir: props.dir,
        "aria-label": "Pick a color from the screen",
        "data-disabled": dataAttr(props.disabled),
        hidden: supported ? undefined : "",
        onClick: () => {
          if (props.disabled || props.readOnly) return;
          send({ type: "EYEDROPPER.CLICK" });
        },
      }));
    },
    getFormatSelectProps: () => {
      const props = readProps();
      return formatSelectBag([ctx().format, props.disabled].join("|"), () => ({
        id: formatSelectId,
        dir: props.dir,
        "data-disabled": dataAttr(props.disabled),
        value: ctx().format,
        onChange: (event: Event) => {
          const node = event.currentTarget as HTMLSelectElement | null;
          const next = node === null ? "" : node.value;
          const format = (["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsb", "hsba"] as const).find(
            (f) => f === next,
          );
          if (format === undefined) return;
          send({ type: "FORMAT.SET", format });
        },
      }));
    },
    getSwatchGroupProps: () =>
      swatchGroupBag([swatchGroupId].join("|"), () => ({ id: swatchGroupId, role: "group" })),
    getSwatchTriggerProps: (slots: SwatchSlotProps) => {
      const state = swatchState(slots);
      return keyed(
        swatchTriggerBags,
        slotKey([slots.value]),
        [state.checked, state.disabled, ctx().format].join("|"),
        () => ({
          id: swatchId(slots.value),
          type: "button",
          dir: readProps().dir,
          "aria-label": `select ${slots.value} as the color`,
          "data-state": state.checked ? "checked" : "unchecked",
          "data-value": slots.value,
          "data-disabled": dataAttr(state.disabled),
          "--picker-swatch": slots.value,
          onClick: () => {
            if (state.disabled || readProps().readOnly) return;
            send({ type: "SWATCH_TRIGGER.CLICK", value: slots.value });
          },
        }),
      );
    },
    getSwatchIndicatorProps: (slots: SwatchSlotProps) => {
      const state = swatchState(slots);
      return keyed(swatchIndicatorBags, slotKey([slots.value]), [state.checked].join("|"), () => ({
        "aria-hidden": "true",
        "data-state": state.checked ? "checked" : "unchecked",
        hidden: state.checked ? undefined : "",
      }));
    },
    getSwatchProps: (slots: SwatchSlotProps) => {
      const state = swatchState(slots);
      return keyed(swatchBags, slotKey([slots.value]), [state.checked].join("|"), () => ({
        "data-state": state.checked ? "checked" : "unchecked",
        "data-value": slots.value,
        "--picker-swatch": slots.value,
      }));
    },
  };
}
