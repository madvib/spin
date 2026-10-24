/**
 * The server builds of Solid, as modules TypeScript can see.
 *
 * Solid's package map exposes `./dist/server.js` at runtime but ships no
 * declarations for those deep paths, so a direct import is an untyped
 * module. These declarations re-export the public surface the server
 * builds implement.
 */
declare module "solid-js/dist/server.js" {
  export * from "solid-js";
}
declare module "solid-js/web/dist/server.js" {
  export * from "solid-js/web";
}
