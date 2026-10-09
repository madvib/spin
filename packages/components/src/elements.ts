/**
 * Library registration: importing this module defines every spin element.
 *
 * Each `.html` import runs its `define()` as a side effect (via the
 * `spinElements` vite plugin, which compiles the component to a module).
 * One import registers the library — in any `index.html` entry, framework
 * or none:
 *
 *   import "@spin/components/elements";
 *
 * For a smaller bundle, import per component instead — each pulls only its
 * own machine — e.g. `import "@spin/components/accordion"`. Framework JSX
 * augmentations and prop types live with the frameworks, never here: this
 * module registers elements and does nothing else.
 */

import "./spin-accordion/spin-accordion.html";
import "./spin-dialog/spin-dialog.html";
import "./spin-menu/spin-menu.html";
import "./spin-popover/spin-popover.html";
import "./spin-tabs/spin-tabs.html";
import "./spin-tooltip/spin-tooltip.html";
import "./spin-tree-view/spin-tree-view.html";
import "./spin-carousel/spin-carousel.html";
import "./spin-checkbox/spin-checkbox.html";
import "./spin-radio-group/spin-radio-group.html";
import "./spin-switch/spin-switch.html";
import "./spin-select/spin-select.html";
import "./spin-slider/spin-slider.html";
import "./spin-toast/spin-toast.html";
