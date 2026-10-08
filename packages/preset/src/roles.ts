import {
  requiredPaths,
  scaffoldTheme,
  treeToJson,
} from "@spin/theme";
import type { TokenTree } from "@spin/theme";

/**
 * The roles a theme must declare: the base roles from `@spin/theme`.
 *
 * A component's character tokens are deliberately not among them. They are a
 * customisation a theme opts into — the preflight emits whatever a document
 * declares — so a theme that declares no `button` group is complete and
 * valid, and a theme that wants to restyle a component's character says so
 * in its own document.
 */
export function requiredRolesFor(): string[] {
  return [...requiredPaths()];
}

/**
 * The minimal valid theme: every required role, no scales. The full surface
 * a consumer gets by default.
 */
export function scaffold(): TokenTree {
  return scaffoldTheme(requiredRolesFor());
}

/**
 * The same scaffold as a document, which is what `spinPreset` takes. A theme
 * carries more than tokens — `$extensions.spin.fonts` declares what to load —
 * so the document is the unit the preset consumes and the tree is the derived
 * view of it.
 */
export function scaffoldDocument(): Record<string, unknown> {
  return JSON.parse(treeToJson(scaffold())) as Record<string, unknown>;
}

