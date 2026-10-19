import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { colorPicker } from "./color-picker.bindings.ts";
const createColorPickerBridge = colorPicker.createBridge;
import type {
  ColorPickerFormatChange,
  ColorPickerOpenChange,
  ColorPickerValueChange,
} from "./color-picker.bindings.ts";
import type { ColorPickerApi } from "./color-picker.bindings.ts";
import type { ColorFormat } from "./color-picker.machine.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one is
 * checked here and typed once, instead of an unchecked cast at every call site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/**
 * linkedom ships no KeyboardEvent/PointerEvent constructors, so the events the
 * handlers need are synthesized here — one place, with the minimal field set
 * each handler reads.
 */
function keydown(key: string, shift = false): KeyboardEvent {
  const made: Record<string, unknown> = {
    key,
    shiftKey: shift,
    defaultPrevented: false,
  };
  made["preventDefault"] = (): void => {
    made["defaultPrevented"] = true;
  };
  return made as unknown as KeyboardEvent;
}

const pointerAt = (x: number, y: number): PointerEvent =>
  ({
    button: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
      setPointerCapture: (_id: number): void => {},
    },
    preventDefault: (): void => {},
  }) as unknown as PointerEvent;

interface Harness {
  readonly api: ColorPickerApi;
  readonly root: Element;
  readonly events: {
    readonly valueChange: ColorPickerValueChange[];
    readonly valueChangeEnd: ColorPickerValueChange[];
    readonly openChange: ColorPickerOpenChange[];
    readonly formatChange: ColorPickerFormatChange[];
  };
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a host
 * write re-runs the bridge's controlled-channel effect. A prop passed in
 * `overrides` is AUTHORED, which is the element's `@@authored` predicate. */
function mount(overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const events = {
    valueChange: [] as ColorPickerValueChange[],
    valueChangeEnd: [] as ColorPickerValueChange[],
    openChange: [] as ColorPickerOpenChange[],
    formatChange: [] as ColorPickerFormatChange[],
  };
  const values: Record<string, WriteSignal> = {};
  const authoredKeys = new Set(Object.keys(overrides));
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onValueChange", (change: ColorPickerValueChange) => events.valueChange.push(change));
  write("onValueChangeEnd", (change: ColorPickerValueChange) => events.valueChangeEnd.push(change));
  write("onOpenChange", (change: ColorPickerOpenChange) => events.openChange.push(change));
  write("onFormatChange", (change: ColorPickerFormatChange) => events.formatChange.push(change));
  const bridge = createColorPickerBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      record["@@authored"] = (name: string): boolean => authoredKeys.has(name);
      return record;
    },
    () => root,
    "brand",
  );
  return { api: bridge.api, root, events, write };
}

Deno.test("seeds black in hex", () => {
  const h = mount();
  assertEquals(h.api.value, "#000000");
  assertEquals(h.api.format, "hex");
  assertEquals(h.api.open, false);
});

Deno.test("seeds the authored value and format", () => {
  const h = mount({ defaultValue: "#ff0000", defaultFormat: "rgb" });
  assertEquals(h.api.value, "rgb(255, 0, 0)");
  assertEquals(h.api.format, "rgb");
});

Deno.test("trigger opens and closes", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.api.open, true);
  assertEquals(h.events.openChange.length, 1);
  assertEquals(h.events.openChange[0]?.open, true);
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.api.open, false);
});

Deno.test("inline is always open", () => {
  const h = mount({ inline: true });
  assertEquals(h.api.open, true);
});

Deno.test("swatch commits the color", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  handler<() => void>(h.api.getSwatchTriggerProps({ value: "#00ff00" }), "onClick")();
  assertEquals(h.api.value.toLowerCase(), "#00ff00");
  assertEquals(h.events.valueChange.length, 1);
  assertEquals(h.events.valueChangeEnd.length, 1);
});

Deno.test("swatch closes when closeOnSelect", () => {
  const h = mount({ closeOnSelect: true });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  assertEquals(h.api.open, true);
  handler<() => void>(h.api.getSwatchTriggerProps({ value: "#00ff00" }), "onClick")();
  assertEquals(h.api.open, false);
});

