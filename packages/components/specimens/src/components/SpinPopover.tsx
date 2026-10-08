/**
 * The Solid side of the L4 controller loop for `<spin-popover>`.
 *
 * The controller owns the data and passes it DOWN as a property write — the
 * live prop contract of `define`, so the element re-renders when the strings
 * change. The element owns its open/closed state; the clicks its triggers
 * emit bubble OUT of the custom element, and this wrapper maps the event back
 * to the part it owns to report it UP.
 */
import { createEffect } from "solid-js";

type PopoverElement = HTMLElement & {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  modal?: boolean;
  portalled?: boolean;
  autoFocus?: boolean;
};

export interface PopoverChange {
  readonly open: boolean;
}

export interface SpinPopoverProps {
  readonly title?: string;
  readonly description?: string;
  readonly defaultOpen?: boolean;
  readonly open?: boolean;
  readonly modal?: boolean;
  readonly portalled?: boolean;
  readonly autoFocus?: boolean;
  readonly onOpenChange?: (change: PopoverChange) => void;
}

export function SpinPopover(props: SpinPopoverProps) {
  let el: PopoverElement | undefined;

  createEffect(() => {
    if (!el) return;
    if (props.title !== undefined) el.title = props.title;
    if (props.description !== undefined) el.description = props.description;
    if (props.defaultOpen !== undefined) el.defaultOpen = props.defaultOpen;
    if (props.open !== undefined) el.open = props.open;
    if (props.modal !== undefined) el.modal = props.modal;
    if (props.portalled !== undefined) el.portalled = props.portalled;
    if (props.autoFocus !== undefined) el.autoFocus = props.autoFocus;
  });

  const onClick = (event: MouseEvent) => {
    if (!el) return;
    const trigger = (event.target as Element | null)?.closest("button[data-state]");
    if (!trigger) return;
    props.onOpenChange?.({ open: trigger.getAttribute("data-state") === "open" });
  };

  return (
    <spin-popover
      ref={(node) => {
        el = node as PopoverElement;
        if (props.title !== undefined) el.title = props.title;
        if (props.description !== undefined) el.description = props.description;
        if (props.defaultOpen !== undefined) el.defaultOpen = props.defaultOpen;
        if (props.open !== undefined) el.open = props.open;
        if (props.modal !== undefined) el.modal = props.modal;
        if (props.portalled !== undefined) el.portalled = props.portalled;
        if (props.autoFocus !== undefined) el.autoFocus = props.autoFocus;
      }}
      onClick={onClick}
    />
  );
}
