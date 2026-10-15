/**
 * Date-input connect: the DOM contract, the keyboard map, and the focus
 * reflex.
 *
 * The machine holds the fields and the active segment; everything that
 * needs the DOM lives here. That includes the two reflexes Zag runs from
 * its watch blocks, both keyed off what a send just did:
 *
 *   - the active segment moved → the segment it names takes focus;
 *   - the value moved → each segment's bag carries its text, and the
 *     spread machinery writes it.
 *
 * Segments render through `Intl.DateTimeFormat.formatToParts`, which is
 * what decides the order for the locale — month-first in en-US,
 * day-first in en-GB — so the view never hardcodes an order. The machine's
 * segment list (`segmentFields`) is the canonical month/day/year order;
 * the view maps each formatted part back to its field. Literals (slashes,
 * commas, spaces) render as aria-hidden spans between the spinbuttons.
 *
 * Parts are `date-input:<element id>:<part>`, as everywhere in this library.
 */

import {
  daysInMonth,
  FIELD_LIMITS,
  segmentFields,
  valueAsString,
  type DateGranularity,
  type DateInputContext,
  type DateInputEvent,
  type DateInputField,
  type DateValue,
} from "./date-input.machine.ts";

export interface DateInputConnectProps {
  readonly granularity: DateGranularity;
  readonly hourCycle: 12 | 24;
  readonly label: string;
  readonly name: string | undefined;
  readonly form: string | undefined;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly dir: "ltr" | "rtl";
  readonly autoFocus: boolean;
}

/** The element's imperative surface — the host's programmatic writes. */
export interface DateInputCommands {
  focus(): void;
  setValue(value: DateValue | null): void;
  clearValue(): void;
}

