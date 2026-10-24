import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import {
  interactOutside,
  type InteractOutsideEvent,
} from "./interact-outside.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/** The document's own Event constructor, for events that must walk its tree:
 * a Deno `Event` cannot, and linkedom's dispatcher needs its own object. */
function windowEvent(source: unknown): typeof Event {
  if (!(source instanceof Object) || !("Event" in source)) {
    throw new Error("the parsed document exposes no window");
  }
  const ctor: unknown = source.Event;
  if (typeof ctor !== "function") {
    throw new Error("the window exposes no Event");
  }
  // The library type of linkedom's constructor is unexpressible here.
  return ctor as typeof Event;
}

const WindowEvent = windowEvent(win["window"]);

interface Reports {
  readonly pointer: InteractOutsideEvent[];
  readonly focus: InteractOutsideEvent[];
}

/** The three callbacks the action reports through, collected. */
function watch(): {
  readonly reports: Reports;
  readonly param: Parameters<typeof interactOutside>[1];
} {
  const reports: Reports = { pointer: [], focus: [] };
  return {
    reports,
    param: {
      onPointerDownOutside: (event: InteractOutsideEvent): void => {
        reports.pointer.push(event);
      },
      onFocusOutside: (event: InteractOutsideEvent): void => {
        reports.focus.push(event);
      },
      exclude: (): readonly (Element | null)[] => [],
    },
  };
}

/** A pointerdown (or focusin) dispatched at `target`, which must be in the
 * document for the document-level listeners to see it. The event is built
 * with the document's own constructor: a Deno `Event` cannot walk linkedom's
 * tree. */
function dispatch(target: Element, type: string): void {
  target.dispatchEvent(new WindowEvent(type, { bubbles: true }));
}

test("Given an attached action / When the pointer presses outside the node / Then it reports once", () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  const outside = document.createElement("button");
  document.body.appendChild(outside);
  const { reports, param } = watch();
  const result = interactOutside(input, param);
  dispatch(outside, "pointerdown");
  deepStrictEqual(reports.pointer.length, 1, "the press reports once");
  deepStrictEqual(
    reports.pointer[0]?.type,
    "pointerdown",
    "and names the interaction",
  );
  deepStrictEqual(
    reports.pointer[0]?.detail.focusable,
    true,
    "a button outside is focusable",
  );
  deepStrictEqual(
    reports.pointer[0]?.defaultPrevented,
    false,
    "the event starts unvetoed",
  );
  result?.destroy?.();
  dispatch(outside, "pointerdown");
  deepStrictEqual(reports.pointer.length, 1, "destroy releases the listener");
});

test("Given an attached action / When the pointer presses the node itself / Then it stays silent", () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  const { reports, param } = watch();
  interactOutside(input, param);
  dispatch(input, "pointerdown");
  deepStrictEqual(reports.pointer.length, 0, "a press on the node is not outside");
});

test("Given an attached action / When the interaction is on an excluded part / Then it stays silent", () => {
  const input = document.createElement("input");
  const submit = document.createElement("button");
  document.body.append(input, submit);
  const reports: Reports = { pointer: [], focus: [] };
  interactOutside(input, {
    onPointerDownOutside: (event: InteractOutsideEvent): void => {
      reports.pointer.push(event);
    },
    exclude: (): readonly (Element | null)[] => [submit],
  });
  dispatch(submit, "pointerdown");
  deepStrictEqual(reports.pointer.length, 0, "the excluded part is not outside");
});

test("Given an attached action / When focus moves outside / Then it reports and names the target", () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  const moved = document.createElement("button");
  document.body.appendChild(moved);
  const { reports, param } = watch();
  interactOutside(input, param);
  dispatch(moved, "focusin");
  deepStrictEqual(reports.focus.length, 1, "the focus move reports once");
  deepStrictEqual(reports.focus[0]?.type, "focus", "and names the interaction");
  deepStrictEqual(
    reports.focus[0]?.detail.focusable,
    true,
    "a focused button is focusable",
  );
  deepStrictEqual(reports.pointer.length, 0, "and reports nothing as a press");
});

test("Given a press in flight / When the click's own focus move follows / Then it reports only once", () => {
  const input = document.createElement("input");
  document.body.appendChild(input);
  const moved = document.createElement("button");
  document.body.appendChild(moved);
  const { reports, param } = watch();
  interactOutside(input, param);
  dispatch(moved, "pointerdown");
  dispatch(moved, "focusin");
  deepStrictEqual(reports.pointer.length, 1, "the press reports");
  deepStrictEqual(
    reports.focus.length,
    0,
    "and the click's focus move does not report again",
  );
  dispatch(input, "pointerup");
  dispatch(moved, "focusin");
  deepStrictEqual(
    reports.focus.length,
    1,
    "a later focus move reports on its own",
  );
});
