/**
 * The motion a theme owes a reader, declared once.
 *
 * An endless animation is watched, not answered: a loader's pulse, a
 * spinner, a status dot. Under this floor the loop reads as a strobe, so a
 * fast one is a defect rather than a character choice — which is why both
 * the starter themes' loop duration (`motion.duration.loop`, what every
 * endless animation in the system spends) and the browser check's own
 * threshold hold this number.
 *
 * The floor belongs to the LOOP, not to the scale: a theme's slowest
 * transition may be as slow as it likes, because a transition ends. What
 * cannot be slow is a loop, and the loop has a step of its own so a theme
 * that wants a two-second pulse says so without making every panel's
 * transition two seconds long.
 */

/** The floor below which an endless animation reads as a strobe. */
export const STROBE_FLOOR_MS = 250;

/**
 * The scale step every endless animation spends.
 *
 * The skeleton's pulse, and the `animate-spin` / `animate-ping` /
 * `animate-pulse` utilities. A theme that declares it owns the pace of every
 * loop in the system; a theme that does not falls back to its slowest
 * transition, which is the answer the system had before the loop step
 * existed.
 */
export const LOOP_DURATION = "motion.duration.loop";

/**
 * The loop step's own name, as the theme writes it under `motion.duration`.
 *
 * The step is a duration but not a TRANSITION duration: `duration-loop` is
 * not a utility, because a transition that takes as long as a pulse is not
 * what a transition is. The name is here so the rule that refuses it reads
 * the step from the contract rather than from a list kept beside it.
 */
export const LOOP_STEP = "loop";

/**
 * The step a loop falls back to when a theme declares no loop of its own.
 *
 * The old answer, kept as the fallback so a theme written before the loop
 * step existed keeps its loops rather than losing them.
 */
export const LOOP_FALLBACK = "motion.duration.slow";
