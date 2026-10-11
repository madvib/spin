import { createSignal, For, onCleanup } from "solid-js";
import { createSpin } from "@spin/hooks/solid";

/** The derived state the element publishes through its machine-def seam. */
interface ScrollAreaReadout {
  isAtTop: boolean;
  isAtBottom: boolean;
  isAtLeft: boolean;
  isAtRight: boolean;
  hasOverflowX: boolean;
  hasOverflowY: boolean;
  getScrollProgress: () => { x: number; y: number };
  getScrollbarState: (props?: { orientation?: "vertical" | "horizontal" }) => {
    hovering: boolean;
    dragging: boolean;
    scrolling: boolean;
    hidden: boolean;
  };
}

/** The commands the same seam publishes. */
interface ScrollAreaCommands {
  scrollTo: (details: { top?: number; left?: number; behavior?: ScrollBehavior }) => void;
  scrollToEdge: (details: { edge: "top" | "right" | "bottom" | "left"; behavior?: ScrollBehavior }) => void;
}

interface Edges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  x: number;
  y: number;
}

interface Bars {
  y: boolean;
  x: boolean;
  scrolling: string;
}

const ROWS: readonly string[] = [
  "Alpha — the first row, tall enough to wrap onto a second line of prose.",
  "Beta — a row with a long unbroken token: supercalifragilisticexpialidociousantidisestablishmentarianism.",
  "Gamma — the middle of the content, where a scrolled thumb parks.",
  "Delta — enough text to push the box past every edge it has.",
  "Epsilon — the row a track click jumps to.",
  "Zeta — the row a wheel over a bar reaches.",
  "Eta — the row the bottom edge reports.",
  "Theta — the last row of the overflowing content.",
];

/**
 * Scroll area on the forked FSM: the one component whose state is entirely
 * derived from layout.
 *
 * The claim under test: the view measures the boxes and reports each reading
 * as an event payload, the machine holds those readings and decides what a new
 * one means — which bars overflow, which sides the viewport rests on, which
 * axes are scrolling — and the continuous values travel as CSS custom
 * properties the utilities beside them consume. Nothing in the machine touches
 * the DOM, and the two dwell timers Zag keeps are the `autoplay` action's
 * interval on each bar.
 */
export default function ScrollAreaFsm() {
  const both = createSpin<{ dir: string }, ScrollAreaCommands>(
    "spin-scroll-area-fsm",
    () => ({ dir: "ltr" }),
  );
  const verticalOnly = createSpin<{ dir: string }, ScrollAreaCommands>(
    "spin-scroll-area-fsm",
    () => ({ dir: "ltr" }),
  );

  const [edges, setEdges] = createSignal<Edges>({
    top: true,
    bottom: false,
    left: true,
    right: false,
    x: 0,
    y: 0,
  });
  const [bars, setBars] = createSignal<Bars>({ y: true, x: true, scrolling: "" });

  /** The api read on a clock: the derived state reaches a host the same way
   * it reaches this route — through the element's own api. */
  onCleanup(watchEdges(both.commands, setEdges));
  onCleanup(watchBars(verticalOnly.commands, setBars));

  const button =
    "rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface";
  const at = (): Edges => edges();
  const state = (): Bars => bars();

  return (
    <section>
      <h2 class="text-xl mb-1">Scroll area — forked FSM</h2>
      <p class="text-muted mb-4">
        Hover either box to light its bars; wheel over a bar scrolls it; press a track to jump the thumb
        there; drag a thumb to scrub. The bars fade in on hover and while an axis scrolls, and a bar whose
        axis cannot scroll is not there at all — the corner appears only when both overflow.
      </p>

      <div class="grid gap-8 sm:grid-cols-2">
        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Both axes overflow</h3>
          <div class="h-[10rem] [width:16rem]">
            <spin-scroll-area-fsm id="both" ref={both.ref} prop:dir="ltr" class="block h-full">
              <div class="w-max">
                <For each={ROWS}>
                  {(row, index) => <p class="py-2 px-2 text-sm text-text">{`${index() + 1}. ${row}`}</p>}
                </For>
              </div>
            </spin-scroll-area-fsm>
          </div>
          <div class="mt-2 text-sm text-muted font-mono tabular-nums">
            top: <span id="both-top">{at().top ? "yes" : "no"}</span> · bottom:{" "}
            <span id="both-bottom">{at().bottom ? "yes" : "no"}</span> · left:{" "}
            <span id="both-left">{at().left ? "yes" : "no"}</span> · right:{" "}
            <span id="both-right">{at().right ? "yes" : "no"}</span> · x:{" "}
            <span id="both-x">{at().x.toFixed(2)}</span> · y: <span id="both-y">{at().y.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-medium text-text">Vertical only</h3>
          <div class="h-[10rem] w-full">
            <spin-scroll-area-fsm id="vertical" ref={verticalOnly.ref} prop:dir="ltr" class="block h-full">
              <div class="break-words">
                <For each={ROWS}>
                  {(row, index) => <p class="py-2 px-2 text-sm text-text">{`${index() + 1}. ${row}`}</p>}
                </For>
              </div>
            </spin-scroll-area-fsm>
          </div>
          <div class="mt-2 text-sm text-muted font-mono tabular-nums">
            vertical bar: <span id="vertical-bar">{state().y ? "yes" : "no"}</span> · horizontal bar:{" "}
            <span id="vertical-xbar">{state().x ? "yes" : "no"}</span> · scrolling:{" "}
            <span id="vertical-scrolling">{state().scrolling === "" ? "none" : state().scrolling}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-8">
        <button type="button" class={button} onClick={() => both.commands().scrollToEdge({ edge: "bottom" })}>
          scrollToEdge(bottom)
        </button>
        <button type="button" class={button} onClick={() => both.commands().scrollToEdge({ edge: "right" })}>
          scrollToEdge(right)
        </button>
        <button type="button" class={button} onClick={() => both.commands().scrollTo({ top: 0, left: 0 })}>
          scrollTo(0, 0)
        </button>
      </div>
    </section>
  );
}

/** One element's edges and progress, read on a clock into the route. */
function watchEdges(commands: () => unknown, set: (value: Edges) => void): () => void {
  const timer = setInterval(() => {
    const node = commands() as unknown as ScrollAreaReadout | undefined;
    if (node === undefined || typeof node.getScrollProgress !== "function") return;
    const progress = node.getScrollProgress();
    set({
      top: node.isAtTop,
      bottom: node.isAtBottom,
      left: node.isAtLeft,
      right: node.isAtRight,
      x: progress.x,
      y: progress.y,
    });
  }, 100);
  return () => clearInterval(timer);
}

/** One element's bars, read on a clock into the route. */
function watchBars(commands: () => unknown, set: (value: Bars) => void): () => void {
  const timer = setInterval(() => {
    const node = commands() as unknown as ScrollAreaReadout | undefined;
    if (node === undefined || typeof node.getScrollProgress !== "function") return;
    const vertical = node.getScrollbarState({ orientation: "vertical" });
    const horizontal = node.getScrollbarState({ orientation: "horizontal" });
    set({
      y: !vertical.hidden,
      x: !horizontal.hidden,
      scrolling: vertical.scrolling ? "y" : horizontal.scrolling ? "x" : "none",
    });
  }, 100);
  return () => clearInterval(timer);
}
