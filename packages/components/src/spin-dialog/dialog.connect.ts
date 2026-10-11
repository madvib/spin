/**
 * Dialog connect: the DOM contract plus the reflexes, as actions.
 *
 * The three getters that matter are ordinary prop bags. What is new is the
 * `use:` keys: the content bag carries `use:focus-trap` and
 * `use:dismissable`, and the backdrop carries `use:dismissable`. The
 * machine supplies state (open/closed); the reflexes come from the stdlib;
 * the connect only wires which element gets which behavior and hands each
 * action its `send`.
 *
 * The three behaviors this port had to own are the focus trap, the
 * dismissable layer, and the scroll lock. Each is one stdlib action,
 * attached by name, tested on its own — the machine never touches the DOM.
 */

export interface DialogConnectProps {
  readonly modal: boolean;
  readonly trapFocus: boolean;
  readonly preventScroll: boolean;
  readonly closeOnEscape: boolean;
  readonly closeOnInteractOutside: boolean;
  readonly restoreFocus: boolean;
  readonly role: "dialog" | "alertdialog";
}

export interface DialogApi {
  readonly open: boolean;
  getTriggerProps(): Record<string, unknown>;
  getBackdropProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getTitleProps(): Record<string, unknown>;
  getDescriptionProps(): Record<string, unknown>;
  getCloseTriggerProps(): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

interface DialogService {
  readonly context: unknown;
  send(event: { type: string } & Record<string, unknown>): void;
}

export function connectRobotDialog(
  _service: DialogService,
  props: DialogConnectProps,
  _root: Element,
  id: string,
  send: Send,
  open: boolean,
): DialogApi {
  const ownerId = `dialog:${id}`;
  const close = (reason: "escape" | "outside" | "api"): void => send({ type: "CLOSE", reason });

  // `open`/`closed` state as attributes; the utility engine paints with
  // data-[state=open]:... variants — the styling channel, never styles.
  const stateAttrs = (): Record<string, unknown> => ({ "data-state": open ? "open" : "closed" });

  return {
    open,
    getTriggerProps: () => ({
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "data-state": open ? "open" : "closed",
      "aria-controls": `${ownerId}:content`,
      onClick: () => send({ type: "OPEN" }),
    }),
    getBackdropProps: () => ({
      id: `${ownerId}:backdrop`,
      "data-state": open ? "open" : "closed",
      hidden: !open,
      ...stateAttrs(),
      // The backdrop is the outside-click surface: activating here and on
      // the whole document is redundant — the document listener covers it,
      // and a backdrop listener would double-fire.
      onClick: () => {
        if (props.closeOnInteractOutside) close("outside");
      },
    }),
    getPositionerProps: () => ({ "data-state": open ? "open" : "closed" }),
    getContentProps: () => ({
      id: `${ownerId}:content`,
      role: props.role,
      "aria-modal": props.modal,
      "aria-labelledby": `${ownerId}:title`,
      "aria-describedby": `${ownerId}:description`,
      hidden: !open,
      "data-state": open ? "open" : "closed",
      // The reflexes, attached by name from the stdlib. Params are data;
      // the actions close over nothing but the node and what is passed.
      ...(props.trapFocus
        ? { "use:focus-trap": { onEscape: () => {
            if (props.closeOnEscape) close("escape");
          }, restore: props.restoreFocus } }
        : {}),
      ...(props.closeOnEscape || props.closeOnInteractOutside
        ? { "use:dismissable": {
            onOutside: () => {
              if (props.closeOnInteractOutside) close("outside");
            },
            ...(props.closeOnEscape
              ? { onEscape: () => close("escape") }
              : {}),
          } }
        : {}),
      ...(props.preventScroll ? { "use:scroll-lock": { enabled: open } } : {}),
    }),
    getTitleProps: () => ({ id: `${ownerId}:title` }),
    getDescriptionProps: () => ({ id: `${ownerId}:description` }),
    getCloseTriggerProps: () => ({
      type: "button",
      "aria-label": "Close dialog",
      onClick: () => close("api"),
    }),
  };
}
