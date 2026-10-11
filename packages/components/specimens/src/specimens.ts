import type { JSX } from "solid-js";
import Accordion from "./routes/accordion.tsx";
import SideBySide from "./routes/side-by-side.tsx";
import TreeViewFsm from "./routes/tree-view-fsm.tsx";
import DialogFsm from "./routes/dialog-fsm.tsx";
import TabsFsm from "./routes/tabs-fsm.tsx";
import AvatarFsm from "./routes/avatar-fsm.tsx";
import RatingFsm from "./routes/rating-fsm.tsx";
import ListboxFsm from "./routes/listbox-fsm.tsx";
import AsyncListFsm from "./routes/async-list-fsm.tsx";
import ComboboxFsm from "./routes/combobox-fsm.tsx";
import NumberInputFsm from "./routes/number-input-fsm.tsx";
import TimerFsm from "./routes/timer-fsm.tsx";
import PinInputFsm from "./routes/pin-input-fsm.tsx";
import StepsFsm from "./routes/steps-fsm.tsx";
import TagsFsm from "./routes/tags-fsm.tsx";
import PaginationFsm from "./routes/pagination-fsm.tsx";
import SliderFsm from "./routes/slider-fsm.tsx";
import MenuFsm from "./routes/menu-fsm.tsx";
import CascadeFsm from "./routes/cascade-fsm.tsx";
import CarouselFsm from "./routes/carousel-fsm.tsx";
import Popover from "./routes/popover.tsx";
import Menu from "./routes/menu.tsx";
import Tabs from "./routes/tabs.tsx";
import Tooltip from "./routes/tooltip.tsx";
import Dialog from "./routes/dialog.tsx";
import TreeView from "./routes/tree-view.tsx";
import Carousel from "./routes/carousel.tsx";
import Slider from "./routes/slider.tsx";
import ScrollAreaFsm from "./routes/scroll-area-fsm.tsx";
import EditableFsm from "./routes/editable-fsm.tsx";
import Toast from "./routes/toast.tsx";
import ToastFsm from "./routes/toast-fsm.tsx";

/** One component under test, plus the route that shows it. */
export interface Specimen {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly path: string;
  readonly component: () => JSX.Element;
}

/**
 * The specimen table. Routes and index links both derive from this list, so a
 * component is added in one place and its URL is never typed twice.
 */
