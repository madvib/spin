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

import type { ClassDoc, FixtureExample } from "./example.ts";

import { ALERT_CLASSES, ALERT_EXAMPLES, alertFixtureNote } from "./alert.examples.ts";
import { BADGE_CLASSES, BADGE_EXAMPLES, badgeFixtureNote } from "./badge.examples.ts";
import {
  BREADCRUMBS_CLASSES,
  BREADCRUMBS_EXAMPLES,
  breadcrumbsFixtureNote,
} from "./breadcrumbs.examples.ts";
import {
  BUTTON_CLASSES,
  BUTTON_EXAMPLES,
  buttonFixtureNote,
  buttonOnLoad,
} from "./button.examples.ts";
import { CARD_CLASSES, CARD_EXAMPLES, cardFixtureNote } from "./card.examples.ts";
import {
  CHECKBOX_CLASSES,
  CHECKBOX_EXAMPLES,
  controlFixtureNote,
  indeterminateOnLoad,
  SWITCH_CLASSES,
  SWITCH_EXAMPLES,
  switchFixtureNote,
} from "./control.examples.ts";
import {
  DETAILS_CLASSES,
  DETAILS_EXAMPLES,
  detailsFixtureNote,
} from "./details.examples.ts";
import {
  DIALOG_CLASSES,
  DIALOG_EXAMPLES,
  dialogFixtureNote,
  dialogOnLoad,
} from "./dialog.examples.ts";
import {
  fieldFixtureNote,
  INPUT_CLASSES,
  INPUT_EXAMPLES,
  TEXTAREA_CLASSES,
  TEXTAREA_EXAMPLES,
  textareaFixtureNote,
} from "./field.examples.ts";
import {
  FIELDSET_CLASSES,
  FIELDSET_EXAMPLES,
  fieldsetFixtureNote,
} from "./fieldset.examples.ts";
import { HR_CLASSES, HR_EXAMPLES, hrFixtureNote } from "./hr.examples.ts";
import { ICON_CLASSES, ICON_EXAMPLES, iconFixtureNote } from "./icon.examples.ts";
import { JOIN_CLASSES, JOIN_EXAMPLES, joinFixtureNote } from "./join.examples.ts";
import { KBD_CLASSES, KBD_EXAMPLES, kbdFixtureNote } from "./kbd.examples.ts";
import { LABEL_CLASSES, LABEL_EXAMPLES, labelFixtureNote } from "./label.examples.ts";
import { METER_CLASSES, METER_EXAMPLES, meterFixtureNote } from "./meter.examples.ts";
import { PANEL_CLASSES, PANEL_EXAMPLES, panelFixtureNote } from "./panel.examples.ts";
import { PROGRESS_CLASSES, PROGRESS_EXAMPLES, progressFixtureNote } from "./progress.examples.ts";
import { RADIO_CLASSES, RADIO_EXAMPLES, radioFixtureNote } from "./radio.examples.ts";
import {
  PROSE_CLASSES,
  PROSE_DOC_EXAMPLES,
  proseFixtureNote,
  TYPOGRAPHY_CLASSES,
  TYPOGRAPHY_EXAMPLES,
  typographyFixtureNote,
} from "./prose.examples.ts";
import { SKELETON_CLASSES, SKELETON_EXAMPLES, skeletonFixtureNote } from "./skeleton.examples.ts";
import { STAT_CLASSES, STAT_EXAMPLES, statFixtureNote } from "./stat.examples.ts";
import {
  SWATCH_CLASSES,
  SWATCH_EXAMPLES,
  swatchFixtureNote,
} from "./swatch.examples.ts";
import {
  TOOLTIP_CLASSES,
  TOOLTIP_EXAMPLES,
  tooltipFixtureNote,
} from "./tooltip.examples.ts";
import { TABLE_CLASSES, TABLE_EXAMPLES, tableFixtureNote } from "./table.examples.ts";

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
  /** Structured class & tag reference rows for the component header table. */
  readonly classes?: readonly ClassDoc[];
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
  alert: { id: "alert", note: alertFixtureNote, classes: ALERT_CLASSES, rows: ALERT_EXAMPLES },
  badge: { id: "badge", note: badgeFixtureNote, classes: BADGE_CLASSES, rows: BADGE_EXAMPLES },
  breadcrumbs: {
    id: "breadcrumbs",
    note: breadcrumbsFixtureNote,
    classes: BREADCRUMBS_CLASSES,
    rows: BREADCRUMBS_EXAMPLES,
  },
  button: {
    id: "button",
    note: buttonFixtureNote,
    onLoad: buttonOnLoad,
    classes: BUTTON_CLASSES,
    rows: BUTTON_EXAMPLES,
  },
  card: { id: "card", note: cardFixtureNote, classes: CARD_CLASSES, rows: CARD_EXAMPLES },
  checkbox: {
    id: "checkbox",
    note: controlFixtureNote,
    onLoad: indeterminateOnLoad,
    classes: CHECKBOX_CLASSES,
    rows: CHECKBOX_EXAMPLES,
  },
  details: {
    id: "details",
    note: detailsFixtureNote,
    classes: DETAILS_CLASSES,
    rows: DETAILS_EXAMPLES,
  },
  dialog: {
    id: "dialog",
    note: dialogFixtureNote,
    onLoad: dialogOnLoad,
    classes: DIALOG_CLASSES,
    rows: DIALOG_EXAMPLES,
  },
  // Keyed `hr`, which is the manifest's name and the element's tag. It was
  // filed as `divider`, so the studio's lookup missed and the rule never
  // appeared in the specimen wall.
  hr: {
    id: "hr",
    note: hrFixtureNote,
    classes: HR_CLASSES,
    rows: HR_EXAMPLES,
  },
  fieldset: {
    id: "fieldset",
    note: fieldsetFixtureNote,
    classes: FIELDSET_CLASSES,
    rows: FIELDSET_EXAMPLES,
  },
  icon: { id: "icon", note: iconFixtureNote, classes: ICON_CLASSES, rows: ICON_EXAMPLES },
  input: { id: "input", note: fieldFixtureNote, classes: INPUT_CLASSES, rows: INPUT_EXAMPLES },
  join: { id: "join", note: joinFixtureNote, classes: JOIN_CLASSES, rows: JOIN_EXAMPLES },
  kbd: { id: "kbd", note: kbdFixtureNote, classes: KBD_CLASSES, rows: KBD_EXAMPLES },
  label: { id: "label", note: labelFixtureNote, classes: LABEL_CLASSES, rows: LABEL_EXAMPLES },
  meter: { id: "meter", note: meterFixtureNote, classes: METER_CLASSES, rows: METER_EXAMPLES },
  panel: { id: "panel", note: panelFixtureNote, classes: PANEL_CLASSES, rows: PANEL_EXAMPLES },
  progress: {
    id: "progress",
    note: progressFixtureNote,
    classes: PROGRESS_CLASSES,
    rows: PROGRESS_EXAMPLES,
  },
  prose: { id: "prose", note: proseFixtureNote, classes: PROSE_CLASSES, rows: PROSE_DOC_EXAMPLES },
  radio: { id: "radio", note: radioFixtureNote, classes: RADIO_CLASSES, rows: RADIO_EXAMPLES },
  skeleton: {
    id: "skeleton",
    note: skeletonFixtureNote,
    classes: SKELETON_CLASSES,
    rows: SKELETON_EXAMPLES,
  },
  stat: {
    id: "stat",
    note: statFixtureNote,
    classes: STAT_CLASSES,
    rows: STAT_EXAMPLES,
  },
  switch: {
    id: "switch",
    note: switchFixtureNote,
    onLoad: indeterminateOnLoad,
    classes: SWITCH_CLASSES,
    rows: SWITCH_EXAMPLES,
  },
  swatch: {
    id: "swatch",
    note: swatchFixtureNote,
    classes: SWATCH_CLASSES,
    rows: SWATCH_EXAMPLES,
  },
  tooltip: {
    id: "tooltip",
    note: tooltipFixtureNote,
    classes: TOOLTIP_CLASSES,
    rows: TOOLTIP_EXAMPLES,
  },
  table: {
    id: "table",
    note: tableFixtureNote,
    classes: TABLE_CLASSES,
    rows: TABLE_EXAMPLES,
  },
  textarea: {
    id: "textarea",
    note: textareaFixtureNote,
    classes: TEXTAREA_CLASSES,
    rows: TEXTAREA_EXAMPLES,
  },
  typography: {
    id: "typography",
    note: typographyFixtureNote,
    classes: TYPOGRAPHY_CLASSES,
    rows: TYPOGRAPHY_EXAMPLES,
  },
};

/** The examples for one component, or `undefined` when it has none. */
export function examplesFor(id: string): ComponentExamples | undefined {
  return componentExamples[id];
}
