/**
 * The Solid side of the L4 controller loop for `<spin-tooltip>`.
 *
 * The controller passes machine props DOWN as property writes — the live
 * prop contract of `define`, so the element re-renders when they change.
 * The element owns its open/close state via the Zag tooltip machine.
 */
import { createEffect } from "solid-js";

type TooltipElement = HTMLElement & {
  openDelay?: number;
  closeDelay?: number;
  interactive?: boolean;
  disabled?: boolean;
  defaultOpen?: boolean;
};

export interface SpinTooltipProps {
  readonly openDelay?: number;
  readonly closeDelay?: number;
  readonly interactive?: boolean;
  readonly disabled?: boolean;
  readonly defaultOpen?: boolean;
}

export function SpinTooltip(props: SpinTooltipProps) {
  let el: TooltipElement | undefined;

  createEffect(() => {
    if (!el) return;
    if (props.openDelay !== undefined) el.openDelay = props.openDelay;
    if (props.closeDelay !== undefined) el.closeDelay = props.closeDelay;
    if (props.interactive !== undefined) el.interactive = props.interactive;
    if (props.disabled !== undefined) el.disabled = props.disabled;
    if (props.defaultOpen !== undefined) el.defaultOpen = props.defaultOpen;
  });

  return (
    <spin-tooltip
      ref={(node) => {
        el = node as TooltipElement;
        if (props.openDelay !== undefined) el.openDelay = props.openDelay;
        if (props.closeDelay !== undefined) el.closeDelay = props.closeDelay;
        if (props.interactive !== undefined) el.interactive = props.interactive;
        if (props.disabled !== undefined) el.disabled = props.disabled;
        if (props.defaultOpen !== undefined) el.defaultOpen = props.defaultOpen;
      }}
    />
  );
}
