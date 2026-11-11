/**
 * The raw-type migration window: warn, then error.
 *
 * Removed raw type utilities (`text-*` sizes, `font-*` families/weights) warn
 * with a style suggestion until one minor version, and error after it — so
 * existing projects get a forcing function that does not brick them on
 * upgrade day. The window is a pure function of the shipping version against
 * the gate, with an explicit option winning over the default on both sides.
 */

/**
 * The minor that turns the window into an error: the first minor after the
 * removal ships. Compared as major/minor pairs, so preview suffixes never
 * decide anything — `0.1.0-preview.3` warns, `0.2.0` errors.
 */
export const RAW_TYPE_ERROR_SINCE = "0.2";

/** How removed raw type utilities report. */
export type RawTypeSeverity = "warn" | "error";

/**
 * The minor pair a version carries: `0.1.0-preview.3` is `[0, 1]`. Anything
 * unparseable is the earliest version — unknown versions warn rather than
 * brick a build they were never measured against.
 */
export function minorOf(version: string): [number, number] {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (match === null) return [0, 0];
  return [Number(match[1]), Number(match[2])];
}

/**
 * Whether a version has reached the error side of the window: its minor is
 * at or past the gate's.
 */
export function pastRawTypeGate(version: string): boolean {
  const [major, minor] = minorOf(version);
  const [gateMajor, gateMinor] = minorOf(RAW_TYPE_ERROR_SINCE);
  return major > gateMajor || (major === gateMajor && minor >= gateMinor);
}

/**
 * How removed raw type utilities report: the explicit option when the caller
 * names one, else the window the shipping version falls in.
 */
export function rawTypeSeverity(
  explicit?: RawTypeSeverity,
  version?: string,
): RawTypeSeverity {
  if (explicit !== undefined) return explicit;
  if (version !== undefined && pastRawTypeGate(version)) return "error";
  return "warn";
}
