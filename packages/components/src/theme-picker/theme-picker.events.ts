import type { EventUnion } from "@spinjs/components/fsm";
import type { ThemePickerItem } from "./theme-picker.state.ts";

export interface ThemePickerEvents {
  "TRIGGER.CLICK": {};
  "OPEN": {};
  "CLOSE": {};
  "HIGHLIGHT.NEXT": {};
  "HIGHLIGHT.PREV": {};
  "HIGHLIGHT.FIRST": {};
  "HIGHLIGHT.LAST": {};
  "HIGHLIGHT.SET": { readonly value: string };
  "ITEM.SELECT": { readonly value: string };
  "VALUE.SET": { readonly value: string };
  "THEMES.SET": { readonly themes: readonly unknown[] | string };
}

export type ThemePickerEvent = EventUnion<ThemePickerEvents>;

export type ThemePickerValueChange = {
  readonly value: string;
  readonly item: ThemePickerItem;
};

export type ThemePickerOpenChange = {
  readonly open: boolean;
};
