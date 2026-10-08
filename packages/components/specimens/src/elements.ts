/**
 * Registers the spin custom elements and teaches Solid's JSX about them.
 *
 * Importing a component's `.html` is what runs its `define()`; the module
 * augmentation is what lets the routes render it as `<spin-accordion>`.
 */
import "../../src/spin-accordion/spin-accordion.html";
import "../../src/spin-dialog/spin-dialog.html";

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
import "../../src/spin-popover/spin-popover.html";

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
import "../../src/spin-menu/spin-menu.html";

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
import "../../src/spin-tabs/spin-tabs.html";

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
import "../../src/spin-tooltip/spin-tooltip.html";


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
