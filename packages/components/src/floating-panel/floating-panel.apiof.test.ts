import { assertEquals } from "@std/assert";
import type { FloatingPanelApi } from "./floating-panel.presentation.ts";

Deno.test("FloatingPanelApi promises the component's surface", () => {
  const keys: (keyof FloatingPanelApi)[] = [
    "state",
    "isOpen",
    "dragging",
    "stage",
    "position",
    "size",
    "setOpen",
    "close",
    "minimize",
    "maximize",
    "restore",
    "getTriggerProps",
    "getPositionerProps",
    "getContentProps",
    "getDragTriggerProps",
    "getStageTriggerProps",
    "getCloseTriggerProps",
    "getResizeTriggerProps",
  ];
  assertEquals(keys.length, 18);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    FloatingPanelApi["state"],
    "closed" | "open" | "dragging" | "resizing"
  > = true;
  const setOpenTyped: AssertExact<FloatingPanelApi["setOpen"], () => void> =
    true;
  const closeTyped: AssertExact<FloatingPanelApi["close"], () => void> = true;
  const minimizeTyped: AssertExact<FloatingPanelApi["minimize"], () => void> =
    true;
  const maximizeTyped: AssertExact<FloatingPanelApi["maximize"], () => void> =
    true;
  const restoreTyped: AssertExact<FloatingPanelApi["restore"], () => void> =
    true;
  assertEquals(
    [
      stateTyped,
      setOpenTyped,
      closeTyped,
      minimizeTyped,
      maximizeTyped,
      restoreTyped,
    ].every(Boolean),
    true,
  );
});
