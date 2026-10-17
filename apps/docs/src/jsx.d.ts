/**
 * Types for the design system's custom elements, the same way the DOM
 * declares its own: `tabs` and `badge` are elements the primitives ship,
 * so JSX gets to know them.
 */
import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      tabs: HTMLAttributes<HTMLElement>;
      badge: HTMLAttributes<HTMLElement> & { variant?: string };
      alert: HTMLAttributes<HTMLElement> & { variant?: string };
      card: HTMLAttributes<HTMLElement>;
    }
  }
}