export const SPECIMENS: readonly Specimen[] = [
  {
    id: "accordion",
    title: "Accordion",
    blurb: "Disclosure rows driven by the Zag accordion machine.",
    path: "/accordion",
    component: Accordion,
  },
  {
    id: "avatar-fsm",
    title: "Avatar (fsm)",
    blurb: "Image load state on the forked FSM, with the observe action reporting settled status.",
    path: "/avatar-fsm",
    component: AvatarFsm,
  },
  {
    id: "rating-fsm",
    title: "Rating (fsm)",
    blurb: "Hover preview, half stars from pointer position, form-control for fieldsets.",
    path: "/rating-fsm",
    component: RatingFsm,
  },
  {
    id: "listbox-fsm",
    title: "Listbox (fsm)",
    blurb: "The low-level listbox: selection, typeahead, grid orientation, empty state.",
    path: "/listbox-fsm",
    component: ListboxFsm,
  },
  {
    id: "async-list-fsm",
    title: "Async list (fsm)",
    blurb: "Cursor-paged async loading: idle/loading/sorting, fetch as a bridge-owned reflex, infinite-scroll sentinel.",
    path: "/async-list-fsm",
    component: AsyncListFsm,
  },
  {
    id: "combobox-fsm",
    title: "Combobox (fsm)",
    blurb: "Input plus listbox: filtering, inline autocomplete, trigger, grouped options.",
    path: "/combobox-fsm",
    component: ComboboxFsm,
  },
  {
    id: "steps-fsm",
    title: "Steps (fsm)",
    blurb: "The stepper: linear and non-linear, vertical or horizontal, a percent progress, controlled step.",
    path: "/steps-fsm",
    component: StepsFsm,
  },
  {
    id: "pagination-fsm",
    title: "Pagination (fsm)",
    blurb: "Page, page size, truncation and the four edge triggers on the forked FSM.",
    path: "/pagination-fsm",
    component: PaginationFsm,
  },
  {
    id: "tags-fsm",
    title: "Tags input (fsm)",
    blurb:
      "Tag add/remove/edit-in-place on the forked FSM: four states, paste splitting, max and overflow, live-region announcements.",
    path: "/tags-fsm",
    component: TagsFsm,
  },
  {
    id: "number-input-fsm",
    title: "Number input (fsm)",
    blurb: "Value, range, press-and-hold spin controls, and the scrubber drag on the forked FSM.",
    path: "/number-input-fsm",
    component: NumberInputFsm,
  },
  {
    id: "timer-fsm",
    title: "Timer (fsm)",
    blurb: "Countdown and stopwatch with the clock as a stdlib action, never a machine timer.",
    path: "/timer-fsm",
    component: TimerFsm,
  },
  {
    id: "pin-input-fsm",
    title: "Pin input (fsm)",
    blurb: "The one-time-code field: per-cell state, paste distribution, the completion edge.",
    path: "/pin-input-fsm",
    component: PinInputFsm,
  },
  {
    id: "side-by-side",
    title: "Zag vs robot3",
    blurb: "Same accordion markup and events, two interpreters, running together.",
    path: "/side-by-side",
    component: SideBySide,
  },
  {
    id: "tree-view-fsm",
    title: "Tree view (fsm)",
    blurb: "The hard Zag machine, ported to the forked FSM: per-node state, 30 events, keyboard nav.",
    path: "/tree-view-fsm",
    component: TreeViewFsm,
  },
  {
    id: "dialog-fsm",
    title: "Dialog (fsm + actions)",
    blurb: "Two-state machine; focus-trap, dismissable, and scroll-lock as stdlib actions.",
    path: "/dialog-fsm",
    component: DialogFsm,
  },
  {
    id: "tabs-fsm",
    title: "Tabs (fsm)",
    blurb: "Selection plus focus in two states; arrows, Home/End, disabled rows.",
    path: "/tabs-fsm",
    component: TabsFsm,
  },
  {
    id: "slider-fsm",
    title: "Slider (fsm)",
    blurb: "Continuous value under pointer capture; geometry through the custom-property channel.",
    path: "/slider-fsm",
    component: SliderFsm,
  },
  {
    id: "carousel-fsm",
    title: "Carousel (fsm + actions)",
    blurb: "Drag-scroll, autoplay and intersect as stdlib actions; the machine stays flat.",
    path: "/carousel-fsm",
    component: CarouselFsm,
  },
  {
    id: "menu-fsm",
    title: "Menu (fsm)",
    blurb: "Two-state machine; hover-intent and long-press are actions, submenus are context.",
    path: "/menu-fsm",
    component: MenuFsm,
  },
  {
    id: "cascade-fsm",
    title: "Cascade select (fsm)",
    blurb: "Multi-level selection: the level stack is derived from the highlight.",
    path: "/cascade-fsm",
    component: CascadeFsm,
  },
  {
    id: "popover",
    title: "Popover",
    blurb: "A popover panel driven by the Zag popover machine.",
    path: "/popover",
    component: Popover,
  },
  {
    id: "menu",
    title: "Menu",
    blurb: "A dropdown menu driven by the Zag menu machine.",
    path: "/menu",
    component: Menu,
  },
  {
    id: "tooltip",
    title: "Tooltip",
    blurb: "Hover-driven tooltip powered by the Zag tooltip machine.",
    path: "/tooltip",
    component: Tooltip,
  },
  {
    id: "tabs",
    title: "Tabs",
    blurb: "Value-driven tab panels from the Zag tabs machine.",
    path: "/tabs",
    component: Tabs,
  },
  {
    id: "dialog",
    title: "Dialog",
    blurb: "Modal dialog driven by the Zag dialog machine.",
    path: "/dialog",
    component: Dialog,
  },
  {
    id: "tree-view",
    title: "TreeView",
    blurb: "Expandable tree driven by the Zag tree-view machine.",
    path: "/tree-view",
    component: TreeView,
  },
  {
    id: "carousel",
    title: "Carousel",
    blurb: "Paged slides driven by the Zag carousel machine.",
    path: "/carousel",
    component: Carousel,
  },
  {
    id: "slider",
    title: "Slider",
    blurb: "A value slider driven by the Zag slider machine.",
    path: "/slider",
    component: Slider,
  },
  {
    id: "scroll-area-fsm",
    title: "Scroll area (fsm)",
    blurb: "Layout-derived state: the view measures, the machine holds, and geometry travels as custom properties.",
    path: "/scroll-area-fsm",
    component: ScrollAreaFsm,
  },
  {
    id: "editable-fsm",
    title: "Editable (fsm)",
    blurb: "Preview/edit pair with a controlled edit channel, commit/revert and submit-on-blur.",
    path: "/editable-fsm",
    component: EditableFsm,
  },
  {
    id: "toast",
    title: "Toast",
    blurb: "Toast notifications driven by the Zag toast machine.",
    path: "/toast",
    component: Toast,
  },
  {
    id: "toast-fsm",
    title: "Toast (fsm)",
    blurb: "Toast queue on the forked FSM: per-toast lifecycle status, every clock an action.",
    path: "/toast-fsm",
    component: ToastFsm,
  },
];
