export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly content: string;
  readonly disabled?: boolean | undefined;
}

export interface TabsFsmConnectProps {
  readonly orientation: "horizontal" | "vertical";
  readonly activationMode: "automatic" | "manual";
  readonly loopFocus: boolean;
  readonly deselectable: boolean;
}

export interface TabsFsmApi {
  readonly value: string | null;
  readonly focusedValue: string | null;
  getRootProps(): Record<string, unknown>;
  getListProps(): Record<string, unknown>;
  getTriggerProps(row: TreeNode): Record<string, unknown>;
  getContentProps(row: TreeNode): Record<string, unknown>;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

interface TabsService {
  readonly context: {
    value: string | null;
    focusedValue: string | null;
  };
  send(event: { type: string } & Record<string, unknown>): void;
}

function connectRobotTabs(
  service: TabsService,
  props: TabsFsmConnectProps,
  rows: readonly TreeNode[],
  _root: Element,
  send: Send,
): TabsFsmApi {
  // Navigation walks the ENABLED rows only: a disabled tab is skipped, per
  // the WAI-ARIA tabs pattern.
  const enabled = rows.filter((row) => row.disabled !== true);
  const at = enabled.findIndex((row) => row.value === service.context.focusedValue);

  const move = (index: number): void => {
    const bounded = props.loopFocus
      ? (index + enabled.length) % enabled.length
      : Math.max(0, Math.min(enabled.length - 1, index));
    const row = enabled[bounded];
    if (!row) return;
    send({ type: "TAB_FOCUS", value: row.value });
    // Automatic activation follows focus; manual waits for a click.
    if (props.activationMode === "automatic") send({ type: "SELECT_FOCUSED" });
  };

  const keydown = (_row: TreeNode) => (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        move(at + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        move(at - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(enabled.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return {
    value: service.context.value,
    focusedValue: service.context.focusedValue,
    getRootProps: () => ({ "data-orientation": props.orientation }),
    getListProps: () => ({
      role: "tablist",
      "aria-orientation": props.orientation,
      "data-orientation": props.orientation,
    }),
    getTriggerProps: (row) => ({
      role: "tab",
      id: `trigger-${row.value}`,
      "aria-controls": `content-${row.value}`,
      "aria-selected": service.context.value === row.value,
      tabindex: service.context.focusedValue === row.value ? 0 : -1,
      "data-state": service.context.value === row.value ? "active" : "inactive",
      "data-orientation": props.orientation,
      "data-disabled": row.disabled ? "" : undefined,
      disabled: row.disabled,
      onClick: () => send({ type: "TAB_CLICK", value: row.value }),
      onKeydown: keydown(row),
      onFocus: () => send({ type: "TAB_FOCUS", value: row.value }),
    }),
    getContentProps: (row) => ({
      role: "tabpanel",
      id: `content-${row.value}`,
      "aria-labelledby": `trigger-${row.value}`,
      tabindex: 0,
      hidden: service.context.value !== row.value,
      "data-state": service.context.value === row.value ? "open" : "closed",
    }),
  };
}

export { connectRobotTabs };
