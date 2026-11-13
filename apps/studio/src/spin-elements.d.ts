/**
 * This app's markup uses the spin element vocabulary directly, so it pulls
 * in the one shared augmentation rather than a second copy that would drift
 * from it.
 */
/// <reference types="@spinjs/preset/elements" />
/// <reference types="@spinjs/preset/elements/solid" />

declare module "src/lib/components/*.html" {
  const tag: string;
  export default tag;
}

declare module "@spinjs/components/examples" {
  import type { ExampleSource } from "../../packages/components/src/examples.ts";
  export function exampleSources(): Map<string, readonly ExampleSource[]>;
  export function exampleMachines(): readonly string[];
  export function mountTag(machine: string, stem: string): string;
}

declare module "@spinjs/components/*.html" {
  const tag: string;
  export default tag;
}
