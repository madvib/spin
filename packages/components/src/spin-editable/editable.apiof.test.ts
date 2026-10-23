import { assertEquals } from "@std/assert";
import type { EditableApi } from "./editable.presentation.ts";

Deno.test("EditableApi promises the component's surface", () => {
  const keys: (keyof EditableApi)[] = [
    "state",
    "editing",
    "empty",
    "value",
    "valueText",
    "setValue",
    "clearValue",
    "edit",
    "cancel",
    "submit",
    "getRootProps",
    "getAreaProps",
    "getLabelProps",
    "getInputProps",
    "getPreviewProps",
    "getEditTriggerProps",
    "getControlProps",
    "getSubmitTriggerProps",
    "getCancelTriggerProps",
  ];
  assertEquals(keys.length, 19);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<EditableApi["state"], "preview" | "edit"> = true;
  const setValueTyped: AssertExact<EditableApi["setValue"], (value: string) => void> = true;
  const getInputPropsTyped: AssertExact<EditableApi["getInputProps"], () => Record<string, unknown>> = true;
  assertEquals([stateTyped, setValueTyped, getInputPropsTyped].every(Boolean), true);
});