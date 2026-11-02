/**
 * The component library's root export.
 *
 * Elements register through `elements.ts` (one import defines them all).
 * Machine-defs are the per-element seam files, exported here as the catalog:
 * each def is a component's public machine contract, and it is small — a
 * bridge factory, the commands, and the event map.
 *
 * The catalog is deliberately short: a machine earns its place only when the
 * component has distinct MODES with different legal events. Widgets whose
 * entire behavior is one mode of derived values — scroll geometry, image
 * load status, a continuous slider value, a page index — are signals and
 * actions, not machines, and the preset's primitives already own the
 * form-control widgets.
 */

export { asyncList } from "./async-list/async-list.presentation.ts";
export { modePicker } from "./mode-picker/mode-picker.presentation.ts";
export { themePicker } from "./theme-picker/theme-picker.presentation.ts";
export { combobox } from "./combobox/combobox.presentation.ts";
export { listbox } from "./listbox/listbox.presentation.ts";
export { colorPicker } from "./color-picker/color-picker.presentation.ts";
export { imageCropper } from "./image-cropper/image-cropper.presentation.ts";
export { signaturePad } from "./signature-pad/signature-pad.presentation.ts";
export { ratingGroup } from "./rating-group/rating-group.presentation.ts";
export { slider } from "./slider/slider.presentation.ts";
export { splitter } from "./splitter/splitter.presentation.ts";
export { steps } from "./steps/steps.presentation.ts";
export { pagination } from "./pagination/pagination.presentation.ts";
export { angleSlider } from "./angle-slider/angle-slider.presentation.ts";
export { toggleGroup } from "./toggle-group/toggle-group.presentation.ts";
export { avatar } from "./avatar/avatar.presentation.ts";
export { dateInput } from "./date-input/date-input.presentation.ts";
export { datePicker } from "./date-picker/date-picker.presentation.ts";
export { editable } from "./editable/editable.presentation.ts";
export { tour } from "./tour/tour.presentation.ts";
export { navigationMenu } from "./navigation-menu/navigation-menu.presentation.ts";
export { fileUpload } from "./file-upload/file-upload.presentation.ts";
export { floatingPanel } from "./floating-panel/floating-panel.presentation.ts";
export { hoverCard } from "./hover-card/hover-card.controller-def.ts";
export { hoverCardManifest } from "./hover-card/hover-card.controller-def.ts";
export { menu } from "./menu/menu.presentation.ts";
export { numberInput } from "./number-input/number-input.presentation.ts";
export { pinInput } from "./pin-input/pin-input.presentation.ts";
export { popover } from "./popover/popover.controller-def.ts";
export { popoverManifest } from "./popover/popover.controller-def.ts";
export {
  attachPopover,
  type PopoverApi,
} from "./popover/popover.controller-def.ts";
export { select } from "./select/select.presentation.ts";
export { tags } from "./tags-input/tags.presentation.ts";
export { timer } from "./timer/timer.presentation.ts";
export { tabs } from "./tabs/tabs.presentation.ts";
export { toast } from "./toast/toast.presentation.ts";
export { toc } from "./toc/toc.presentation.ts";
export { tooltip } from "./tooltip/tooltip.controller-def.ts";
export { tooltipManifest } from "./tooltip/tooltip.controller-def.ts";
export { treeView } from "./tree-view/tree-view.presentation.ts";

/** A purpose group for the machine rail: the shape every gallery reuses. */
export interface ComponentCategory {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
}

/**
 * The purpose groups for the machines, the same shape as the primitives'
 * CATEGORIES: a reader looks for the thing it does, not its name.
 */
