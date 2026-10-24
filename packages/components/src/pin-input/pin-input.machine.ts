/** Pin-input machine: chart only. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type {
  PinInputArgs,
  PinInputContext,
  PinInputState,
} from "./pin-input.state.ts";
import { initial } from "./pin-input.state.ts";
import type { PinInputEvents } from "./pin-input.events.ts";
import { fill, getNextValue, pinView } from "./pin-input.state.ts";
import {
  advanceFocusedIndex,
  clearFocusedValue,
  hasValue,
  setFocusedIndex,
  setFocusIndexToFirst,
  setPrevFocusedIndex,
} from "./pin-input.transitions.ts";

export function pinInput(
  args: PinInputArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<PinInputContext, PinInputEvents, PinInputState> {
  const viewOf = (ctx: PinInputContext) => pinView(ctx.value, ctx.count);
  return createMachine<PinInputContext, PinInputEvents, PinInputState>({
    id: "pin-input",
    initial: "idle",
    fields: {
      value: { event: "VALUE.SET" },
      count: {},
      dir: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      required: {},
      name: {},
      form: {},
      type: {},
      mask: {},
      otp: {},
      placeholder: {},
      pattern: {},
      translations: {},
      sanitizeValue: {},
      blurOnComplete: {},
      autoSubmit: {},
      autoFocus: {},
    },
    context: initial(args, authored),
    on: {
      "VALUE.SET": [
        {
          cond: (_ctx, event) =>
            event.type === "VALUE.SET" && event.index !== undefined,
          assign: (ctx, event) => {
            if (event.index === undefined) return {};
            const chars = viewOf(ctx).chars;
            const write = getNextValue(
              chars[ctx.focusedIndex] ?? "",
              event.value,
            );
            if (chars[event.index] === write) return {};
            const value = [...chars];
            value[event.index] = write;
            return { value };
          },
        },
        {
          assign: (ctx, event) =>
            event.index === undefined
              ? { value: fill(parseChars(event.value), ctx.count) }
              : {},
        },
      ],
      "VALUE.CLEAR": {
        assign: [
          (ctx) => ({ value: fill([], ctx.count) }),
          setFocusIndexToFirst,
        ],
      },
    },
    states: {
      idle: {
        on: {
          "INPUT.FOCUS": { target: "focused", assign: setFocusedIndex },
        },
      },
      focused: {
        on: {
          "INPUT.CHANGE": {
            assign: [(ctx, event) => {
              if (ctx.focusedIndex === -1) return {};
              const chars = viewOf(ctx).chars;
              const write = getNextValue(
                chars[ctx.focusedIndex] ?? "",
                event.value,
              );
              const value = [...chars];
              value[ctx.focusedIndex] = write;
              return { value };
            }, advanceFocusedIndex],
          },
          "INPUT.ADVANCE": { assign: advanceFocusedIndex },
          "INPUT.PASTE": {
            assign: [(ctx, event) => {
              const view = viewOf(ctx);
              const startIndex = Math.min(ctx.focusedIndex, view.filled);
              const left = startIndex > 0
                ? view.asString.substring(0, ctx.focusedIndex)
                : "";
              const right = event.value.substring(0, view.length - startIndex);
              return { value: fill(`${left}${right}`.split(""), view.length) };
            }, (ctx) => ({
              focusedIndex: Math.min(
                viewOf(ctx).filled,
                viewOf(ctx).length - 1,
              ),
            })],
          },
          "INPUT.FOCUS": { assign: setFocusedIndex },
          "INPUT.BLUR": {
            target: "idle",
            assign: () => ({ focusedIndex: -1 }),
          },
          "INPUT.DELETE": [
            { cond: hasValue, assign: clearFocusedValue },
          ],
          "INPUT.ARROW_LEFT": { assign: setPrevFocusedIndex },
          "INPUT.ARROW_RIGHT": {
            assign: (ctx) => {
              const view = viewOf(ctx);
              return {
                focusedIndex: Math.min(
                  ctx.focusedIndex + 1,
                  Math.min(view.filled, view.length - 1),
                ),
              };
            },
          },
          "INPUT.HOME": { assign: setFocusIndexToFirst },
          "INPUT.END": {
            assign: (ctx) => ({
              focusedIndex: Math.max(viewOf(ctx).filled - 1, 0),
            }),
          },
          "INPUT.BACKSPACE": [
            {
              cond: hasValue,
              assign: [clearFocusedValue, setPrevFocusedIndex],
            },
            { assign: [setPrevFocusedIndex, clearFocusedValue] },
          ],
        },
      },
    },
  });
}

function parseChars(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
    ? raw.split(",").map((part) => part.trim())
    : [];
  return parts.filter((part) => part.length === 1);
}
