/** Color-picker machine: chart only. */

import {
  createMachine,
  type Machine,
  type MachineSpec,
} from "@spinjs/runtime/fsm";
import type {
  ColorFormat,
  ColorPickerArgs,
  ColorPickerContext,
  ColorPickerState,
} from "./color-picker.state.ts";
import type { ColorChannel } from "@zag-js/color-utils";
import { initial } from "./color-picker.state.ts";
import type { ColorPickerEvents } from "./color-picker.events.ts";
import {
  boundAreaValue,
  boundChannelValue,
  clearActiveChannel,
  isOpenControlled,
  setActiveChannel,
  setAreaFromPoint,
  setChannelFromInput,
  setChannelFromPoint,
  setFormat,
  setSliderChannel,
  setValue,
  setValueFromSwatch,
  stepAreaValue,
  stepChannelValue,
} from "./color-picker.transitions.ts";

const config: MachineSpec<
  ColorPickerContext,
  ColorPickerEvents,
  ColorPickerState
> = {
  id: "color-picker",
  initial: "idle",
  context: {
    value: "#000000",
    format: "hex" as ColorFormat,
    activeChannel: null as ColorChannel | null,
    areaX: "saturation" as ColorChannel,
    areaY: "brightness" as ColorChannel,
    disabled: false,
    readOnly: false,
    closeOnSelect: false,
    inline: false,
    dir: "ltr" as const,
    name: undefined as string | undefined,
  },
  on: {
    "VALUE.SET": { assign: setValue },
    "FORMAT.SET": { assign: setFormat },
    "CHANNEL_INPUT.CHANGE": { assign: setChannelFromInput },
  },
  states: {
    idle: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { target: "focused", assign: setActiveChannel },
        "AREA.POINTER_DOWN": { target: "dragging", assign: setAreaFromPoint },
        "CHANNEL_SLIDER.POINTER_DOWN": {
          target: "dragging",
          assign: setChannelFromPoint,
        },
        "SWATCH_TRIGGER.CLICK": { assign: setValueFromSwatch },
        "AREA.ARROW": { assign: stepAreaValue },
        "CHANNEL_SLIDER.ARROW": { assign: stepChannelValue },
      },
    },
    focused: {
      on: {
        "CONTROLLED.OPEN": { target: "active" },
        OPEN: [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "active" },
        ],
        "CHANNEL_INPUT.FOCUS": { assign: setActiveChannel },
        "CHANNEL_INPUT.BLUR": { target: "idle", assign: setChannelFromInput },
        "TRIGGER.BLUR": { target: "idle" },
        "SWATCH_TRIGGER.CLICK": { assign: setValueFromSwatch },
        "AREA.POINTER_DOWN": { target: "dragging", assign: setAreaFromPoint },
        "CHANNEL_SLIDER.POINTER_DOWN": {
          target: "dragging",
          assign: setChannelFromPoint,
        },
        "AREA.ARROW": { assign: stepAreaValue },
        "CHANNEL_SLIDER.ARROW": { assign: stepChannelValue },
      },
    },
    active: {
      on: {
        "CONTROLLED.CLOSE": { target: "idle" },
        CLOSE: [
          { cond: isOpenControlled },
          { target: "idle" },
        ],
        "LAYER.INTERACT_OUTSIDE": [
          { cond: isOpenControlled },
          { target: "idle" },
        ],
        "TRIGGER.CLICK": [
          { cond: isOpenControlled },
          { target: "focused" },
        ],
        "AREA.POINTER_DOWN": { target: "dragging", assign: setAreaFromPoint },
        "AREA.ACTIVATE": { assign: clearActiveChannel },
        "CHANNEL_SLIDER.POINTER_DOWN": {
          target: "dragging",
          assign: setChannelFromPoint,
        },
        "CHANNEL_SLIDER.ACTIVATE": { assign: setSliderChannel },
        "AREA.ARROW": { assign: stepAreaValue },
        "AREA.HOME_END": { assign: boundAreaValue },
        "CHANNEL_SLIDER.ARROW": { assign: stepChannelValue },
        "CHANNEL_SLIDER.HOME_END": { assign: boundChannelValue },
        "CHANNEL_INPUT.BLUR": { assign: setChannelFromInput },
        "SWATCH_TRIGGER.CLICK": [
          {
            cond: (ctx) => {
              return ctx.closeOnSelect;
            },
            target: "focused",
            assign: setValueFromSwatch,
          },
          { assign: setValueFromSwatch },
        ],
      },
    },
    dragging: {
      on: {
        "AREA.POINTER_MOVE": { assign: setAreaFromPoint },
        "AREA.POINTER_UP": [
          { cond: (ctx) => ctx.inline === true, target: "idle" },
          { target: "active" },
        ],
        "CHANNEL_SLIDER.POINTER_MOVE": { assign: setChannelFromPoint },
        "CHANNEL_SLIDER.POINTER_UP": [
          { cond: (ctx) => ctx.inline === true, target: "idle" },
          { target: "active" },
        ],
      },
    },
  },
};

export function colorPicker(
  args: ColorPickerArgs = {},
  authored: (name: string) => boolean,
): Machine<ColorPickerContext, ColorPickerEvents, ColorPickerState> {
  return createMachine<ColorPickerContext, ColorPickerEvents, ColorPickerState>(
    {
      ...config,
      context: initial(args, authored),
      fields: {
        value: { event: "VALUE.SET" },
        format: { event: "FORMAT.SET" },
        disabled: {},
        readOnly: {},
        closeOnSelect: {},
        inline: {},
        dir: {},
        name: {},
      },
    },
  );
}
