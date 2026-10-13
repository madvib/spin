/**
 * The example app: a roastery that is not product.
 *
 * It exists so the studio has a target that is not the reference. The
 * reference is the internal surface — every primitive, every gate — and a
 * stranger editing a theme against it is reading documentation and calling
 * it a product. This is what a customer's app looks like: one theme, a few
 * pages, primitives used the way a consumer uses them rather than the way a
 * catalogue lists them.
 *
 * The theme lives in `spin/roastery.json`, which is the same directory the
 * studio edits and the plugin reads — nothing about it is special, and that
 * is the point.
 */

import { render } from "solid-js/web";
import App from "./app.tsx";
import "uno.css";

render(() => <App />, document.getElementById("app")!);
