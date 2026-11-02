/**
 * The checks panel, opened from anywhere.
 *
 * The overflow menu holds the verb; the panel lives beside the bar. A
 * counter rather than a boolean, so two opens in a row still open.
 */
import { createSignal } from "solid-js";

const [requests, setRequests] = createSignal(0);

/** Ask the checks panel to open. */
export function openChecks(): void {
  setRequests((n) => n + 1);
}

/** The open requests, as a signal the panel reads. */
export function checksRequests(): number {
  return requests();
}