export const COMPONENT_GROUPS: readonly ComponentCategory[] = [
  {
    id: "inputs",
    label: "Inputs",
    members: [
      "angle-slider",
      "color-picker",
      "date-input",
      "date-picker",
      "editable",
      "file-upload",
      "number-input",
      "pin-input",
      "rating-group",
      "slider",
      "tags-input",
      "toggle-group",
    ],
  },
  {
    id: "selectors",
    label: "Selection",
    members: [
      "cascade-select",
      "combobox",
      "listbox",
      "menu",
      "navigation-menu",
      "select",
      "tree-view",
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    members: ["mode-picker", "theme-picker", "toc"],
  },
  {
    id: "display",
    label: "Display",
    members: [
      "async-list",
      "avatar",
      "carousel",
      "pagination",
      "steps",
      "tabs",
      "timer",
      "tour",
    ],
  },
  {
    id: "overlays",
    label: "Overlays",
    members: ["floating-panel", "hover-card", "popover", "toast", "tooltip"],
  },
  { id: "layout", label: "Layout", members: ["splitter"] },
  { id: "media", label: "Media", members: ["image-cropper", "signature-pad"] },
];
/** A purpose group filing both tiers side by side: primitives beside the
 * machines that serve the same purpose, in the order a reader arrives in.
 * Anything the taxonomy does not name lands in "Other" rather than
 * vanishing: a rail that drops a component it was given is a rail lying
 * about the library. */
export const UNIFIED_COMPONENT_GROUPS: readonly ComponentCategory[] = [
  {
    id: "actions-navigation",
    label: "Actions & Navigation",
    members: [
      "button",
      "breadcrumbs",
      "join",
      "kbd",
      "component-mode-picker",
      "component-theme-picker",
      "component-navigation-menu",
      "component-menu",
      "component-pagination",
      "component-steps",
      "component-tabs",
      "component-toc",
    ],
  },
  {
    id: "inputs",
    label: "Inputs",
    members: [
      "checkbox",
      "radio",
      "switch",
      "meter",
      "label",
      "field",
      "component-angle-slider",
      "component-color-picker",
      "component-date-input",
      "component-date-picker",
      "component-editable",
      "component-file-upload",
      "component-number-input",
      "component-pin-input",
      "component-rating-group",
      "component-slider",
      "component-tags-input",
      "component-toggle-group",
    ],
  },
  {
    id: "selection",
    label: "Selection",
    members: [
      "component-cascade-select",
      "component-combobox",
      "component-listbox",
      "component-select",
      "component-tree-view",
    ],
  },
  {
    id: "overlays",
    label: "Overlays",
    members: [
      "dialog",
      "details",
      "tooltip",
      "component-floating-panel",
      "component-hover-card",
      "component-popover",
      "component-toast",
      "component-tooltip",
      "component-tour",
    ],
  },
  {
    id: "containers-layout",
    label: "Containers & Layout",
    members: ["card", "fieldset", "hr", "panel", "component-splitter"],
  },
  {
    id: "display-media",
    label: "Display & Media",
    members: [
      "table",
      "stat",
      "alert",
      "badge",
      "progress",
      "skeleton",
      "swatch",
      "component-async-list",
      "component-avatar",
      "component-carousel",
      "component-timer",
      "component-image-cropper",
      "component-signature-pad",
    ],
  },
  {
    id: "typography-icons",
    label: "Typography & Icons",
    members: ["prose", "icon"],
  },
];

 /**
/**
 * One glyph per machine, beside the groups that list them. Controllers
 * (tooltip, popover, hover-card) share the mapping — the rail looks
 * up by machine id, not by tier.
 */
export const COMPONENT_ICONS: Readonly<Record<string, string>> = {
  "angle-slider": "i-lucide-compass",
  "async-list": "i-lucide-list-filter",
  avatar: "i-lucide-circle-user",
  carousel: "i-lucide-gallery-horizontal",
  "cascade-select": "i-lucide-list-tree",
  "color-picker": "i-lucide-palette",
  combobox: "i-lucide-chevrons-up-down",
  "date-input": "i-lucide-calendar-days",
  "date-picker": "i-lucide-calendar",
  editable: "i-lucide-pencil",
  "file-upload": "i-lucide-upload",
  "floating-panel": "i-lucide-panel-top",
  "hover-card": "i-lucide-square-mouse-pointer",
  "image-cropper": "i-lucide-crop",
  listbox: "i-lucide-list",
  menu: "i-lucide-menu",
  "navigation-menu": "i-lucide-navigation",
  "number-input": "i-lucide-hash",
  "mode-picker": "i-lucide-sun-moon",
  "theme-picker": "i-lucide-palette",
  pagination: "i-lucide-chevrons-left-right",
  "pin-input": "i-lucide-key-round",
  popover: "i-lucide-message-circle",
  "rating-group": "i-lucide-star",
  select: "i-lucide-chevron-down",
  "signature-pad": "i-lucide-pen-line",
  slider: "i-lucide-sliders-horizontal",
  splitter: "i-lucide-columns-2",
  steps: "i-lucide-list-ordered",
  tabs: "i-lucide-layout-list",
  "tags-input": "i-lucide-tags",
  timer: "i-lucide-timer",
  toast: "i-lucide-bell",
  toc: "i-lucide-list-tree",
  "toggle-group": "i-lucide-toggle-left",
  tooltip: "i-lucide-message-circle-off",
  tour: "i-lucide-route",
  "tree-view": "i-lucide-folder-tree",
};

/**
 * Controllers: platform-backed glue, no machine. Everything else on the
 * rail runs a statechart and needs the runtime.
 */
export const CONTROLLERS: readonly string[] = [
  "tooltip",
  "popover",
  "hover-card",
];
