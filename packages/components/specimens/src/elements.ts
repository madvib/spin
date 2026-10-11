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

export interface ToastFsmItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  readonly duration: number;
  readonly priority: number;
  readonly action: string;
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
      "spin-slider-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        label?: string;
        value?: string;
        defaultValue?: number;
        min?: number;
        max?: number;
        step?: number;
        largeStep?: number;
        orientation?: string;
        disabled?: boolean;
        markers?: string;
        thumbSize?: string;
        thumbAlignment?: string;
        origin?: string;
        thumbCollisionBehavior?: string;
        minStepsBetweenThumbs?: number;
        name?: string;
        "prop:label"?: string;
        "prop:defaultValue"?: number;
        "prop:markers"?: string;
        "prop:thumbSize"?: string;
        "prop:disabled"?: boolean;
      };
      "spin-menu-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        open?: boolean;
        closeOnSelect?: boolean;
        loopFocus?: boolean;
        placement?: string;
        "prop:open"?: boolean;
        "prop:closeOnSelect"?: boolean;
      };
      "spin-carousel-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly { value: string; label: string; content: string }[];
        index?: number;
        defaultIndex?: number;
        loop?: boolean;
        orientation?: string;
        slidesPerPage?: number;
        autoplay?: boolean;
        autoplayDelay?: number;
        allowMouseDrag?: boolean;
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


declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-async-list-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:load"?: unknown;
        "prop:sortFn"?: unknown;
        "prop:initialItems"?: unknown;
        "prop:initialFilterText"?: string;
        "prop:initialSortDescriptor"?: unknown;
        "prop:dependencies"?: readonly unknown[];
        "prop:autoReload"?: boolean;
      };
      "spin-pin-input-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        count?: number;
        mask?: boolean;
        otp?: boolean;
        disabled?: boolean;
        label?: string;
        blurOnComplete?: boolean;
        "prop:count"?: number;
        "prop:mask"?: boolean;
        "prop:otp"?: boolean;
        "prop:disabled"?: boolean;
        "prop:label"?: string;
        "prop:name"?: string;
        "prop:defaultValue"?: readonly string[];
        "prop:blurOnComplete"?: boolean;
      };
      "spin-timer-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        countdown?: boolean;
        autoStart?: boolean;
        startMs?: string;
        targetMs?: string;
        interval?: number;
        "prop:startMs"?: string;
        "prop:targetMs"?: string;
        "prop:interval"?: number;
      };
      "spin-number-input-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        value?: string;
        defaultValue?: string;
        min?: string;
        max?: string;
        step?: string;
        largeStep?: string;
        smallStep?: string;
        disabled?: boolean;
        readOnly?: boolean;
        invalid?: boolean;
        required?: boolean;
        allowMouseWheel?: boolean;
        allowOverflow?: boolean;
        clampValueOnBlur?: boolean;
        focusInputOnChange?: boolean;
        spinOnPress?: boolean;
        dir?: string;
        name?: string;
        form?: string;
        inputMode?: string;
        pattern?: string;
        incrementLabel?: string;
        decrementLabel?: string;
        "prop:label"?: string;
        "prop:defaultValue"?: string;
        "prop:value"?: string;
        "prop:min"?: string;
        "prop:max"?: string;
        "prop:step"?: string;
        "prop:disabled"?: boolean;
        "prop:dir"?: string;
        "prop:allowMouseWheel"?: boolean;
      };
      "spin-steps-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        count?: number;
        step?: number;
        defaultStep?: number;
        linear?: boolean;
        orientation?: string;
        labels?: readonly string[];
        "prop:count"?: number;
        "prop:step"?: number;
        "prop:defaultStep"?: number;
        "prop:linear"?: boolean;
        "prop:orientation"?: string;
        "prop:labels"?: string[] | readonly string[];
      };
      "spin-tags-input-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        placeholder?: string;
        value?: readonly string[];
        defaultValue?: readonly string[];
        inputValue?: string;
        defaultInputValue?: string;
        max?: number;
        maxLength?: number;
        delimiter?: string;
        addOnPaste?: boolean;
        allowDuplicates?: boolean;
        allowOverflow?: boolean;
        editable?: boolean;
        disabled?: boolean;
        readOnly?: boolean;
        invalid?: boolean;
        required?: boolean;
        autoFocus?: boolean;
        blurBehavior?: string;
        name?: string;
        form?: string;
        dir?: string;
        "prop:label"?: string;
        "prop:defaultValue"?: readonly string[];
        "prop:value"?: readonly string[];
        "prop:inputValue"?: string;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:max"?: number;
        "prop:delimiter"?: string;
        "prop:allowOverflow"?: boolean;
        "prop:allowDuplicates"?: boolean;
        "prop:blurBehavior"?: string;
      };
      "spin-pagination-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        count?: number;
        page?: number;
        defaultPage?: number;
        pageSize?: number;
        defaultPageSize?: number;
        siblingCount?: number;
        boundaryCount?: number;
        type?: string;
        dir?: string;
        "prop:count"?: number;
        "prop:page"?: number;
        "prop:defaultPage"?: number;
        "prop:pageSize"?: number;
        "prop:siblingCount"?: number;
        "prop:boundaryCount"?: number;
      };
      "spin-avatar-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        src?: string;
        alt?: string;
        name?: string;
        dir?: string;
        "prop:src"?: string;
        "prop:alt"?: string;
        "prop:name"?: string;
      };
      "spin-rating-group-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        count?: number;
        value?: number;
        defaultValue?: number;
        name?: string;
        allowHalf?: boolean;
        readOnly?: boolean;
        disabled?: boolean;
        required?: boolean;
        form?: string;
        "prop:value"?: number;
        "prop:defaultValue"?: number;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:allowHalf"?: boolean;
        "prop:count"?: number;
        "prop:label"?: string;
        "prop:required"?: boolean;
        "prop:name"?: string;
      };
      "spin-listbox-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: unknown;
        value?: string;
        defaultValue?: string;
        highlightedValue?: string;
        selectionMode?: string;
        disabled?: boolean;
        "prop:value"?: string;
        "prop:items"?: unknown;
        "prop:label"?: string;
        "prop:columnCount"?: number;
        "prop:selectionMode"?: string;
        "prop:disabled"?: boolean;
        "prop:defaultValue"?: string;
      };
      "spin-scroll-area-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        dir?: string;
        class?: string;
        "prop:dir"?: string;
      };
      "spin-editable-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        value?: string;
        defaultValue?: string;
        editing?: boolean;
        defaultEdit?: boolean;
        activationMode?: string;
        submitMode?: string;
        autoResize?: boolean;
        selectOnFocus?: boolean;
        disabled?: boolean;
        readOnly?: boolean;
        invalid?: boolean;
        required?: boolean;
        maxLength?: number;
        name?: string;
        form?: string;
        placeholder?: string;
        finalFocus?: string;
        dir?: string;
        "prop:label"?: string;
        "prop:defaultValue"?: string;
        "prop:placeholder"?: string;
        "prop:editing"?: boolean;
        "prop:defaultEdit"?: boolean;
        "prop:activationMode"?: string;
        "prop:submitMode"?: string;
        "prop:autoResize"?: boolean;
        "prop:selectOnFocus"?: boolean;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:invalid"?: boolean;
        "prop:required"?: boolean;
        "prop:maxLength"?: number;
        "prop:name"?: string;
        "prop:form"?: string;
        "prop:finalFocus"?: string;
        "prop:dir"?: string;
      };
      "spin-cascade-select-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: unknown;
        value?: string;
        defaultValue?: string;
        highlightedValue?: string;
        open?: boolean;
        disabled?: boolean;
        "prop:value"?: string;
        "prop:items"?: unknown;
      };
      "spin-combobox-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: unknown;
        value?: string;
        defaultValue?: string;
        inputValue?: string;
        defaultInputValue?: string;
        highlightedValue?: string;
        defaultHighlightedValue?: string;
        open?: boolean;
        defaultOpen?: boolean;
        multiple?: boolean;
        closeOnSelect?: boolean;
        disabled?: boolean;
        "prop:items"?: unknown;
        "prop:label"?: string;
        "prop:placeholder"?: string;
        "prop:value"?: string;
        "prop:defaultValue"?: string;
        "prop:inputValue"?: string;
        "prop:defaultInputValue"?: string;
        "prop:multiple"?: boolean;
        "prop:disabled"?: boolean;
        "prop:inputBehavior"?: string;
        "prop:defaultOpen"?: boolean;
        "prop:open"?: boolean;
        "prop:closeOnSelect"?: boolean;
      };
      "spin-toast-fsm": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: readonly ToastFsmItem[];
        overlap?: boolean;
        placement?: string;
        removeDelay?: number;
        label?: string;
        "prop:items"?: readonly ToastFsmItem[];
        "prop:overlap"?: boolean;
        "prop:placement"?: string;
        "prop:removeDelay"?: number;
      };
    }
  }
}
