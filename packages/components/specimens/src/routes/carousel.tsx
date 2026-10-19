import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import type { CarouselSlide } from "../../../src/spin-carousel/carousel.bindings.ts";

/** The element's host surface, from its machine-def's commands. */
interface CarouselCommands {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  setAutoplay: (on: boolean) => void;
}

const SLIDES: readonly CarouselSlide[] = [
  { value: "one", label: "Slide one", content: "The first slide's content." },
  { value: "two", label: "Slide two", content: "The second slide's content." },
  {
    value: "three",
    label: "Slide three",
    content: "The third slide's content.",
  },
  {
    value: "four",
    label: "Slide four",
    content: "The fourth slide's content.",
  },
  { value: "five", label: "Slide five", content: "The fifth slide's content." },
];

/**
 * Carousel on the forked FSM: the actions capstone.
 *
 * The machine holds a page index and a mode; every reflex the component
 * needs — the pointer drag, the autoplay clock, the per-slide intersection
 * observer, the layout observer — is a stdlib action attached through the
 * connect's bag, and the track is a native scroll-snap container so the
 * motion is the browser's.
 *
 * `allowMouseDrag` is authored up front rather than toggled: a `use:` action
 * attaches the first frame its key is in the bag, and the runtime has no
 * detach path, so a prop that gates one is a prop a host sets before the
 * carousel ever sees a pointer.
 */
export default function CarouselFsm() {
  const [index, setIndex] = createSignal(0);
  const [drag, setDrag] = createSignal("idle");
  const [rotation, setRotation] = createSignal("stopped");
  const [loop, setLoop] = createSignal(false);
  const [playing] = createSignal(false);
  const [carouselEl, setCarouselEl] = createSignal<HTMLElement>();

  const carousel = createSpinComponent<CarouselCommands>(carouselEl);
  createEffect(() => {
    const ctl = carousel();
    return ctl
      ? ctl.bind(
          {
            items: SLIDES,
            defaultIndex: 0,
            loop: loop(),
            autoplay: playing(),
            autoplayDelay: 2500,
            allowMouseDrag: true,
          },
          {
            "index-change": (event: CustomEvent<{ index: number }>) =>
              setIndex(event.detail.index),
            "drag-status-change": (event: CustomEvent<{ status: string }>) =>
              setDrag(event.detail.status),
            "autoplay-status-change": (event: CustomEvent<{ status: string }>) =>
              setRotation(event.detail.status),
          },
        )
      : undefined;
  });

  return (
    <DemoCard
      title="Five slides, native scroll-snap"
      width="full"
      note="allowMouseDrag is authored up front: a `use:` action attaches the first frame its key is in the bag, and the runtime has no detach path."
    >
      <DemoControls>
        <button
          id="carousel-prev"
          type="button"
          class={DEMO_BUTTON}
          onClick={() => carousel()?.commands.prev()}
        >
          el.prev()
        </button>
        <button
          id="carousel-next"
          type="button"
          class={DEMO_BUTTON}
          onClick={() => carousel()?.commands.next()}
        >
          el.next()
        </button>
        <button
          id="carousel-goto"
          type="button"
          class={DEMO_BUTTON}
          onClick={() => carousel()?.commands.goTo(4)}
        >
          el.goTo(4)
        </button>
        <button
          id="carousel-play"
          type="button"
          class={DEMO_BUTTON}
          onClick={() => carousel()?.commands.setAutoplay(!playing())}
        >
          {playing() ? "el.setAutoplay(false)" : "el.setAutoplay(true)"}
        </button>
        <button
          id="carousel-loop"
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setLoop((l) => !l)}
        >
          loop: {loop() ? "true" : "false"}
        </button>
        <button id="carousel-drag" type="button" class={DEMO_BUTTON}>
          drag the track →
        </button>
      </DemoControls>
      <spin-carousel ref={setCarouselEl} />
      <DemoReadout>
        <span class="mr-4">
          index: <span id="carousel-index">{index()}</span>
        </span>
        <span class="mr-4">
          drag: <span id="carousel-drag-status">{drag()}</span>
        </span>
        <span>
          rotation: <span id="carousel-rotation">{rotation()}</span>
        </span>
      </DemoReadout>
    </DemoCard>
  );
}
