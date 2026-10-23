/**
 * Types for the design system's custom elements, the same way the DOM
 * declares its own: `badge` is an element the primitives ship, so JSX gets
 * to know it.
 */
import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      badge: HTMLAttributes<HTMLElement> & { variant?: string };
      alert: HTMLAttributes<HTMLElement> & { variant?: string };
      card: HTMLAttributes<HTMLElement>;
      prose: HTMLAttributes<HTMLElement>;
    }
  }
}
