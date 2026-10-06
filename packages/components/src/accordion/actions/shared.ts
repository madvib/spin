export interface AccordionApi {
  getRootProps(): Record<string, unknown>;
  getItemProps(p: { value: string; disabled?: boolean }): Record<string, unknown>;
  getItemTriggerProps(p: { value: string; disabled?: boolean }): Record<string, unknown>;
  getItemContentProps(p: { value: string; disabled?: boolean }): Record<string, unknown>;
  getItemIndicatorProps(p: { value: string; disabled?: boolean }): Record<string, unknown>;
}

export const machineOf = (el: Element): AccordionApi | undefined => {
  const host = el.closest("accordion-root");
  if (!host) return undefined;
  return (host as unknown as Record<string, unknown>).__accordion as AccordionApi | undefined;
};

export const itemOf = (el: Element): { value: string; disabled?: boolean } => {
  const host = el.closest("[value]") ?? el;
  return {
    value: host.getAttribute("value") ?? "",
    disabled: host.hasAttribute("disabled") ? true : undefined,
  };
};