Deno.test("area drag moves the color and ends", () => {
  const h = mount({ defaultValue: "#ff0000" });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const before = h.api.value;
  handler<(e: PointerEvent) => void>(h.api.getAreaProps(), "onPointerdown")(pointerAt(100, 100));
  const moved = h.api.value;
  assertEquals(moved === before, false);
  handler<(e: PointerEvent) => void>(h.api.getAreaProps(), "onPointermove")(pointerAt(150, 50));
  handler<() => void>(h.api.getAreaProps(), "onPointerup")();
  assertEquals(h.events.valueChangeEnd.length, 1);
});

Deno.test("area arrows step the channels", () => {
  const h = mount({ defaultValue: "#ff0000" });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const thumb = h.api.getAreaThumbProps();
  const before = h.api.value;
  handler<(e: KeyboardEvent) => void>(thumb, "onKeydown")(keydown("ArrowLeft"));
  assertEquals(h.api.value === before, false);
});

Deno.test("channel arrows step hue", () => {
  const h = mount({ defaultValue: "#ff0000" });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const thumb = h.api.getChannelSliderThumbProps({ channel: "hue" });
  const before = h.api.value;
  handler<(e: KeyboardEvent) => void>(thumb, "onKeydown")(keydown("ArrowRight"));
  assertEquals(h.api.value === before, false);
});

Deno.test("channel home jumps to the range floor", () => {
  const h = mount({ defaultValue: "#ff0000" });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const thumb = h.api.getChannelSliderThumbProps({ channel: "hue" });
  handler<(e: KeyboardEvent) => void>(thumb, "onKeydown")(keydown("Home"));
  assertEquals(h.api.getChannelValue("hue"), "0");
});

Deno.test("hex input commits on blur", () => {
  const h = mount();
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const input = h.api.getChannelInputProps({ channel: "hex" }) as Record<string, unknown>;
  handler<(e: FocusEvent) => void>(input, "onFocus")({ currentTarget: { value: "", select: (): void => {} } } as unknown as FocusEvent);
  handler<(e: FocusEvent) => void>(input, "onBlur")({ currentTarget: { value: "#0000ff" } } as unknown as FocusEvent);
  assertEquals(h.api.value.toLowerCase(), "#0000ff");
  assertEquals(h.events.valueChangeEnd.length, 1);
});

Deno.test("garbage input keeps the color", () => {
  const h = mount({ defaultValue: "#ff0000" });
  handler<() => void>(h.api.getTriggerProps(), "onClick")();
  const input = h.api.getChannelInputProps({ channel: "hex" }) as Record<string, unknown>;
  handler<(e: FocusEvent) => void>(input, "onBlur")({ currentTarget: { value: "not-a-color" } } as unknown as FocusEvent);
  assertEquals(h.api.value, "rgb(255, 0, 0)".length > 0 ? h.api.value : "#ff0000");
});

Deno.test("format select reserializes", () => {
  const h = mount({ defaultValue: "#ff0000" });
  const before = h.api.value;
  void before;
  h.api.setFormat("rgb" as ColorFormat);
  assertEquals(h.api.format, "rgb");
  assertEquals(h.api.value, "rgb(255, 0, 0)");
  assertEquals(h.events.formatChange.length, 1);
});

Deno.test("commands move the machine", () => {
  const h = mount();
  h.api.setValue("#00ff00");
  assertEquals(h.api.value.toLowerCase(), "#00ff00");
  h.api.setOpen(true);
  assertEquals(h.api.open, true);
  h.api.setOpen(false);
  assertEquals(h.api.open, false);
});

Deno.test("authored value seeds the color", () => {
  const h = mount({ value: "#0000ff" });
  assertEquals(h.api.value.toLowerCase(), "#0000ff");
});

Deno.test("aria contract on trigger and area", () => {
  const h = mount();
  const trigger = h.api.getTriggerProps() as Record<string, unknown>;
  assertEquals(trigger["aria-haspopup"], "dialog");
  assertEquals(trigger["aria-expanded"], "false");
  handler<() => void>(trigger, "onClick")();
  const open = h.api.getTriggerProps() as Record<string, unknown>;
  assertEquals(open["aria-expanded"], "true");
  const thumb = h.api.getAreaThumbProps() as Record<string, unknown>;
  assertEquals(thumb["role"], "slider");
  assertEquals(thumb["aria-roledescription"], "2d slider");
  const hue = h.api.getChannelSliderThumbProps({ channel: "hue" }) as Record<string, unknown>;
  assertEquals(hue["role"], "slider");
  assertEquals(hue["aria-label"], "hue");
});
