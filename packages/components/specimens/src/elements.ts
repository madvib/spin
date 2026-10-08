import "../../src/elements.ts";

/**
 * Solid's view of the spin elements: JSX tags, prop types, event payloads.
 *
 * Registration itself is the library's (`src/elements.ts` — one import
 * defines every element). This module only teaches Solid's JSX the tag
 * names and the shapes passed across the boundary.
 */



export interface DialogOpenChange {
  readonly open: boolean;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-dialog": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        onOpenChange?: (change: DialogOpenChange) => void;
      };
    }
  }
}


export interface PopoverProps {
  readonly title?: string;
  readonly description?: string;
  readonly defaultOpen?: boolean;
  readonly open?: boolean;
  readonly modal?: boolean;
  readonly portalled?: boolean;
  readonly autoFocus?: boolean;
  readonly onOpenChange?: (change: { open: boolean }) => void;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-popover": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        title?: string;
        description?: string;
        defaultOpen?: boolean;
        open?: boolean;
        modal?: boolean;
        portalled?: boolean;
        autoFocus?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
    }
  }
}


export interface MenuItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-menu": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        items?: readonly MenuItem[];
        onClick?: (event: MouseEvent) => void;
      };
    }
  }
}


export interface TabsItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
  readonly disabled?: boolean;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-tabs": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        items?: readonly TabsItem[];
        defaultValue?: string;
        orientation?: string;
        activationMode?: string;
        loopFocus?: boolean;
        deselectable?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
    }
  }
}



export type { AccordionValueChange } from "../../src/spin-accordion/accordion.machine-def.ts";
export interface AccordionItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-accordion": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        items?: readonly AccordionItem[];
        collapsible?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
      "spin-tooltip": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        openDelay?: number;
        closeDelay?: number;
        interactive?: boolean;
        disabled?: boolean;
        defaultOpen?: boolean;
      };
    }
  }
}
