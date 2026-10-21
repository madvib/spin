/**
 * Every component's examples, in one place.
 *
 * The modules that hold them are the source of truth — one file per component,
 * beside its rule — and this registry is the index a consumer reads. The
 * reference app, the studio, and the RPC surface all want "the examples for
 * X" and none of them should be importing a module path per component: that
 * was thirty exports whose only purpose was to be reachable, and every
 * consumer paid for it in its own import list.
 *
 * A `FixtureExample` is what an author actually writes: a label and the
 * markup. `note` is the one sentence that names the contract the rows
 * demonstrate.
 */

import type { FixtureExample } from "./example.ts";

import { ALERT_EXAMPLES, alertFixtureNote } from "./alert.examples.ts";
import { AVATAR_EXAMPLES, avatarFixtureNote } from "./avatar.examples.ts";
import {
  AVATAR_GROUP_EXAMPLES,
  avatarGroupFixtureNote,
} from "./avatar-group.examples.ts";
import { BADGE_EXAMPLES, badgeFixtureNote } from "./badge.examples.ts";
import {
  BREADCRUMBS_EXAMPLES,
  breadcrumbsFixtureNote,
} from "./breadcrumbs.examples.ts";
import { BUTTON_EXAMPLES, buttonFixtureNote } from "./button.examples.ts";
import { CARD_EXAMPLES, cardFixtureNote } from "./card.examples.ts";
import {
  CHECKBOX_EXAMPLES,
  controlFixtureNote,
  indeterminateOnLoad,
  SWITCH_EXAMPLES,
  switchFixtureNote,
} from "./control.examples.ts";
import { DETAILS_EXAMPLES, detailsFixtureNote } from "./details.examples.ts";
import {
  DIALOG_EXAMPLES,
  dialogFixtureNote,
  dialogOnLoad,
} from "./dialog.examples.ts";
import {
  fieldFixtureNote,
  INPUT_EXAMPLES,
  SELECT_EXAMPLES,
  selectFixtureNote,
  TEXTAREA_EXAMPLES,
  textareaFixtureNote,
} from "./field.examples.ts";
import { FIELDSET_EXAMPLES, fieldsetFixtureNote } from "./fieldset.examples.ts";
import { GROUP_EXAMPLES, groupFixtureNote } from "./group.examples.ts";
import { HR_EXAMPLES, hrFixtureNote } from "./hr.examples.ts";
import { ICON_EXAMPLES, iconFixtureNote } from "./icon.examples.ts";
import { JOIN_EXAMPLES, joinFixtureNote } from "./join.examples.ts";
import { KBD_EXAMPLES, kbdFixtureNote } from "./kbd.examples.ts";
import { LABEL_EXAMPLES, labelFixtureNote } from "./label.examples.ts";
import { METER_EXAMPLES, meterFixtureNote } from "./meter.examples.ts";
import { MODE_EXAMPLES, modeFixtureNote } from "./mode.examples.ts";
import {
  POPOVER_SURFACE_EXAMPLES,
  popoverFixtureNote,
  TOOLTIP_EXAMPLES,
  tooltipFixtureNote,
} from "./popover.examples.ts";
import { PROGRESS_EXAMPLES, progressFixtureNote } from "./progress.examples.ts";
import {
  PROSE_DOC_EXAMPLES,
  proseFixtureNote,
  TYPOGRAPHY_EXAMPLES,
  typographyFixtureNote,
} from "./prose.examples.ts";
import { RADIO_EXAMPLES, radioFixtureNote } from "./radio.examples.ts";
import { RANGE_EXAMPLES, rangeFixtureNote } from "./range.examples.ts";
import { RATING_EXAMPLES, ratingFixtureNote } from "./rating.examples.ts";
import { SKELETON_EXAMPLES, skeletonFixtureNote } from "./skeleton.examples.ts";
import { STAT_EXAMPLES, statFixtureNote } from "./stat.examples.ts";
import { TABLE_EXAMPLES, tableFixtureNote } from "./table.examples.ts";

/** What a component's examples are, as a value any consumer can render. */
export interface ComponentExamples {
  /** The component's id, as the manifest names it. */
  readonly id: string;
  /** The sentence naming the contract the rows demonstrate. */
  readonly note: string;
  /**
   * The line that finishes an example markup alone cannot finish.
   *
   * `data-mixed` and `data-open` name DOM properties, so a consumer who copies
   * a row and pastes it gets a specimen that lies unless they also know to
   * run this. It is scoped to the element that renders the examples, never the
   * document.
   */
  readonly onLoad?: string;
  /** The rows, in authored order. */
  readonly rows: readonly FixtureExample[];
}

