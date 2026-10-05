/**
 * The page's entry: importing the component is the whole registration.
 *
 * `define` calls `customElements.define` at module scope, so the element is
 * live by the time this module finishes evaluating. There is no boot call to
 * forget and no framework to await.
 */
import "./tree-view.ts";
