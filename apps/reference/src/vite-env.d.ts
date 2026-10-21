/**
 * The ambient surface of Vite that this app's shell needs: the glob
 * generator that reads the project's `spin/` themes at build time.
 */
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: {
      eager?: boolean;
      query?: string;
      import?: string;
    },
  ): Record<string, T>;
}
