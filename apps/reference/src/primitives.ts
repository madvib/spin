import {
  ALERT_EXAMPLES,
  alertFixtureNote,
} from "@spin/preset/rules/primitives/alert.examples.ts";
import {
  AVATAR_EXAMPLES,
  avatarFixtureNote,
} from "@spin/preset/rules/primitives/avatar.examples.ts";
import {
  BADGE_EXAMPLES,
  badgeFixtureNote,
} from "@spin/preset/rules/primitives/badge.examples.ts";
import {
  BUTTON_EXAMPLES,
  buttonFixtureNote,
} from "@spin/preset/rules/primitives/button.examples.ts";
import {
  CARD_EXAMPLES,
  cardFixtureNote,
} from "@spin/preset/rules/primitives/card.examples.ts";
import {
  CHECKBOX_EXAMPLES,
  controlFixtureNote,
  SWITCH_EXAMPLES,
  switchFixtureNote,
} from "@spin/preset/rules/primitives/control.examples.ts";
import {
  DETAILS_EXAMPLES,
  detailsFixtureNote,
} from "@spin/preset/rules/primitives/details.examples.ts";
import {
  METER_EXAMPLES,
  meterFixtureNote,
} from "@spin/preset/rules/primitives/meter.examples.ts";
import {
  DIALOG_EXAMPLES,
  dialogFixtureNote,
} from "@spin/preset/rules/primitives/dialog.examples.ts";
import {
  HR_EXAMPLES,
  hrFixtureNote,
} from "@spin/preset/rules/primitives/hr.examples.ts";
import {
  KBD_EXAMPLES,
  kbdFixtureNote,
} from "@spin/preset/rules/primitives/kbd.examples.ts";
import {
  fieldFixtureNote,
  INPUT_EXAMPLES,
  SELECT_EXAMPLES,
  selectFixtureNote,
  TEXTAREA_EXAMPLES,
  textareaFixtureNote,
} from "@spin/preset/rules/primitives/field.examples.ts";
import {
  STAT_EXAMPLES,
  statFixtureNote,
} from "@spin/preset/rules/primitives/stat.examples.ts";
import {
  FIELDSET_EXAMPLES,
  fieldsetFixtureNote,
} from "@spin/preset/rules/primitives/fieldset.examples.ts";
import {
  GROUP_EXAMPLES,
  groupFixtureNote,
} from "@spin/preset/rules/primitives/group.examples.ts";
import {
  LABEL_EXAMPLES,
  labelFixtureNote,
} from "@spin/preset/rules/primitives/label.examples.ts";
import {
  ICON_EXAMPLES,
  iconFixtureNote,
} from "@spin/preset/rules/primitives/icon.examples.ts";
import {
  POPOVER_SURFACE_EXAMPLES,
  popoverFixtureNote,
  TOOLTIP_EXAMPLES,
  tooltipFixtureNote,
} from "@spin/preset/rules/primitives/popover.examples.ts";
import {
  PROGRESS_EXAMPLES,
  progressFixtureNote,
} from "@spin/preset/rules/primitives/progress.examples.ts";
import {
  RANGE_EXAMPLES,
  rangeFixtureNote,
} from "@spin/preset/rules/primitives/range.examples.ts";
import {
  RATING_EXAMPLES,
  ratingFixtureNote,
} from "@spin/preset/rules/primitives/rating.examples.ts";
import {
  PROSE_DOC_EXAMPLES,
  proseFixtureNote,
  TYPOGRAPHY_EXAMPLES,
  typographyFixtureNote,
} from "@spin/preset/rules/primitives/prose.examples.ts";
import {
  RADIO_EXAMPLES,
  radioFixtureNote,
} from "@spin/preset/rules/primitives/radio.examples.ts";
import {
  TABLE_EXAMPLES,
  tableFixtureNote,
} from "@spin/preset/rules/primitives/table.examples.ts";
import {
  TABS_EXAMPLES,
  tabsFixtureNote,
} from "@spin/preset/rules/primitives/tabs.examples.ts";

export interface PrimitiveExample {
  readonly name: string;
  readonly html: string;
}

export interface PrimitivePage {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly note: string;
  readonly examples: readonly PrimitiveExample[];
  readonly onLoad?: string;
}

/**
 * Every primitive page, sourced from the package: examples live beside the
 * rule that styles them. No adapter, no intermediary — the app imports what
 * the package owns.
 */
