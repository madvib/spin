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
import "./spin-date-input/spin-date-input.html";
import "./spin-date-picker/spin-date-picker.html";
import "./spin-combobox/spin-combobox.html";
import "./spin-listbox/spin-listbox.html";
import "./spin-color-picker/spin-color-picker.html";
import "./spin-image-cropper/spin-image-cropper.html";
import "./spin-signature-pad/spin-signature-pad.html";
import "./spin-rating-group/spin-rating-group.html";
import "./spin-slider/spin-slider.html";
import "./spin-splitter/spin-splitter.html";
import "./spin-steps/spin-steps.html";
import "./spin-pagination/spin-pagination.html";
import "./spin-angle-slider/spin-angle-slider.html";
import "./spin-toggle-group/spin-toggle-group.html";
import "./spin-toggle/spin-toggle.html";
import "./spin-avatar/spin-avatar.html";
import "./spin-editable/spin-editable.html";
import "./spin-file-upload/spin-file-upload.html";
import "./spin-floating-panel/spin-floating-panel.html";
import "./spin-hover-card/spin-hover-card.html";
import "./spin-menu/spin-menu.html";
import "./spin-navigation-menu/spin-navigation-menu.html";
import "./spin-number-input/spin-number-input.html";
import "./spin-popover/spin-popover.html";
import "./spin-pin-input/spin-pin-input.html";
import "./spin-select/spin-select.html";
import "./spin-tags-input/spin-tags-input.html";
import "./spin-timer/spin-timer.html";
import "./spin-tour/spin-tour.html";
import "./spin-toast/spin-toast.html";
import "./spin-tooltip/spin-tooltip.html";
import "./spin-tree-view/spin-tree-view.html";
