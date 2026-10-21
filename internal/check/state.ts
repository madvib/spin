/**
 * The state-contrast check: the contrast check, taken in the states a control
 * can be in.
 *
 * The contrast check measures a page at rest, and a page at rest is the state
 * a reader spends the least time in. A control is pointed at before it is
 * pressed, focused before it is used, and dimmed when it is out of reach — so
 * a fill that reads at rest can fail in every one of those. The failure is
 * invisible until a reader reaches for the control, which is exactly the moment
 * it matters.
 *
 * The states here are driven the way a reader drives them: the pointer moves
 * onto the control, the button goes down, the keyboard arrives. Nothing is
 * simulated — the browser paints the state, and the browser is asked what it
 * painted — so a state a stylesheet forgets to mention is still measured.
 *
 * Everything the page-side probes read lives inside the probes themselves: they
 * are serialised and shipped to the tab, so a constant left at module scope
 * would simply be missing in the browser.
 */

/** The state a subject was measured in. */
export type SubjectState =
  | "rest"
  | "hover"
  | "focus"
  | "focus-visible"
  | "active"
  | "disabled";

/**
 * The attribute the candidate scan marks its elements with. It travels as an
 * argument to the page-side probes rather than as a constant they read: the
 * probes are serialised, and a module-scope constant does not travel with them.
 */
export const STATE_MARK = "data-spin-state";

/** The selector that finds every marked candidate. */
export function allMarked(): string {
  return `[${STATE_MARK}]`;
}

/** The selector that finds one marked candidate, by its index. */
export function markedSelector(index: number): string {
  return `[${STATE_MARK}="${index}"]`;
}

/** One element the check can drive, and the states it can reach. */
export interface StateCandidate {
  /** Where the candidate sits: a path from the scope root. */
  readonly path: string;
  /** True when a pointer can reach the control. */
  readonly hoverable: boolean;
  /** True when the control is a thing a reader presses. */
  readonly activatable: boolean;
  /** True when the control can take focus. */
  readonly focusable: boolean;
  /** True when the control is out of reach: `:disabled` or `aria-disabled`. */
  readonly disabled: boolean;
}

/**
 * The pseudo-class that proves a state was reached.
 *
 * A state the browser refused to paint is not a state: a control under a
 * sticky header is never hovered, and a control the pointer cannot reach is
 * never active. Each state therefore carries the pseudo-class it must match,
 * and a measurement taken without it is thrown away rather than reported.
 */
export const STATE_PSEUDO: Readonly<Record<SubjectState, string>> = {
  rest: ":not(:hover):not(:active):not(:focus)",
  disabled: ":not(:hover):not(:active):not(:focus)",
  hover: ":hover",
  active: ":active",
  focus: ":focus:not(:focus-visible)",
  "focus-visible": ":focus-visible",
};

/**
 * The state a candidate rests in.
 *
 * A dead control rests dead: its resting appearance IS the disabled one, and
 * reporting it as "rest" would file a dimmed label among the healthy ones.
 */
export function restingState(candidate: StateCandidate): SubjectState {
  return candidate.disabled ? "disabled" : "rest";
}

/**
 * The states the check drives for a candidate, in the order it drives them.
 *
 * The order matters: the pointer is already on the control by the time the
 * press arrives, and the control is already focused by the time the keyboard
 * arrives, so each state is measured in the state a reader would meet it.
 */
export function statesFor(candidate: StateCandidate): readonly SubjectState[] {
  const states: SubjectState[] = [restingState(candidate)];
  if (candidate.hoverable) states.push("hover");
  if (candidate.activatable) states.push("active");
  if (candidate.focusable) states.push("focus", "focus-visible");
  return states;
}

/** The subject a state-contrast finding carries: where it is, and what it says. */
export function stateSubject(path: string, sample: string): string {
  return `${path} "${sample}"`;
}

/** The detail a state-contrast finding carries: the ratio, and the pair. */
export function stateDetail(
  ratio: number,
  color: string,
  background: string,
): string {
  return `${ratio.toFixed(2)}:1 — ${color} on ${background}`;
}

/**
 * Puts the keyboard on a candidate: the focus a reader arrives at with Tab.
 *
 * The keyboard modality is what makes the focus visible, so the caller sets it
 * first — a key press is enough — and this only moves the focus.
 */
export function stateFocus(
  options: { readonly index: number; readonly mark: string },
): boolean {
  const el = document.querySelectorAll<HTMLElement>(
    `[${options.mark}]`,
  )[options.index];
  if (el === undefined) return false;
  el.focus();
  return document.activeElement === el;
}

