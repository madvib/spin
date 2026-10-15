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
      "spin-image-cropper": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:src"?: string;
        "prop:alt"?: string;
        "prop:aspectRatio"?: string;
        "prop:cropShape"?: string;
        "prop:minWidth"?: string;
        "prop:minHeight"?: string;
        "prop:maxWidth"?: string;
        "prop:maxHeight"?: string;
        "prop:fixedCropArea"?: boolean;
        "prop:zoom"?: string;
        "prop:defaultZoom"?: string;
        "prop:rotation"?: string;
        "prop:defaultRotation"?: string;
        "prop:zoomStep"?: string;
        "prop:disabled"?: boolean;
      };
      "spin-steps": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:label"?: string;
        "prop:count"?: number;
        "prop:titles"?: unknown;
        "prop:linear"?: boolean;
        "prop:orientation"?: string;
        "prop:defaultStep"?: string;
        "prop:step"?: string;
      };
      "spin-splitter": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:panels"?: unknown;
        "prop:size"?: string;
        "prop:defaultSize"?: string;
        "prop:orientation"?: string;
        "prop:disabled"?: boolean;
      };
      "spin-slider": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:label"?: string;
        "prop:name"?: string;
        "prop:min"?: string;
        "prop:max"?: string;
        "prop:step"?: string;
        "prop:defaultValue"?: string;
        "prop:value"?: string;
        "prop:orientation"?: string;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
      };
      "spin-rating-group": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:label"?: string;
        "prop:name"?: string;
        "prop:count"?: number;
        "prop:allowHalf"?: boolean;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:required"?: boolean;
        "prop:defaultValue"?: string;
        "prop:value"?: string;
      };
      "spin-signature-pad": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:label"?: string;
        "prop:name"?: string;
        "prop:required"?: boolean;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
      };
      "spin-color-picker": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:label"?: string;
        "prop:value"?: string;
        "prop:defaultValue"?: string;
        "prop:format"?: string;
        "prop:defaultFormat"?: string;
        "prop:open"?: boolean;
        "prop:defaultOpen"?: boolean;
        "prop:inline"?: boolean;
        "prop:closeOnSelect"?: boolean;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:invalid"?: boolean;
        "prop:required"?: boolean;
        "prop:name"?: string;
        "prop:swatches"?: string;
      };
      "spin-listbox": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        "prop:items"?: readonly { value: string; label: string; disabled?: boolean; group?: string }[];
        "prop:label"?: string;
        "prop:value"?: string;
        "prop:defaultValue"?: string;
        "prop:highlightedValue"?: string;
        "prop:defaultHighlightedValue"?: string;
        "prop:multiple"?: boolean;
        "prop:selectOnHighlight"?: boolean;
        "prop:loopFocus"?: boolean;
        "prop:selectionBehavior"?: string;
        "prop:composite"?: boolean;
        "prop:orientation"?: string;
        "prop:disabled"?: boolean;
        "prop:readOnly"?: boolean;
        "prop:invalid"?: boolean;
        "prop:required"?: boolean;
        "prop:name"?: string;
        "prop:form"?: string;
      };
      "card": { ref?: HTMLElement | ((el: HTMLElement) => void); children?: JSX.Element; class?: string; };
      "card-header": { children?: JSX.Element; class?: string; };
      "card-title": { children?: JSX.Element; class?: string; };
      "card-description": { children?: JSX.Element; class?: string; };
      "card-action": { children?: JSX.Element; class?: string; };
      "card-content": { children?: JSX.Element; class?: string; };
      "card-footer": { children?: JSX.Element; class?: string; };
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
        "prop:defaultExpandedValue"?: readonly string[];
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
      "spin-date-input": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        value?: string;
        defaultValue?: string;
        granularity?: string;
        hourCycle?: number;
        min?: string;
        max?: string;
        name?: string;
        disabled?: boolean;
        "prop:label"?: string;
        "prop:defaultValue"?: string;
        "prop:name"?: string;
      };
      "spin-tour": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        steps?: string;
        "prop:steps"?: string;
      };
      "spin-navigation-menu": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        items?: string;
        "prop:items"?: string;
      };
      "spin-file-upload": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        accept?: string;
        multiple?: string;
        "max-files"?: string;
        "max-size"?: string;
        "min-size"?: string;
        disabled?: string;
        "prop:label"?: string;
        "prop:accept"?: string;
        "prop:multiple"?: string;
        "prop:maxSize"?: number;
      };
      "spin-floating-panel": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        defaultOpen?: boolean;
        open?: boolean;
        stage?: string;
        draggable?: boolean;
        resizable?: boolean;
        "prop:label"?: string;
        "prop:defaultOpen"?: boolean;
      };
      "spin-date-picker": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        selectionMode?: string;
        open?: boolean;
        min?: string;
        max?: string;
        "prop:label"?: string;
        "prop:defaultValue"?: string;
        "prop:selectionMode"?: string;
        "prop:placeholder"?: string;
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
      "spin-popover": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        "prop:label"?: string;
      };
      "spin-tooltip": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        tip?: string;
        "prop:label"?: string;
        "prop:tip"?: string;
      };
      "spin-hover-card": {
        ref?: HTMLElement | ((el: HTMLElement) => void);
        children?: JSX.Element;
        id?: string;
        label?: string;
        heading?: string;
        body?: string;
        "prop:label"?: string;
        "prop:heading"?: string;
        "prop:body"?: string;
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
