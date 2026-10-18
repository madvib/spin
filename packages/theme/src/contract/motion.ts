/**
 * The motion a theme owes a reader, declared once.
 *
 * An endless animation is watched, not answered: a loader's pulse, a
 * spinner, a status dot. Under this floor the loop reads as a strobe, so a
 * fast one is a defect rather than a character choice — which is why both
 * the starter themes' loop duration (`motion.duration.slow`, what every
 * endless animation in the system spends) and the browser check's own
 * threshold hold this number.
 */
export const STROBE_FLOOR_MS = 250;
