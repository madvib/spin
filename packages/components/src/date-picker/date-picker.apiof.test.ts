import { assertEquals } from "@std/assert";
import type { DatePickerApi, DatePickerCellView } from "./date-picker.presentation.ts";
import type { DatePickerValue } from "./date-picker.state.ts";

Deno.test("DatePickerApi promises the component's surface", () => {
  const keys: (keyof DatePickerApi)[] = [
    "state",
    "isOpen",
    "value",
    "valueAsString",
    "focusedValue",
    "view",
    "open",
    "close",
    "clear",
    "setValue",
    "getTriggerProps",
    "getContentProps",
    "getGridProps",
    "getWeekdayLabels",
    "getValueTextRows",
    "getViewTextRows",
    "getCells",
    "getCellProps",
    "getPrevTriggerProps",
    "getNextTriggerProps",
    "getViewControlProps",
    "getClearTriggerProps",
    "getCellIndexes",
  ];
  assertEquals(keys.length, 23);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<DatePickerApi["state"], "idle" | "focused" | "open"> = true;
  const setValueTyped: AssertExact<
    DatePickerApi["setValue"],
    (value: readonly DatePickerValue[] | null) => void
  > = true;
  const getCellPropsTyped: AssertExact<
    DatePickerApi["getCellProps"],
    (cell: DatePickerCellView) => Record<string, unknown>
  > = true;
  const getCellsTyped: AssertExact<
    DatePickerApi["getCells"],
    () => readonly DatePickerCellView[]
  > = true;
  const getWeekdayLabelsTyped: AssertExact<DatePickerApi["getWeekdayLabels"], () => readonly string[]> = true;
  const getValueTextRowsTyped: AssertExact<
    DatePickerApi["getValueTextRows"],
    () => readonly { readonly value: string; readonly text: string }[]
  > = true;
  const getViewTextRowsTyped: AssertExact<
    DatePickerApi["getViewTextRows"],
    () => readonly { readonly value: string; readonly text: string }[]
  > = true;
  assertEquals(
    [
      stateTyped,
      setValueTyped,
      getCellPropsTyped,
      getCellsTyped,
      getWeekdayLabelsTyped,
      getValueTextRowsTyped,
      getViewTextRowsTyped,
    ].every(Boolean),
    true,
  );
});
