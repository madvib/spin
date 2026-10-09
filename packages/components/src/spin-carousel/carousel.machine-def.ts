import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/carousel";

/**
 * The carousel's Zag wiring. `page-change` is faithful to Zag's
 * `onPageChange({ page })` — the zero-based page index, nothing derived.
 *
 * `toMachineProps` supplies what scope data cannot: `slideCount` (the
 * machine measures pages from it) and `translations.indicator`, voiced from
 * the slide labels so each dot is named by its slide.
 */

export interface CarouselPageChange {
  readonly page: number;
}

export const carousel: MachineDef = {
  machine,
  connect,
  toMachineProps: (values) => {
    const items = (values.items ?? []) as { label: string }[];
    return {
      slideCount: items.length,
      translations: {
        indicator: (index: number) => items[index]?.label ?? `Slide ${index + 1}`,
      },
    };
  },
  events: {
    "page-change": {
      on: "onPageChange",
      detail: (change: { page: number }): CarouselPageChange => ({
        page: change.page,
      }),
    },
  },
};
