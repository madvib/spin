/**
 * The project's procedures: project, themes, brands, icons, fonts, overlay.
 *
 * Contracts compose the project's own schemas; routers implement them
 * against the project module. The composed daemon router lives
 * composer-side, where every module's procedures mount by name.
 */

export { projectContract } from "./project-contract.ts";
export { projectRouter, rootFor, setProjectRoot } from "./project-procedures.ts";
export { fontsContract, fontsRouter } from "./fonts-procedures.ts";
export { iconsContract, iconsRouter } from "./icons-procedures.ts";
export { overlayContract, overlayRouter } from "./overlay.ts";
