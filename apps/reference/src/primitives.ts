import {
  ALERT_EXAMPLES,
  alertFixtureNote,
} from "@spin/preset/rules/primitives/alert.examples.ts";
import {
  AVATAR_GROUP_EXAMPLES,
  avatarGroupFixtureNote,
} from "@spin/preset/rules/primitives/avatar-group.examples.ts";
import {
  AVATAR_EXAMPLES,
  avatarFixtureNote,
} from "@spin/preset/rules/primitives/avatar.examples.ts";
import {
  BADGE_EXAMPLES,
  badgeFixtureNote,
} from "@spin/preset/rules/primitives/badge.examples.ts";
import {
  BREADCRUMBS_EXAMPLES,
  breadcrumbsFixtureNote,
} from "@spin/preset/rules/primitives/breadcrumbs.examples.ts";
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
  indeterminateOnLoad,
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
  MODE_EXAMPLES,
  modeFixtureNote,
} from "@spin/preset/rules/primitives/mode.examples.ts";
import {
  DIALOG_EXAMPLES,
  dialogFixtureNote,
  dialogOnLoad,
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
  SKELETON_EXAMPLES,
  skeletonFixtureNote,
} from "@spin/preset/rules/primitives/skeleton.examples.ts";
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
  JOIN_EXAMPLES,
  joinFixtureNote,
} from "@spin/preset/rules/primitives/join.examples.ts";
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

/**
 * The rail's groups, named the way a reader arrives looking for them.
 *
 * A letter bucket was a filing convention, not a way to find anything: people
 * look for the control they want — something to type into, something to
 * click — not for the first letter of its name. Each group is what the thing
 * is FOR, and a component sits in the group whose purpose it serves.
 */
export const CATEGORIES: readonly {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
}[] = [
  {
    id: "actions",
    label: "Actions",
    members: ["button", "breadcrumbs", "join", "kbd"],
  },
  {
    id: "inputs",
    label: "Inputs",
    members: [
      "checkbox",
      "radio",
      "switch",
      "input",
      "select",
      "textarea",
      "range",
      "rating",
      "meter",
      "label",
    ],
  },
  {
    id: "containers",
    label: "Containers & layout",
    members: [
      "card",
      "dialog",
      "details",
      "popover",
      "group",
      "fieldset",
      "divider",
    ],
  },
  {
    id: "display",
    label: "Display",
    members: ["table", "tabs", "stat", "avatar", "avatar-group"],
  },
  {
    id: "feedback",
    label: "Feedback & status",
    members: ["alert", "badge", "progress", "skeleton", "tooltip"],
  },
  {
    id: "typography",
    label: "Typography",
    members: ["prose", "typography", "icon"],
  },
];

