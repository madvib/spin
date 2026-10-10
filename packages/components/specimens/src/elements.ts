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
        children?: JSX.Element;
        id?: string;
        class?: string;
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

export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNode[];
}

export interface CarouselItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
}

export interface ToastItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-accordion": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly AccordionItem[];
        collapsible?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
      "spin-accordion-robot": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly AccordionItem[];
        collapsible?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
      "spin-tree-view-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        nodes?: string;
        expandedValue?: readonly string[];
        selectedValue?: readonly string[];
        selectionMode?: string;
        expandOnClick?: boolean;
        typeahead?: boolean;
        rename?: boolean;
        loadChildren?: (value: string) => Promise<readonly unknown[]>;
        // Solid's property namespace: a plain string prop on a custom element
        // is silently dropped by Solid, so the template binds through prop:.
        // The runtime accepts both spellings (observed attributes plus the
        // property path), so either binds to the same live prop.
        "prop:selectionMode"?: string;
        "prop:expandOnClick"?: boolean;
        "prop:rename"?: boolean;
      };
      "spin-accordion-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly AccordionItem[];
        collapsible?: boolean;
        onClick?: (event: MouseEvent) => void;
      };
      "spin-tabs-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly { value: string; label: string; content: string; disabled?: boolean }[];
        defaultValue?: string;
        value?: string;
        orientation?: string;
        activationMode?: string;
        loopFocus?: boolean;
        deselectable?: boolean;
      };
      "spin-dialog-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        role?: string;
        defaultOpen?: boolean;
        modal?: boolean;
      };
      "spin-tooltip": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        openDelay?: number;
        closeDelay?: number;
        interactive?: boolean;
        disabled?: boolean;
        defaultOpen?: boolean;
      };
      "spin-tree-view": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        nodes?: string;
        defaultExpandedValue?: readonly string[];
        expandOnClick?: boolean;
        selectionMode?: string;
      };
      "spin-carousel": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        items?: readonly CarouselItem[];
        defaultPage?: number;
        loop?: boolean;
      };
      "spin-slider": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        label?: string;
        defaultValue?: number;
        min?: number;
        max?: number;
        step?: number;
        disabled?: boolean;
        name?: string;
      };
      "spin-toast": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        items?: readonly ToastItem[];
      };
    }
  }
}
