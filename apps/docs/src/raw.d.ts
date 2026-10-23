/**
 * The ambient surface of a raw import.
 *
 * Vite reads a file as text when the specifier carries `?raw`, and the docs
 * read the skill's own files that way, so the pages and the served file are
 * the same bytes.
 */
declare module "*?raw" {
  const source: string;
  export default source;
}