export interface DateInputApi extends DateInputCommands {
  readonly value: DateValue | null;
  readonly valueAsString: string;
  /** Whether a segment holds DOM focus — Zag's `focused` state, read for
   * the host (and for tests) the way the pin-input reports it. */
  readonly focused: boolean;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getSegments(): readonly DateSegmentView[];
  getSegmentProps(index: number): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

export interface DateInputService {
  readonly context: DateInputContext;
  readonly focused: boolean;
  send(event: DateInputEvent): void;
}

/** The behavioural props, read on demand: the connect lives as long as the
 * element does, so a snapshot would freeze the first read's values inside
 * the handlers it caches. */
export type ReadDateInputProps = () => DateInputConnectProps;

/** One rendered segment: a field the user edits, or a literal between them. */
export interface DateSegmentView {
  /** Position in the rendered row; unique, so the `for` keys on it. */
  readonly index: number;
  /** Position among editable fields; -1 for literals. Bags key on this. */
  readonly fieldIndex: number;
  readonly field: DateInputField | null;
  readonly text: string;
  readonly placeholder: boolean;
}

/** A bag cached until the signature of the fields it reads moves. */
interface BagMemo {
  sig: string;
  bag: Record<string, unknown>;
}

/** A binding re-reads the bag on every machine move, so a fresh bag per read
 * would detach and re-attach every listener each move. */
function cached(): (sig: string, build: () => Record<string, unknown>) => Record<string, unknown> {
  let sig = "";
  let bag: Record<string, unknown> | undefined;
  return (next: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    if (bag !== undefined && sig === next) return bag;
    sig = next;
    bag = build();
    return bag;
  };
}

/** Zag's `dataAttr`: the attribute is present when the condition holds and
 * absent otherwise. */
function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

const FIELD_LABELS: Readonly<Record<DateInputField, string>> = {
  year: "Year",
  month: "Month",
  day: "Day",
  hour: "Hour",
  minute: "Minute",
  second: "Second",
  dayPeriod: "AM/PM",
};

/** The placeholder a segment shows for an empty field — Zag's translations. */
function placeholderFor(field: DateInputField): string {
  switch (field) {
    case "year": return "yyyy";
    case "month": return "mm";
    case "day": return "dd";
    case "hour": return "hh";
    case "minute": return "mm";
    case "second": return "ss";
    case "dayPeriod": return "AM/PM";
  }
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/** The text a segment shows: the field's value, or its placeholder. */
export function segmentText(field: DateInputField, value: number | null, hourCycle: 12 | 24): string {
  if (value === null) return placeholderFor(field);
  switch (field) {
    case "year": return `${value}`.padStart(4, "0");
    case "dayPeriod": return value === 1 ? "PM" : "AM";
    case "hour": return hourCycle === 12 ? `${value}` : pad2(value);
    default: return pad2(value);
  }
}

const NAMESPACE = "date-input";

export function connectRobotDateInput(
  service: DateInputService,
  readProps: ReadDateInputProps,
  id: string,
  root: () => Element,
): DateInputApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const labelId = `${ownerId}:label`;
  const controlId = `${ownerId}:control`;
  const hiddenId = `${ownerId}:hidden`;

  const ctx = (): DateInputContext => service.context;

  const segmentId = (index: number): string => `${ownerId}:segment:${index}`;
  const focusAt = (index: number): void => {
    const node = root().ownerDocument.getElementById(segmentId(index));
    if (node instanceof HTMLElement) node.focus();
  };

  /**
   * Every event the view sends. The bridge's funnel (behind
   * `service.send`) fires the change callbacks; what is left is the view's
   * own reflex: the active segment moved, so it takes DOM focus.
   */
  const send = (event: DateInputEvent): void => {
    const before = ctx().activeSegment;
    service.send(event);
    const at = ctx().activeSegment;
    if (at !== before && at >= 0) focusAt(at);
  };

  // ---- per-segment handlers -----------------------------------------------

  interface SegmentHandlers {
    readonly onFocus: () => void;
    readonly onBlur: (event: FocusEvent) => void;
    readonly onKeyDown: (event: KeyboardEvent) => void;
    readonly onBeforeInput: (event: InputEvent) => void;
    readonly onPaste: (event: ClipboardEvent) => void;
  }

  const segmentHandlers = new Map<number, SegmentHandlers>();
  const handlersFor = (index: number): SegmentHandlers => {
    const hit = segmentHandlers.get(index);
    if (hit !== undefined) return hit;
    const made: SegmentHandlers = {
      onFocus: () => send({ type: "SEGMENT.FOCUS", index }),
      onBlur: (event: FocusEvent) => {
        // Focus moving to another segment of this date is not a blur: the
        // machine would drop to idle and back on every arrow step.
        const target = event.relatedTarget;
        if (target instanceof Element && root().contains(target)) return;
        send({ type: "SEGMENT.BLUR" });
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        if (event.isComposing === true || event.keyCode === 229) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const key = event.key;
        if (key.length === 1) {
          // Printable characters flow through `beforeinput`, which carries
          // the composed text on mobile — but a keydown without one (a
          // test, a password manager) still types.
          return;
        }
        switch (key) {
          case "ArrowUp":
            event.preventDefault();
            send({ type: "SEGMENT.ADJUST", index, amount: 1 });
            break;
          case "ArrowDown":
            event.preventDefault();
            send({ type: "SEGMENT.ADJUST", index, amount: -1 });
            break;
          case "ArrowLeft":
            event.preventDefault();
            send({ type: readProps().dir === "rtl" ? "SEGMENT.ARROW_RIGHT" : "SEGMENT.ARROW_LEFT" });
            break;
          case "ArrowRight":
            event.preventDefault();
            send({ type: readProps().dir === "rtl" ? "SEGMENT.ARROW_LEFT" : "SEGMENT.ARROW_RIGHT" });
            break;
          case "Backspace":
            event.preventDefault();
            send({ type: "SEGMENT.BACKSPACE" });
            break;
          case "Home":
            event.preventDefault();
            send({ type: "SEGMENT.HOME" });
            break;
          case "End":
            event.preventDefault();
            send({ type: "SEGMENT.END" });
            break;
        }
      },
      onBeforeInput: (event: InputEvent) => {
        const data = (event as InputEvent & { data?: unknown }).data;
        if (typeof data !== "string" || data.length === 0) return;
        event.preventDefault();
        send({ type: "SEGMENT.INPUT", index, input: data });
      },
      onPaste: (event: ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        if (text.length > 0) send({ type: "SEGMENT.PASTE", value: text });
      },
    };
    segmentHandlers.set(index, made);
    return made;
  };

  const rootBag = cached();
  const labelBag = cached();
  const controlBag = cached();
  const hiddenBag = cached();
  const segmentBags = new Map<number, BagMemo>();
  // Stable holders the for-rows close over: the text effect a row compiles
  // reads `row.text` off the render-time object, so a fresh object per read
  // would freeze every segment at its first text. The holders are rewritten
  // in place (like the carousel readout); the array is fresh each read so
  // the `for` still syncs and bumps the rows.
  const viewHolders = new Map<number, { text: string; placeholder: boolean }>();

  const segmentBag = (index: number, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = segmentBags.get(index);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    segmentBags.set(index, { sig, bag });
    return bag;
  };

  /** The formatter is the locale's segment order: format a known date and
   * read the parts back. `formatToParts` on January 22 gives every part a
   * distinct shape, so each part maps to exactly one field. */
  const orderFields = (): readonly DateInputField[] => {
    const current = readProps();
    const fields = segmentFields(current.granularity);
    try {
      const probe = new Date(Date.UTC(2024, 0, 22, 13, 44, 55));
      const parts = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        ...(fields.includes("hour") ? { hour: "numeric", hour12: current.hourCycle === 12 } : {}),
        ...(fields.includes("minute") ? { minute: "2-digit" } : {}),
        ...(fields.includes("second") ? { second: "2-digit" } : {}),
        timeZone: "UTC",
      }).formatToParts(probe);
      const seen: DateInputField[] = [];
      for (const part of parts) {
        const field = partToField(part.type, current.hourCycle);
        if (field !== null && fields.includes(field) && !seen.includes(field)) seen.push(field);
      }
      for (const field of fields) {
        if (!seen.includes(field)) seen.push(field);
      }
      return seen;
    } catch {
      return fields;
    }
  };

  const connect: DateInputApi = {
    get value(): DateValue | null {
      return ctx().value;
    },
    get valueAsString(): string {
      return valueAsString(ctx().value);
    },
    get focused(): boolean {
      return service.focused;
    },
    focus: () => focusAt(0),
    setValue: (value: DateValue | null) => send({ type: "VALUE.SET", value }),
    clearValue: () => send({ type: "VALUE.CLEAR" }),
    getRootProps: () =>
      rootBag(`${readProps().disabled}`, () => ({
        id: ownerId,
        dir: readProps().dir,
        "data-disabled": dataAttr(readProps().disabled),
      })),
    getLabelProps: () =>
      labelBag(`${readProps().label}`, () => ({
        id: labelId,
        htmlFor: segmentId(0),
        "data-disabled": dataAttr(readProps().disabled),
      })),
    getControlProps: () =>
      controlBag(`${service.focused}\u0000${readProps().disabled}`, () => ({
        id: controlId,
        role: "group",
        "aria-labelledby": labelId,
        "data-focus": dataAttr(service.focused),
        "data-disabled": dataAttr(readProps().disabled),
      })),
    getSegments: () => {
      const current = readProps();
      const ordered = orderFields();
      const views: DateSegmentView[] = [];
      let fieldIndex = 0;
      for (const field of ordered) {
        if (views.length > 0) {
          views.push({ index: views.length, fieldIndex: -1, field: null, text: "/", placeholder: true });
        }
        const value = ctx().fields[field];
        const at = views.length;
        const holder = viewHolders.get(at) ?? { text: "", placeholder: true };
        holder.text = segmentText(field, value, current.hourCycle);
        holder.placeholder = value === null;
        viewHolders.set(at, holder);
        views.push({
          index: at,
          fieldIndex,
          field,
          get text(): string {
            return viewHolders.get(at)?.text ?? "";
          },
          get placeholder(): boolean {
            return viewHolders.get(at)?.placeholder ?? true;
          },
        });
        fieldIndex += 1;
      }
      return views;
    },
    getSegmentProps: (index: number) => {
      const current = readProps();
      const ordered = orderFields();
      const field = ordered[index];
      if (field === undefined) return {};
      const value = ctx().fields[field];
      const limits = FIELD_LIMITS[field];
      const maxDay = field === "day" ? daysInMonth(ctx().fields.year, ctx().fields.month) : limits.max;
      const editable = !current.disabled && !current.readOnly;
      return segmentBag(
        index,
        [
          ctx().fields[field],
          service.focused && ctx().activeSegment === index,
          current.disabled,
          current.readOnly,
          current.invalid,
        ].join("\u0000"),
        () => ({
          id: segmentId(index),
          role: "spinbutton",
          tabIndex: current.disabled ? undefined : 0,
          "aria-label": FIELD_LABELS[field],
          "aria-valuenow": value ?? undefined,
          "aria-valuetext": value === null ? placeholderFor(field) : segmentText(field, value, current.hourCycle),
          "aria-valuemin": limits.min,
          "aria-valuemax": field === "day" ? maxDay : limits.max,
          "aria-invalid": current.invalid ? true : undefined,
          "aria-readonly": current.readOnly ? true : undefined,
          "aria-disabled": current.disabled ? true : undefined,
          inputMode: field === "dayPeriod" ? undefined : "numeric",
          "data-type": field,
          "data-placeholder-shown": dataAttr(value === null),
          "data-disabled": dataAttr(current.disabled),
          "data-focus": dataAttr(service.focused && ctx().activeSegment === index),
          contentEditable: editable ? "true" : undefined,
          spellcheck: editable ? "false" : undefined,
          ...handlersFor(index),
        }),
      );
    },
    getHiddenInputProps: () =>
      hiddenBag(`${valueAsString(ctx().value)}\u0000${readProps().name}`, () => {
        const current = readProps();
        return {
          id: hiddenId,
          type: "hidden",
          name: current.name,
          form: current.form,
          disabled: current.disabled,
          value: valueAsString(ctx().value),
        };
      }),
  };

  if (readProps().autoFocus) {
    queueMicrotask(() => focusAt(0));
  }

  return connect;
}

/** An Intl part names its field; the probe date keeps every value distinct. */
function partToField(type: string, hourCycle: 12 | 24): DateInputField | null {
  switch (type) {
    case "year": return "year";
    case "month": return "month";
    case "day": return "day";
    case "hour": return "hour";
    case "minute": return "minute";
    case "second": return "second";
    case "dayPeriod": return hourCycle === 12 ? "dayPeriod" : null;
    default: return null;
  }
}