/**
 * Every component's examples, keyed by id.
 *
 * A component with no examples module — `a11y` is a utility, not a primitive
 * — is absent rather than present-and-empty, so a consumer that renders an
 * empty section can tell "none exist" from "none loaded".
 */
export const componentExamples: Readonly<Record<string, ComponentExamples>> = {
  alert: { id: "alert", note: alertFixtureNote, rows: ALERT_EXAMPLES },
  avatar: { id: "avatar", note: avatarFixtureNote, rows: AVATAR_EXAMPLES },
  "avatar-group": {
    id: "avatar-group",
    note: avatarGroupFixtureNote,
    rows: AVATAR_GROUP_EXAMPLES,
  },
  badge: { id: "badge", note: badgeFixtureNote, rows: BADGE_EXAMPLES },
  breadcrumbs: {
    id: "breadcrumbs",
    note: breadcrumbsFixtureNote,
    rows: BREADCRUMBS_EXAMPLES,
  },
  button: { id: "button", note: buttonFixtureNote, rows: BUTTON_EXAMPLES },
  card: { id: "card", note: cardFixtureNote, rows: CARD_EXAMPLES },
  checkbox: {
    id: "checkbox",
    note: controlFixtureNote,
    onLoad: indeterminateOnLoad,
    rows: CHECKBOX_EXAMPLES,
  },
  details: {
    id: "details",
    note: detailsFixtureNote,
    rows: DETAILS_EXAMPLES,
  },
  dialog: {
    id: "dialog",
    note: dialogFixtureNote,
    onLoad: dialogOnLoad,
    rows: DIALOG_EXAMPLES,
  },
  // Keyed `hr`, which is the manifest's name and the element's tag. It was
  // filed as `divider`, so the studio's lookup missed and the rule never
  // appeared in the specimen wall.
  hr: { id: "hr", note: hrFixtureNote, rows: HR_EXAMPLES },
  fieldset: {
    id: "fieldset",
    note: fieldsetFixtureNote,
    rows: FIELDSET_EXAMPLES,
  },
  group: { id: "group", note: groupFixtureNote, rows: GROUP_EXAMPLES },
  icon: { id: "icon", note: iconFixtureNote, rows: ICON_EXAMPLES },
  input: { id: "input", note: fieldFixtureNote, rows: INPUT_EXAMPLES },
  join: { id: "join", note: joinFixtureNote, rows: JOIN_EXAMPLES },
  kbd: { id: "kbd", note: kbdFixtureNote, rows: KBD_EXAMPLES },
  label: { id: "label", note: labelFixtureNote, rows: LABEL_EXAMPLES },
  meter: { id: "meter", note: meterFixtureNote, rows: METER_EXAMPLES },
  mode: { id: "mode", note: modeFixtureNote, rows: MODE_EXAMPLES },
  popover: {
    id: "popover",
    note: popoverFixtureNote,
    rows: POPOVER_SURFACE_EXAMPLES,
  },
  progress: {
    id: "progress",
    note: progressFixtureNote,
    rows: PROGRESS_EXAMPLES,
  },
  prose: { id: "prose", note: proseFixtureNote, rows: PROSE_DOC_EXAMPLES },
  radio: { id: "radio", note: radioFixtureNote, rows: RADIO_EXAMPLES },
  range: { id: "range", note: rangeFixtureNote, rows: RANGE_EXAMPLES },
  rating: { id: "rating", note: ratingFixtureNote, rows: RATING_EXAMPLES },
  select: { id: "select", note: selectFixtureNote, rows: SELECT_EXAMPLES },
  skeleton: {
    id: "skeleton",
    note: skeletonFixtureNote,
    rows: SKELETON_EXAMPLES,
  },
  stat: { id: "stat", note: statFixtureNote, rows: STAT_EXAMPLES },
  switch: {
    id: "switch",
    note: switchFixtureNote,
    onLoad: indeterminateOnLoad,
    rows: SWITCH_EXAMPLES,
  },
  table: { id: "table", note: tableFixtureNote, rows: TABLE_EXAMPLES },
  textarea: {
    id: "textarea",
    note: textareaFixtureNote,
    rows: TEXTAREA_EXAMPLES,
  },
  tooltip: {
    id: "tooltip",
    note: tooltipFixtureNote,
    rows: TOOLTIP_EXAMPLES,
  },
  typography: {
    id: "typography",
    note: typographyFixtureNote,
    rows: TYPOGRAPHY_EXAMPLES,
  },
};

/** The examples for one component, or `undefined` when it has none. */
export function examplesFor(id: string): ComponentExamples | undefined {
  return componentExamples[id];
}
