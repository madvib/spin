import {
  ALERT_EXAMPLES,
  alertFixtureNote,
} from "@spin/preset/rules/primitives/alert.examples.ts";
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
  CONTROL_EXAMPLES,
  controlFixtureNote,
} from "@spin/preset/rules/primitives/control.examples.ts";
import {
  DETAILS_EXAMPLES,
  detailsFixtureNote,
} from "@spin/preset/rules/primitives/details.examples.ts";
import {
  DIALOG_EXAMPLES,
  dialogFixtureNote,
} from "@spin/preset/rules/primitives/dialog.examples.ts";
import {
  FIELD_EXAMPLES,
  fieldFixtureNote,
} from "@spin/preset/rules/primitives/field.examples.ts";
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
  POPOVER_EXAMPLES,
  popoverFixtureNote,
} from "@spin/preset/rules/primitives/popover.examples.ts";
import {
  PROGRESS_EXAMPLES,
  progressFixtureNote,
} from "@spin/preset/rules/primitives/progress.examples.ts";
import {
  PROSE_EXAMPLES,
  proseFixtureNote,
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
    id: "checkbox",
    title: "Checkbox & switch",
    kind: "rule",
    note: controlFixtureNote,
    onLoad:
      "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
    examples: [...CONTROL_EXAMPLES],
  },
  {
    id: "radio",
    title: "Radio",
    kind: "rule",
    note: radioFixtureNote,
    examples: [...RADIO_EXAMPLES],
  },
  {
    id: "field",
    title: "Field",
    kind: "rule",
    note: fieldFixtureNote,
    examples: [...FIELD_EXAMPLES],
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
    title: "Popover & tooltip",
    kind: "rule",
    note: popoverFixtureNote,
    examples: [...POPOVER_EXAMPLES],
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
    id: "prose",
    title: "Prose",
    kind: "rule",
    note: proseFixtureNote,
    examples: [...PROSE_EXAMPLES],
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