export const PRIMITIVES: readonly PrimitivePage[] = [
  {
    id: "alert",
    title: "Alert",
    kind: "rule",
    note: alertFixtureNote,
    examples: [...ALERT_EXAMPLES],
  },
  {
    id: "avatar",
    title: "Avatar",
    kind: "rule",
    note: avatarFixtureNote,
    examples: [...AVATAR_EXAMPLES],
  },
  {
    id: "avatar-group",
    title: "Avatar group",
    kind: "rule",
    note: avatarGroupFixtureNote,
    examples: [...AVATAR_GROUP_EXAMPLES],
  },
  {
    id: "badge",
    title: "Badge",
    kind: "rule",
    note: badgeFixtureNote,
    examples: [...BADGE_EXAMPLES],
  },
  {
    id: "breadcrumbs",
    title: "Breadcrumbs",
    kind: "rule",
    note: breadcrumbsFixtureNote,
    examples: [...BREADCRUMBS_EXAMPLES],
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
    title: "Checkbox",
    kind: "rule",
    note: controlFixtureNote,
    onLoad: indeterminateOnLoad,
    examples: [...CHECKBOX_EXAMPLES],
  },
  {
    id: "details",
    title: "Details",
    kind: "rule",
    note: detailsFixtureNote,
    examples: [...DETAILS_EXAMPLES],
  },
  {
    id: "dialog",
    title: "Dialog",
    kind: "rule",
    note: dialogFixtureNote,
    onLoad: dialogOnLoad,
    examples: [...DIALOG_EXAMPLES],
  },
  {
    id: "divider",
    title: "Divider",
    kind: "rule",
    note: hrFixtureNote,
    examples: [...HR_EXAMPLES],
  },
  {
    id: "fieldset",
    title: "Fieldset & legend",
    kind: "alias",
    note: fieldsetFixtureNote,
    examples: [...FIELDSET_EXAMPLES],
  },
  {
    id: "group",
    title: "Group",
    kind: "rule",
    note: groupFixtureNote,
    examples: [...GROUP_EXAMPLES],
  },
  {
    id: "icon",
    title: "Icon",
    kind: "rule",
    note: iconFixtureNote,
    examples: [...ICON_EXAMPLES],
  },
  {
    id: "input",
    title: "Input",
    kind: "rule",
    note: fieldFixtureNote,
    examples: [...INPUT_EXAMPLES],
  },
  {
    id: "join",
    title: "Join",
    kind: "rule",
    note: joinFixtureNote,
    examples: [...JOIN_EXAMPLES],
  },
  {
    id: "kbd",
    title: "Keycap",
    kind: "rule",
    note: kbdFixtureNote,
    examples: [...KBD_EXAMPLES],
  },
  {
    id: "label",
    title: "Label",
    kind: "alias",
    note: labelFixtureNote,
    examples: [...LABEL_EXAMPLES],
  },
  {
    id: "meter",
    title: "Meter",
    kind: "rule",
    note: meterFixtureNote,
    examples: [...METER_EXAMPLES],
  },
  {
    id: "mode",
    title: "Mode switch",
    kind: "rule",
    note: modeFixtureNote,
    examples: [...MODE_EXAMPLES],
  },
  {
    id: "popover",
    title: "Popover",
    kind: "rule",
    note: popoverFixtureNote,
    examples: [...POPOVER_SURFACE_EXAMPLES],
  },
  {
    id: "progress",
    title: "Progress",
    kind: "rule",
    note: progressFixtureNote,
    examples: [...PROGRESS_EXAMPLES],
  },
  {
    id: "prose",
    title: "Prose",
    kind: "rule",
    note: proseFixtureNote,
    examples: [...PROSE_DOC_EXAMPLES],
  },
  {
    id: "radio",
    title: "Radio",
    kind: "rule",
    note: radioFixtureNote,
    examples: [...RADIO_EXAMPLES],
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
    id: "select",
    title: "Select",
    kind: "rule",
    note: selectFixtureNote,
    examples: [...SELECT_EXAMPLES],
  },
  {
    id: "skeleton",
    title: "Skeleton",
    kind: "rule",
    note: skeletonFixtureNote,
    examples: [...SKELETON_EXAMPLES],
  },
  {
    id: "stat",
    title: "Stat",
    kind: "rule",
    note: statFixtureNote,
    examples: [...STAT_EXAMPLES],
  },
  {
    id: "switch",
    title: "Switch",
    kind: "rule",
    note: switchFixtureNote,
    onLoad: indeterminateOnLoad,
    examples: [...SWITCH_EXAMPLES],
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
    id: "textarea",
    title: "Textarea",
    kind: "rule",
    note: textareaFixtureNote,
    examples: [...TEXTAREA_EXAMPLES],
  },
  {
    id: "tooltip",
    title: "Tooltip",
    kind: "rule",
    note: tooltipFixtureNote,
    examples: [...TOOLTIP_EXAMPLES],
  },
  {
    id: "typography",
    title: "Typography",
    kind: "rule",
    note: typographyFixtureNote,
    examples: [...TYPOGRAPHY_EXAMPLES],
  },
];

/**
 * The glyph each primitive is known by, in the rail and the page header.
 *
 * The values are the whole class the icon preset generates, name included: a
 * name interpolated into `i-lucide-${name}` at runtime reaches no rule, and
 * the scanner only ever sees what is written down.
 */
export const PRIMITIVE_ICONS: Readonly<Record<string, string>> = {
  alert: "i-lucide-triangle-alert",
  avatar: "i-lucide-circle-user",
  "avatar-group": "i-lucide-users",
  badge: "i-lucide-badge-check",
  breadcrumbs: "i-lucide-chevron-right",
  button: "i-lucide-mouse-pointer-click",
  card: "i-lucide-square",
  checkbox: "i-lucide-square-check",
  details: "i-lucide-list",
  dialog: "i-lucide-message-square",
  divider: "i-lucide-minus",
  fieldset: "i-lucide-boxes",
  group: "i-lucide-group",
  icon: "i-lucide-image",
  input: "i-lucide-text-cursor-input",
  join: "i-lucide-rows-3",
  kbd: "i-lucide-keyboard",
  label: "i-lucide-tag",
  meter: "i-lucide-gauge",
  mode: "i-lucide-sun-moon",
  popover: "i-lucide-message-circle",
  progress: "i-lucide-loader",
  prose: "i-lucide-whole-word",
  radio: "i-lucide-circle-dot",
  range: "i-lucide-slash",
  rating: "i-lucide-star",
  select: "i-lucide-chevron-down",
  skeleton: "i-lucide-square-dashed",
  stat: "i-lucide-sigma",
  switch: "i-lucide-toggle-right",
  table: "i-lucide-table-2",
  tabs: "i-lucide-layout-list",
  textarea: "i-lucide-text-cursor",
  tooltip: "i-lucide-message-circle-off",
  typography: "i-lucide-type",
};

// A row the rail cannot draw a glyph for is a row with a hole in it — checked
// here, where the map and the pages it serves are both in view.
for (const page of PRIMITIVES) {
  if (PRIMITIVE_ICONS[page.id] === undefined) {
    throw new Error(`PRIMITIVE_ICONS: ${page.id} has no icon`);
  }
}
