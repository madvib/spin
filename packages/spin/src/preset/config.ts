/**
 * What an uno config that wires spin looks like, as text.
 *
 * A pure producer: this file never touches a filesystem and never imports
 * uno. It exists so `spin init` can write a build config without the preset
 * knowing what a project is, and without a project knowing what uno is —
 * the daemon composes the two.
 *
 * The generated file is the ENCAPSULATED form: it imports one thing from
 * `@spinjs/config` and applies it. The raw form — `presetIcons()` plus
 * `spinPreset()` written out by hand — remains available and fully
 * supported, because an escape hatch we do not have to document is worth
 * more than a wrapper that hides one. This file just picks the boring
 * default for a project that has not expressed a preference.
 */

/**
 * The `@spinjs/config` module's shape, which the generated file imports.
 *
 * Kept in sync with what `@spinjs/preset` will export from that entry; when the
 * framework's bundler preset lands, this becomes the seam — the generated
 * file stops changing and the package behind it does.
 */
export interface SpinConfigOptions {
  /** Content globs to scan for classes, beyond the framework's defaults. */
  readonly include?: readonly string[];
}

/** The config a generated uno.config.ts applies. */
export function spinConfig(options: SpinConfigOptions = {}) {
  return { spin: true, include: [...options.include ?? []] };
}

/** The text of an `uno.config.ts` for a fresh spin project. */
export function configScaffoldText(): string {
  return `import { defineConfig } from "unocss";
import { spin } from "@spinjs/config";

export default defineConfig({
  presets: [spin()],
});
`;
}
