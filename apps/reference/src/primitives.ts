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
    onLoad:
      "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
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
    onLoad:
      "document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.open)?.showModal()));",
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
    onLoad:
      "document.querySelectorAll('[data-mixed]').forEach((e) => e.indeterminate = true);",
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
 * The index: every primitive filed in exactly one family, each with the one
 * line the landing page has room for. The fixture note is a paragraph; a row
 * in a list of thirty-four is a sentence fragment.
 *
 * A primitive in no family would vanish from the index, and a family naming a
 * primitive that does not exist would be a dead row, so both are checked here
 * rather than discovered by a reader.
 */
export interface PrimitiveFamily {
  readonly title: string;
  readonly blurb: string;
  readonly members: readonly { readonly id: string; readonly note: string }[];
}

export const FAMILIES: readonly PrimitiveFamily[] = [
  {
    title: "Forms",
    blurb:
      "Controls a form is made of. The tag is the control; the state is an attribute.",
    members: [
      {
        id: "button",
        note: "The tag is the control; variants change the tone.",
      },
      {
        id: "checkbox",
        note: "Three states, and indeterminate is data-mixed.",
      },
      { id: "radio", note: "One choice per group, sharing a name." },
      { id: "switch", note: "A checkbox wearing a track instead of a box." },
      {
        id: "input",
        note: "The box the base owns; aria-invalid states validity.",
      },
      { id: "select", note: "Drawn by us, on the box a text field takes." },
      { id: "textarea", note: "Wraps, resizes, and keeps a one-row minimum." },
      { id: "range", note: "A slider: track and thumb are pseudo-elements." },
      { id: "rating", note: "Five radios read as stars." },
      { id: "meter", note: "A gauge over a range the platform classifies." },
      { id: "group", note: "Adjacent controls merged into one object." },
      {
        id: "label",
        note: "Names the control it wraps, and inherits its type.",
      },
      { id: "fieldset", note: "A named group that disables at once." },
      { id: "join", note: "Shared edges, one seam, geometry only." },
    ],
  },
  {
    title: "Surfaces",
    blurb: "Layers that sit above the page, each a card in a different place.",
    members: [
      { id: "card", note: "Eight parts, each its own tag; sizes are classes." },
      { id: "dialog", note: "A native modal; the platform traps the focus." },
      { id: "popover", note: "The top layer with no script at all." },
      { id: "tooltip", note: "A popover in a smaller box, on hover or focus." },
    ],
  },
  {
    title: "Navigation",
    blurb: "Moving through a document, and showing what is open.",
    members: [
      { id: "tabs", note: "Radios and :checked, with no JavaScript." },
      { id: "details", note: "A disclosure; open is the state." },
      { id: "breadcrumbs", note: "A trail whose last step is aria-current." },
    ],
  },
  {
    title: "Feedback",
    blurb: "What the page says back: status, load, and the number itself.",
    members: [
      {
        id: "alert",
        note: "A tone on the surface; role takes the heavier edge.",
      },
      { id: "progress", note: "A real value, and a sweep when indeterminate." },
      { id: "skeleton", note: "A placeholder that pulses, no JavaScript." },
      { id: "stat", note: "A labelled number: title, value, description." },
      { id: "badge", note: "The smallest component: a tag spending a tone." },
    ],
  },
  {
    title: "Content",
    blurb: "Document structure, stated by tags rather than by classes.",
    members: [
      { id: "typography", note: "One ladder of heading sizes and weights." },
      { id: "prose", note: "An article states nothing; the tags carry it." },
      { id: "divider", note: "A rule drawn from the border token." },
      { id: "kbd", note: "What to press, not what was printed." },
      { id: "table", note: "A document, not a spreadsheet; sticky header." },
      {
        id: "icon",
        note: "Glyph sizes in em, so they scale with the control.",
      },
      { id: "avatar", note: "A face in a square, cropped to fill." },
      {
        id: "avatar-group",
        note: "Faces pulled back a third so they overlap.",
      },
    ],
  },
];

const FILED = FAMILIES.flatMap((f) => f.members.map((m) => m.id));
const seen: Record<string, true> = {};
for (const id of FILED) {
  if (seen[id] === true) {
    throw new Error(`FAMILIES: ${id} is filed in more than one family`);
  }
  seen[id] = true;
}
if (FILED.length !== PRIMITIVES.length) {
  throw new Error(
    `FAMILIES: ${FILED.length} of ${PRIMITIVES.length} primitives are filed`,
  );
}