export const PRIMITIVES: readonly PrimitivePage[] = [
  {
    id: "alert",
    title: "Alert",
    kind: "rule",
    note: alertFixtureNote,
    examples: [...ALERT_EXAMPLES],
  },
  {
    id: "badge",
    title: "Badge",
    kind: "rule",
    note: badgeFixtureNote,
    examples: [...BADGE_EXAMPLES],
  },
  {
    id: "button",
    title: "Button",
    kind: "rule",
    note: buttonFixtureNote,
    examples: [...BUTTON_EXAMPLES],
  },
  {
    id: "card",
    title: "Card",
    kind: "rule",
    note: cardFixtureNote,
    examples: [...CARD_EXAMPLES],
  },
  {
    id: "avatar",
    title: "Avatar",
    kind: "rule",
    note: avatarFixtureNote,
    examples: [...AVATAR_EXAMPLES],
  },
  {
    id: "checkbox",
    title: "Checkbox",
    kind: "rule",
    note: controlFixtureNote,
    onLoad:
      "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
    examples: [...CHECKBOX_EXAMPLES],
  },
  {
    id: "radio",
    title: "Radio",
    kind: "rule",
    note: radioFixtureNote,
    examples: [...RADIO_EXAMPLES],
  },
  {
    id: "switch",
    title: "Switch",
    kind: "rule",
    note: switchFixtureNote,
    onLoad:
      "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
    examples: [...SWITCH_EXAMPLES],
  },
  {
    id: "input",
    title: "Input",
    kind: "rule",
    note: fieldFixtureNote,
    examples: [...INPUT_EXAMPLES],
  },
  {
    id: "select",
    title: "Select",
    kind: "rule",
    note: selectFixtureNote,
    examples: [...SELECT_EXAMPLES],
  },
  {
    id: "textarea",
    title: "Textarea",
    kind: "rule",
    note: textareaFixtureNote,
    examples: [...TEXTAREA_EXAMPLES],
  },
  {
    id: "table",
    title: "Table",
    kind: "rule",
    note: tableFixtureNote,
    examples: [...TABLE_EXAMPLES],
  },
  {
    id: "tabs",
    title: "Tabs",
    kind: "rule",
    note: tabsFixtureNote,
    examples: [...TABS_EXAMPLES],
  },
  {
    id: "dialog",
    title: "Dialog",
    kind: "rule",
    note: dialogFixtureNote,
    onLoad:
      "document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open)?.showModal()));",
    examples: [...DIALOG_EXAMPLES],
  },
  {
    id: "popover",
    title: "Popover",
    kind: "rule",
    note: popoverFixtureNote,
    examples: [...POPOVER_SURFACE_EXAMPLES],
  },
  {
    id: "tooltip",
    title: "Tooltip",
    kind: "rule",
    note: tooltipFixtureNote,
    examples: [...TOOLTIP_EXAMPLES],
  },
  {
    id: "meter",
    title: "Meter",
    kind: "rule",
    note: meterFixtureNote,
    examples: [...METER_EXAMPLES],
  },
  {
    id: "range",
    title: "Range",
    kind: "rule",
    note: rangeFixtureNote,
    examples: [...RANGE_EXAMPLES],
  },
  {
    id: "rating",
    title: "Rating",
    kind: "rule",
    note: ratingFixtureNote,
    examples: [...RATING_EXAMPLES],
  },
  {
    id: "progress",
    title: "Progress",
    kind: "rule",
    note: progressFixtureNote,
    examples: [...PROGRESS_EXAMPLES],
  },
  {
    id: "group",
    title: "Group",
    kind: "rule",
    note: groupFixtureNote,
    examples: [...GROUP_EXAMPLES],
  },
  {
    id: "divider",
    title: "Divider",
    kind: "rule",
    note: hrFixtureNote,
    examples: [...HR_EXAMPLES],
  },
  {
    id: "kbd",
    title: "Keycap",
    kind: "rule",
    note: kbdFixtureNote,
    examples: [...KBD_EXAMPLES],
  },
  {
    id: "stat",
    title: "Stat",
    kind: "rule",
    note: statFixtureNote,
    examples: [...STAT_EXAMPLES],
  },
  {
    id: "typography",
    title: "Typography",
    kind: "rule",
    note: typographyFixtureNote,
    examples: [...TYPOGRAPHY_EXAMPLES],
  },
  {
    id: "prose",
    title: "Prose",
    kind: "rule",
    note: proseFixtureNote,
    examples: [...PROSE_DOC_EXAMPLES],
  },
  {
    id: "label",
    title: "Label",
    kind: "alias",
    note: labelFixtureNote,
    examples: [...LABEL_EXAMPLES],
  },
  {
    id: "fieldset",
    title: "Fieldset & legend",
    kind: "alias",
    note: fieldsetFixtureNote,
    examples: [...FIELDSET_EXAMPLES],
  },
  {
    id: "icon",
    title: "Icon",
    kind: "rule",
    note: iconFixtureNote,
    examples: [...ICON_EXAMPLES],
  },
  {
    id: "details",
    title: "Details",
    kind: "rule",
    note: detailsFixtureNote,
    examples: [...DETAILS_EXAMPLES],
  },
];
