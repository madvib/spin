import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parseHTML } from "@spinjs/components/testing";
import { provideController, type SpinController } from "@spinjs/components/runtime";
import { spinComponentCtl } from "./controller.ts";
import { useSpinComponent as useVueSpinComponent } from "./vue/vue.ts";
import { createSpinComponent as createSvelteSpinComponent } from "./svelte/svelte.ts";
import { createSpinComponent as createSolidSpinComponent } from "./solid/solid.ts";

const win = parseHTML(
  "<!doctype html><html><body></body></html>",
) as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;

/**
 * The ctl is available the moment the host holds the element — `bind`
 * writes props and subscribes events with no wait, so a seed lands before
 * the component's build reads it. `commands` and `state` resolve through the
 * registered controller once it exists; before then commands are safe no-ops
 * and unknown state reads `undefined`.
 */

function element(): Element {
  return document.createElement("div");
}

test("spinComponentCtl binds before any controller registers", () => {
  const el = element();
  const ctl = spinComponentCtl(el);
  const seen: string[] = [];
  const unbind = ctl.bind({ items: [1, 2] }, {
    "value-change": () => seen.push("event"),
  });
  deepStrictEqual((el as unknown as Record<string, unknown>)["items"], [1, 2]);
  el.dispatchEvent(new CustomEvent("value-change"));
  deepStrictEqual(seen, ["event"]);
  unbind();
  el.dispatchEvent(new CustomEvent("value-change"));
  deepStrictEqual(seen, ["event"], "unbind detaches the subscription");
});

test("spinComponentCtl commands no-op and state reads undefined before connect", () => {
  const el = element();
  const ctl = spinComponentCtl<{ show(): void }, { open: () => boolean }>(el);
  ctl.commands.show();
  deepStrictEqual(ctl.state.open(), undefined);
  deepStrictEqual(Object.keys(ctl.commands).length, 0);
  deepStrictEqual(Object.keys(ctl.state).length, 0);
});

test("spinComponentCtl resolves commands and state once provided", () => {
  const el = element();
  const ctl = spinComponentCtl<{ show(): void }, { open: () => boolean }>(el);
  let open = false;
  const controller: SpinController = {
    commands: {
      show: () => {
        open = true;
      },
    },
    state: { open: () => open },
  };
  provideController(el, () => controller);
  deepStrictEqual(typeof ctl.commands.show, "function");
  ctl.commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(ctl.state.open(), true);
});

test("spinComponentCtl with a handle resolves the ancestor's provided controller", () => {
  const parent = element();
  const child = element();
  (parent as unknown as { appendChild(c: Element): void }).appendChild(child);
  const handle = {};
  let open = false;
  provideController(
    parent,
    () => ({
      commands: {
        show: () => {
          open = true;
        },
      },
      state: { open: () => open },
    }),
    handle,
  );
  const ctl = spinComponentCtl<{ show(): void }, { open: () => boolean }>(
    child,
    handle,
  );
  ctl.commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(ctl.state.open(), true);
});

test("spinComponentCtl bind follows ref set after creation", () => {
  const el = element();
  const ctl = spinComponentCtl<{ show(): void }, { open: () => boolean }>(
    undefined,
  );
  let open = false;
  provideController(el, () => ({
    commands: { show: () => { open = true; } },
    state: { open: () => open },
  }));
  ctl.ref(el);
  ctl.commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(ctl.state.open(), true);
});

test("solid createSpinComponent returns a callable non-nullable ctl", () => {
  const el = element();
  let open = false;
  provideController(el, () => ({
    commands: {
      show: () => {
        open = true;
      },
    },
    state: { open: () => open },
  }));
  const ctl = createSolidSpinComponent<{ show(): void }, { open: () => boolean }>(
    () => el,
  );
  ctl().commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(ctl().state.open(), true);
  ctl.commands.show();
  deepStrictEqual(ctl.state.open(), true);
});

test("vue useSpinComponent reads the element ref and resolves commands", () => {
  const el = element();
  let open = false;
  provideController(el, () => ({
    commands: {
      show: () => {
        open = true;
      },
    },
    state: { open: () => open },
  }));
  const vue = useVueSpinComponent<{ show(): void }, { open: () => boolean }>({
    value: el,
  });
  vue.current.commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(vue.current.state.open(), true);
});

test("svelte createSpinComponent action binds props and store reads the ctl", () => {
  const el = element();
  let open = false;
  provideController(el, () => ({
    commands: {
      show: () => {
        open = true;
      },
    },
    state: { open: () => open },
  }));
  const svelte = createSvelteSpinComponent<{ show(): void }, { open: () => boolean }>();
  const seen: (typeof svelte.ctl)[] = [];
  const unsub = svelte.subscribe((ctl) => seen.push(ctl));
  const { destroy } = svelte.action(el, { props: { items: [1] } });
  deepStrictEqual((el as unknown as Record<string, unknown>)["items"], [1]);
  svelte.ctl.commands.show();
  deepStrictEqual(open, true);
  deepStrictEqual(seen.length >= 2, true);
  deepStrictEqual(seen.every((ctl) => ctl === svelte.ctl), true);
  destroy();
  unsub();
});

test("spinComponentCtl subscribe re-runs on state moves and stops after dispose", async () => {
  const { signal } = await import("@spinjs/components/runtime");
  const el = element();
  const open = signal(false);
  provideController(el, () => ({
    commands: {},
    state: { open: () => open() },
  }));
  const ctl = spinComponentCtl(el);
  let runs = 0;
  const stop = ctl.subscribe(() => runs++);
  deepStrictEqual(runs, 0);
  open(true);
  await Promise.resolve();
  deepStrictEqual(runs, 1);
  stop();
  open(false);
  await Promise.resolve();
  deepStrictEqual(runs, 1);
});
