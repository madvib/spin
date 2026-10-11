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
 * own machine — e.g. `import "@spin/components/combobox"`. Framework JSX
 * augmentations and prop types live with the frameworks, never here: this
 * module registers elements and does nothing else.
 */

import "./spin-async-list/spin-async-list.html";
import "./spin-carousel/spin-carousel.html";
import "./spin-cascade-select/spin-cascade-select.html";
import "./spin-combobox/spin-combobox.html";
import "./spin-dialog/spin-dialog.html";
import "./spin-editable/spin-editable.html";
import "./spin-menu/spin-menu.html";
import "./spin-number-input/spin-number-input.html";
import "./spin-pin-input/spin-pin-input.html";
import "./spin-select/spin-select.html";
import "./spin-tags-input/spin-tags-input.html";
import "./spin-timer/spin-timer.html";
import "./spin-toast/spin-toast.html";
import "./spin-tree-view/spin-tree-view.html";
