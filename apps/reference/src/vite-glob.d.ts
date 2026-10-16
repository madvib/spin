/**
 * `import.meta.glob` is a vite compile-time macro — real at dev/build,
 * unknown to the checker. Declared here the way `uno.css` is.
 */
declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options?: { query?: string; import?: string; eager?: boolean },
    ): Record<string, string>;
  }
}

export {};
