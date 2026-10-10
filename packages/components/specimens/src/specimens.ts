import type { JSX } from "solid-js";
import Accordion from "./routes/accordion.tsx";
import SideBySide from "./routes/side-by-side.tsx";
import TreeViewFsm from "./routes/tree-view-fsm.tsx";
import DialogFsm from "./routes/dialog-fsm.tsx";
import TabsFsm from "./routes/tabs-fsm.tsx";
import SliderFsm from "./routes/slider-fsm.tsx";
import MenuFsm from "./routes/menu-fsm.tsx";
import CarouselFsm from "./routes/carousel-fsm.tsx";
import Popover from "./routes/popover.tsx";
import Menu from "./routes/menu.tsx";
import Tabs from "./routes/tabs.tsx";
import Tooltip from "./routes/tooltip.tsx";
import Dialog from "./routes/dialog.tsx";
import TreeView from "./routes/tree-view.tsx";
import Carousel from "./routes/carousel.tsx";
import Slider from "./routes/slider.tsx";
import Toast from "./routes/toast.tsx";

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
    id: "toast",
    title: "Toast",
    blurb: "Toast notifications driven by the Zag toast machine.",
    path: "/toast",
    component: Toast,
  },
];
