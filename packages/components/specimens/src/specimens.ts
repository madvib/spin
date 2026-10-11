import type { JSX } from "solid-js";
import AsyncList from "./routes/async-list.tsx";
import Carousel from "./routes/carousel.tsx";
import Cascade from "./routes/cascade.tsx";
import Combobox from "./routes/combobox.tsx";
import Dialog from "./routes/dialog.tsx";
import Editable from "./routes/editable.tsx";
import Menu from "./routes/menu.tsx";
import NumberInput from "./routes/number-input.tsx";
import PinInput from "./routes/pin-input.tsx";
import Select from "./routes/select.tsx";
import Tags from "./routes/tags.tsx";
import Timer from "./routes/timer.tsx";
import Toast from "./routes/toast.tsx";
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
    id: "combobox",
    title: "Combobox",
    blurb: "Input plus listbox: filtering, inline autocomplete, trigger, grouped options.",
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
    blurb: "The one-time-code field: per-cell state, paste distribution, completion edge.",
    path: "/pin-input",
    group: "Inputs",
    component: PinInput,
  },
  {
    id: "tags",
    title: "Tags input",
    blurb: "Add/remove/edit-in-place: four states, paste splitting, max and overflow.",
    path: "/tags",
    group: "Inputs",
    component: Tags,
  },
  {
    id: "editable",
    title: "Editable",
    blurb: "Preview/edit pair with a controlled edit channel, commit/revert, submit-on-blur.",
    path: "/editable",
    group: "Inputs",
    component: Editable,
  },
  {
    id: "select",
    title: "Select",
    blurb: "Three modes with the selection on the root tier; every reflex an action.",
    path: "/select",
    group: "Selection",
    component: Select,
  },
  {
    id: "cascade",
    title: "Cascade select",
    blurb: "Multi-level selection: the level stack is derived from the highlight.",
    path: "/cascade",
    group: "Selection",
    component: Cascade,
  },
  {
    id: "dialog",
    title: "Dialog",
    blurb: "Two-state machine; focus-trap, dismissable, and scroll-lock as stdlib actions.",
    path: "/dialog",
    group: "Disclosure",
    component: Dialog,
  },
  {
    id: "menu",
    title: "Menu",
    blurb: "Hover-intent and long-press are actions; submenus are context, not states.",
    path: "/menu",
    group: "Disclosure",
    component: Menu,
  },
  {
    id: "tree-view",
    title: "Tree view",
    blurb: "The hardest port: per-node state, keyboard nav, expanded state as context.",
    path: "/tree-view",
    group: "Navigation",
    component: TreeView,
  },
  {
    id: "toast",
    title: "Toast",
    blurb: "A queue on the owned machine: per-toast lifecycle status, every clock an action.",
    path: "/toast",
    group: "Feedback",
    component: Toast,
  },
  {
    id: "async-list",
    title: "Async list",
    blurb: "Cursor-paged loading: idle/loading/sorting, fetch as a bridge reflex, sentinel.",
    path: "/async-list",
    group: "Data",
    component: AsyncList,
  },
  {
    id: "timer",
    title: "Timer",
    blurb: "Countdown and stopwatch with the clock as a stdlib action, never a machine timer.",
    path: "/timer",
    group: "Display",
    component: Timer,
  },
  {
    id: "carousel",
    title: "Carousel",
    blurb: "Drag-scroll, autoplay and intersect as stdlib actions; the machine stays flat.",
    path: "/carousel",
    group: "Display",
    component: Carousel,
  },
];

/** The nav groups in display order. */
export const GROUPS: readonly string[] = [
  "Inputs",
  "Selection",
  "Disclosure",
  "Navigation",
  "Feedback",
  "Data",
  "Display",
];
