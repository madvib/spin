import "../../src/elements.ts";

/**
 * Solid's view of the spin elements: JSX tags, prop types, event payloads.
 *
 * Registration itself is the library's (`src/elements.ts` — one import
 * defines every element). This module only teaches Solid's JSX the tag
 * names and the shapes passed across the boundary.
 *
 * Solid's property namespace: a plain string prop on a custom element is
 * silently dropped by Solid, so complex values bind through `prop:`. The
 * runtime accepts both spellings (observed attributes plus the property
 * path), so either binds to the same live prop.
 */

export interface ToastItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  readonly duration: number;
  readonly priority: number;
  readonly action: string;
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

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "spin-tree-view": {
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
        "prop:selectionMode"?: string;
        "prop:expandOnClick"?: boolean;
        "prop:rename"?: boolean;
      };
      "spin-dialog": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        role?: string;
        defaultOpen?: boolean;
        modal?: boolean;
      };
      "spin-menu": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        open?: boolean;
        closeOnSelect?: boolean;
        loopFocus?: boolean;
        placement?: string;
        "prop:open"?: boolean;
        "prop:closeOnSelect"?: boolean;
      };
      "spin-carousel": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        items?: readonly CarouselItem[];
        index?: number;
        defaultIndex?: number;
        loop?: boolean;
        orientation?: string;
        slidesPerPage?: number;
        autoplay?: boolean;
        autoplayDelay?: number;
        allowMouseDrag?: boolean;
      };
      "spin-async-list": {
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
      "spin-pin-input": {
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
      "spin-timer": {
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
      "spin-number-input": {
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
      "spin-tags-input": {
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
      "spin-editable": {
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
      "spin-cascade-select": {
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
      "spin-select": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: unknown;
        value?: string | readonly string[];
        defaultValue?: string | readonly string[];
        highlightedValue?: string;
        open?: boolean;
        multiple?: boolean;
        disabled?: boolean;
        label?: string;
        placeholder?: string;
        name?: string;
        form?: string;
        "prop:items"?: unknown;
        "prop:label"?: string;
        "prop:placeholder"?: string;
        "prop:value"?: string | readonly string[];
        "prop:defaultValue"?: string | readonly string[];
        "prop:multiple"?: boolean;
        "prop:disabled"?: boolean;
        "prop:open"?: boolean;
        "prop:name"?: string;
        "prop:form"?: string;
      };
      "spin-combobox": {
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
      "spin-toast": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: readonly ToastItem[];
        overlap?: boolean;
        placement?: string;
        removeDelay?: number;
        label?: string;
        "prop:items"?: readonly ToastItem[];
        "prop:overlap"?: boolean;
        "prop:placement"?: string;
        "prop:removeDelay"?: number;
      };
    }
  }
}
