/**
 * This app's markup uses the spin element vocabulary directly, so it pulls
 * in the one shared augmentation rather than a second copy that would drift
 * from it.
 */
/// <reference types="@spinjs/spin/elements" />

declare module "lib/components/*.html" {
  const tag: string;
  export default tag;
}

declare module "@spinjs/components/examples" {
  const tags: readonly string[];
  export default tags;
}

declare module "@spinjs/components/*.html" {
  const tag: string;
  export default tag;
}
