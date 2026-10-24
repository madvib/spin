/**
 * The ambient surface of Vite that this app's shell needs: the glob
 * generator that turns the `pages/` tree into routes, and the virtual
 * stylesheet the plugin emits.
 */
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options: {
      eager: true;
      query?: string;
      import?: string;
    },
  ): Record<string, T>;
  glob<T = unknown>(
    pattern: string,
    options?: {
      eager?: false;
      query?: string;
      import?: string;
    },
  ): Record<string, () => Promise<T>>;
}

declare module "uno.css";