/**
 * Keeps the page as it was while the states are measured.
 *
 * A press is a press, and a press that lands on a link is a navigation: the
 * document the measurement was taken in is gone, and the measurement with it.
 * The check measures the states a control is in, not what activating it does,
 * so the click is stopped where it starts — before the app sees it and before
 * the browser follows it.
 */
export function stateGuard(): void {
  const marked = document.documentElement as HTMLElement & {
    __spinStateGuard?: boolean;
  };
  if (marked.__spinStateGuard === true) return;
  marked.__spinStateGuard = true;
  document.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

/**
 * Every element the state pass can drive, in document order.
 *
 * A candidate is an element that carries text and either answers the pointer
 * (a control) or paints a fill of its own (a badge, an alert, a chip) — the
 * two kinds of thing whose text sits on a background the theme chose. The
 * scope is the app's: its chrome is not its specimen, and the app knows which
 * is which.
 *
 * The candidates are marked as they are found, so a later probe can name one
 * by its index without a selector that has to survive the page being
 * re-rendered around it.
 */
export function stateCandidates(
  options: { readonly scope: string; readonly mark: string },
): readonly StateCandidate[] {
  const INTERACTIVE =
    "a[href], button, input:not([type=hidden]), summary, [role=button], " +
    "[role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], " +
    "[role=menuitem], [role=option]";
  const PRESSABLE =
    "a[href], button, summary, [role=button], [role=link], [role=tab]";
  const FOCUSABLE =
    "a[href], button, input:not([type=hidden]), select, textarea, summary, " +
    "[tabindex]:not([tabindex='-1'])";

  /** True when the element paints a fill of its own behind its text. */
  const paints = (style: CSSStyleDeclaration): boolean => {
    if (style.backgroundImage !== "none") return false;
    const value = style.backgroundColor;
    if (value === "transparent") return false;
    const match = /^rgba?\(([^)]+)\)$/.exec(value);
    // A colour the shorthand cannot read — oklch, color-mix, lab — is a
    // colour the browser painted with.
    if (match === null) return true;
    const parts = match[1]!.split(",").map((part) => parseFloat(part));
    const alpha = parts.length > 3 ? parts[3]! : 1;
    return alpha > 0;
  };

  /** Where an element sits, as a path from the scope root. */
  const pathOf = (el: Element, root: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node !== null && node !== root) {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (parent === null) {
        parts.unshift(tag);
        break;
      }
      const same = [...parent.children].filter((child) =>
        child.tagName === node!.tagName
      );
      const nth = same.length > 1
        ? `:nth-of-type(${same.indexOf(node) + 1})`
        : "";
      parts.unshift(`${tag}${nth}`);
      node = parent;
    }
    parts.unshift(root.tagName.toLowerCase());
    return parts.join(" > ");
  };

  const scope = document.querySelector(options.scope);
  if (scope === null) return [];
  const found: HTMLElement[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>("*")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (el.getClientRects().length === 0) continue;
    if (el.closest('[aria-hidden="true"]') !== null) continue;
    // A select is painted by the operating system: the colours a stylesheet
    // computes for it describe a dropdown nobody has opened.
    if (el.matches("select")) continue;
    const label = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    if (label === "") continue;
    const interactive = el.matches(INTERACTIVE);
    if (!interactive && !paints(style)) continue;
    found.push(el);
  }

  /**
   * True when the candidate carries text of its own.
   *
   * A candidate nested inside another one measures the labels inside it, so a
   * candidate whose every label belongs to a nested candidate measures nothing
   * of its own: it is a box the labels sit in, not a control with a label.
   */
  const carriesOwnText = (el: HTMLElement): boolean => {
    const nested = found.filter((other) => other !== el && el.contains(other));
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        (node.nodeValue ?? "").trim().length > 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null) continue;
      if (nested.some((other) => other.contains(parent))) continue;
      return true;
    }
    return false;
  };

  const candidates: StateCandidate[] = [];
  for (const el of found) {
    if (!carriesOwnText(el)) continue;
    // A control the browser refuses: it takes no focus, so a reader cannot
    // put it in that state. It still takes the pointer — a disabled button
    // is still under the cursor — so the hover and the press are states it
    // can be in.
    const refused = el.matches(":disabled");
    const dead = refused || el.matches('[aria-disabled="true"]');
    const style = getComputedStyle(el);
    candidates.push({
      path: pathOf(el, scope),
      hoverable: style.pointerEvents !== "none",
      activatable: el.matches(PRESSABLE),
      focusable: el.matches(FOCUSABLE) && !refused,
      disabled: dead,
    });
    el.setAttribute(options.mark, String(candidates.length - 1));
  }
  return candidates;
}
