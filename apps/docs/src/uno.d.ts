/**
 * `uno.css` is served by the UnoCSS vite plugin — a virtual module that exists
 * at dev time and is emitted at build time, and on disk never. The checker
 * cannot know that, so the module is declared here rather than left to resolve
 * to nothing.
 */
declare module "uno.css";
