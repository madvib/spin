import type { JSX } from "solid-js";
import AsyncList from "./routes/async-list.tsx";
import Carousel from "./routes/carousel.tsx";
import Cascade from "./routes/cascade.tsx";
import Combobox from "./routes/combobox.tsx";
import Listbox from "./routes/listbox.tsx";
import DateInput from "./routes/date-input.tsx";
import DatePicker from "./routes/date-picker.tsx";
import Editable from "./routes/editable.tsx";
import HoverCard from "./routes/hover-card.tsx";
import FloatingPanel from "./routes/floating-panel.tsx";
import NavigationMenu from "./routes/navigation-menu.tsx";
import FileUpload from "./routes/file-upload.tsx";
import Menu from "./routes/menu.tsx";
import NumberInput from "./routes/number-input.tsx";
import PinInput from "./routes/pin-input.tsx";
import Popover from "./routes/popover.tsx";
import Select from "./routes/select.tsx";
import Tags from "./routes/tags.tsx";
import Timer from "./routes/timer.tsx";
import Tour from "./routes/tour.tsx";
import Toast from "./routes/toast.tsx";
import Tooltip from "./routes/tooltip.tsx";
import TreeView from "./routes/tree-view.tsx";

/** One component under test, plus the route that shows it. */
export interface Specimen {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly path: string;
  /** The nav group the component belongs to. */
  readonly group: string;
  readonly component: () => JSX.Element;
}

/**
 * The specimen table. Routes and index links both derive from this list, so a
 * component is added in one place and its URL is never typed twice.
 */
export const SPECIMENS: readonly Specimen[] = [
  {
    id: "listbox",
    title: "Listbox",
    blurb:
      "Single-state selection: focus defaults, arrow walk, typeahead, grouped options.",
    path: "/listbox",
    group: "Inputs",
    component: Listbox,
  },
  {
    id: "combobox",
    title: "Combobox",
    blurb:
      "Input plus listbox: filtering, inline autocomplete, trigger, grouped options.",
    path: "/combobox",
    group: "Inputs",
    component: Combobox,
  },
  {
    id: "number-input",
    title: "Number input",
    blurb: "Value, range, press-and-hold spin controls, and the scrubber drag.",
    path: "/number-input",
    group: "Inputs",
    component: NumberInput,
  },
  {
    id: "pin-input",
    title: "Pin input",
    blurb:
      "The one-time-code field: per-cell state, paste distribution, completion edge.",
    path: "/pin-input",
    group: "Inputs",
    component: PinInput,
  },
  {
    id: "tags",
    title: "Tags input",
    blurb:
      "Add/remove/edit-in-place: four states, paste splitting, max and overflow.",
    path: "/tags",
    group: "Inputs",
    component: Tags,
  },
  {
    id: "editable",
    title: "Editable",
    blurb:
      "Preview/edit pair with a controlled edit channel, commit/revert, submit-on-blur.",
    path: "/editable",
    group: "Inputs",
    component: Editable,
  },
  {
    id: "date-input",
    title: "Date input",
    blurb: "Per-segment date editing: typed digits, arrows, month-aware day limits.",
    path: "/date-input",
    group: "Inputs",
    component: DateInput,
  },
  {
    id: "date-picker",
    title: "Date picker",
    blurb: "Calendar panel: open/closed, day/month/year views, single/range selection.",
    path: "/date-picker",
    group: "Inputs",
    component: DatePicker,
  },
  {
    id: "select",
    title: "Select",
    blurb:
      "Three modes with the selection on the root tier; every reflex an action.",
    path: "/select",
    group: "Selection",
    component: Select,
  },
  {
    id: "popover",
    title: "Popover",
    blurb: "Platform-owned: native popover behind the same app-controller handle as a machine.",
    path: "/popover",
    group: "Disclosure",
    component: Popover,
  },
  {
    id: "tooltip",
    title: "Tooltip",
    blurb: "Platform-owned: hover dwell opens a native popover panel; focus opens at once.",
    path: "/tooltip",
    group: "Disclosure",
    component: Tooltip,
  },
  {
    id: "hover-card",
    title: "Hover card",
    blurb: "Platform-owned: dwell opens a rich panel that stays over either side.",
    path: "/hover-card",
    group: "Disclosure",
    component: HoverCard,
  },
  {
    id: "floating-panel",
    title: "Floating panel",
    blurb: "Draggable, resizable panel with stage modes; the gestures are actions.",
    path: "/floating-panel",
    group: "Disclosure",
    component: FloatingPanel,
  },
  {
    id: "file-upload",
    title: "File upload",
    blurb: "Validated dropzone: accept, size bounds, and count cap split the drop.",
    path: "/file-upload",
    group: "Inputs",
    component: FileUpload,
  },
  {
    id: "cascade",
    title: "Cascade select",
    blurb:
      "Multi-level selection: the level stack is derived from the highlight.",
    path: "/cascade",
    group: "Selection",
    component: Cascade,
  },
  {
    id: "menu",
    title: "Menu",
    blurb:
      "Hover-intent and long-press are actions; submenus are context, not states.",
    path: "/menu",
    group: "Disclosure",
    component: Menu,
  },
  {
    id: "navigation-menu",
    title: "Navigation menu",
    blurb: "Hover-dwell top-level menu with a value channel; the panel rides the item's hover.",
    path: "/navigation-menu",
    group: "Navigation",
    component: NavigationMenu,
  },
  {
    id: "tree-view",
    title: "Tree view",
    blurb:
      "The hardest port: per-node state, keyboard nav, expanded state as context.",
    path: "/tree-view",
    group: "Navigation",
    component: TreeView,
  },
  {
    id: "tour",
    title: "Tour",
    blurb: "Spotlight onboarding: each step resolves, scrolls, then frames its target.",
    path: "/tour",
    group: "Onboarding",
    component: Tour,
  },
  {
    id: "toast",
    title: "Toast",
    blurb:
      "A queue on the owned machine: per-toast lifecycle status, every clock an action.",
    path: "/toast",
    group: "Feedback",
    component: Toast,
  },
  {
    id: "async-list",
    title: "Async list",
    blurb:
      "Cursor-paged loading: idle/loading/sorting, fetch as a bridge reflex, sentinel.",
    path: "/async-list",
    group: "Data",
    component: AsyncList,
  },
  {
    id: "timer",
    title: "Timer",
    blurb:
      "Countdown and stopwatch with the clock as a stdlib action, never a machine timer.",
    path: "/timer",
    group: "Display",
    component: Timer,
  },
  {
    id: "carousel",
    title: "Carousel",
    blurb:
      "Drag-scroll, autoplay and intersect as stdlib actions; the machine stays flat.",
    path: "/carousel",
    group: "Display",
    component: Carousel,
  },
];

/** The nav groups in display order. */
/**
 * The rail's group order. The canonical sequence is explicit (it is the
 * nav's reading order, not the specimens array's), but a group that is
 * NOT listed still renders — derived from the specimens that use it, in
 * first-appearance order. A hand-kept list alone silently drops a whole
 * group from the rail: `tour` shipped with `Onboarding` and vanished.
 */
const GROUP_ORDER: readonly string[] = [
  "Inputs",
  "Selection",
  "Disclosure",
  "Navigation",
  "Feedback",
  "Data",
  "Display",
];

export const GROUPS: readonly string[] = (() => {
  const known = new Set(GROUP_ORDER);
  const seen = new Set<string>();
  for (const specimen of SPECIMENS) seen.add(specimen.group);
  const rest = [...seen].filter((group) => !known.has(group));
  return [...GROUP_ORDER, ...rest];
})();
