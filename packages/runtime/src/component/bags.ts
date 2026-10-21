/** Shared connect machinery: attribute helpers and event guards. */

/** An attribute that is only present when the value is truthy. */
export function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

/** A composing keystroke is not a navigation. */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing === true || event.keyCode === 229;
}
