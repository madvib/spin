import { createEffect, createSignal } from "solid-js";
import { createSpinComponent } from "@spin/hooks/solid";
import type { TagsCommands } from "../../../src/spin-tags-input/tags.bindings.ts";
import { DEMO_BUTTON } from "../demo-button.ts";
import { DemoCard } from "../demo-card.tsx";
import { DemoControls } from "../demo-controls.tsx";
import { DemoReadout } from "../demo-readout.tsx";
import "./spin-tags-input.html";

type TagsElement = HTMLElement & {
  label?: string;
  placeholder?: string;
  defaultValue?: readonly string[];
  value?: readonly string[];
  inputValue?: string;
  max?: number;
  delimiter?: string;
  addOnPaste?: boolean;
  allowDuplicates?: boolean;
  allowOverflow?: boolean;
  editable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  blurBehavior?: string;
  /** Host-channel behavior functions (the scope grammar cannot type them). */
  sanitizeValue?: (value: string) => string;
  validate?: (
    details: { inputValue: string; value: readonly string[] },
  ) => boolean;
  translations?: {
    tagAdded?: (value: string) => string;
    tagDeleted?: (value: string) => string;
    noTagsSelected?: string;
  };
};

/** The props the route writes across the boundary. `max`/`value` are
 * conditional (the demo toggles them), so they stay optional. */
interface TagsProps {
  label: string;
  placeholder: string;
  defaultValue: readonly string[];
  delimiter: string;
  allowDuplicates: boolean;
  allowOverflow: boolean;
  editable: boolean;
  disabled: boolean;
  readOnly: boolean;
  blurBehavior: string;
  max?: number;
  value?: readonly string[];
}

const SEED = ["react", "solid"];

/**
 * Tags input on the forked FSM.
 *
 * The claim under test: Zag's four states (`idle`, `focused:input`,
 * `navigating:tag`, `editing:tag`) are genuine interaction modes rather
 * than timer holders, so they port one-for-one — and the machinery around
 * them (the live region, the form control, the input sync, the focus
 * reflexes) leaves as view work: stdlib actions on the parts plus the
 * connect's own handlers.
 */
export default function TagsFsm() {
  // The readouts start from the seed the route passes down, as a host's own
  // state would; the events keep them in step afterwards.
  const [value, setValue] = createSignal<string[]>([...SEED]);
  const [count, setCount] = createSignal(SEED.length);
  const [inputValue, setInputValue] = createSignal("");
  const [highlighted, setHighlighted] = createSignal("none");
  const [invalid, setInvalid] = createSignal("none");
  const [events, setEvents] = createSignal<string[]>([]);
  const [delimiter, setDelimiter] = createSignal(",");
  const [allowDuplicates, setAllowDuplicates] = createSignal(false);
  const [allowOverflow, setAllowOverflow] = createSignal(false);
  const [maxed, setMaxed] = createSignal(false);
  const [editable, setEditable] = createSignal(true);
  const [blur, setBlur] = createSignal("");
  const [disabled, setDisabled] = createSignal(false);
  const [readOnly, setReadOnly] = createSignal(false);
  const [controlled, setControlled] = createSignal(false);

  const note = (line: string): void => {
    setEvents((prev) => [line, ...prev].slice(0, 6));
  };

  const [tagsEl, setTagsEl] = createSignal<HTMLElement>();
  const tags = createSpinComponent<TagsCommands>(tagsEl);
  createEffect(() => {
    const ctl = tags();
    if (ctl === undefined) return undefined;
    return ctl.bind({
      label: "Skills",
      placeholder: "Add a skill",
      delimiter: delimiter(),
      allowDuplicates: allowDuplicates(),
      allowOverflow: allowOverflow(),
      editable: editable(),
      disabled: disabled(),
      readOnly: readOnly(),
      blurBehavior: blur(),
      ...(maxed() ? { max: 2 } : {}),
      ...(controlled() ? { value: value() } : {}),
    }, {
      "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
        setValue([...event.detail.value]);
        setCount(event.detail.value.length);
      },
      "input-value-change": (event: CustomEvent<{ inputValue: string }>) => {
        setInputValue(event.detail.inputValue);
      },
      "highlight-change": (
        event: CustomEvent<{ highlightedValue: number | null }>,
      ) => {
        setHighlighted(String(event.detail.highlightedValue));
      },
      "value-invalid": (event: CustomEvent<{ reason: string }>) => {
        setInvalid(event.detail.reason);
        note(`value-invalid: ${event.detail.reason}`);
      },
    });
  });
;

  return (
    <DemoCard
      title="Tags input"
      width="md"
      note="A real form, the behaviour props the machine reads, and the imperative commands."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          note("submit");
        }}
        onReset={() => note("form reset")}
      >
        <spin-tags-input
          id="tags-input"
          ref={(node: HTMLElement) => {
            setTagsEl(node);
            // The seed is read during build, so it lands before connect.
            (node as TagsElement).defaultValue = SEED;
            const host = node as TagsElement;
            // The scope grammar types props as bool/string/int/string[], so
            // the behavior functions cross as element properties — the
            // bridge reads them off the root.
            host.sanitizeValue = (raw: string): string =>
              raw.trim().toLowerCase();
            host.validate = ({ inputValue: raw }: { inputValue: string }) =>
              raw !== "banned";
            host.translations = {
              tagAdded: (raw: string): string => `Added ${raw}`,
              tagDeleted: (raw: string): string => `Removed ${raw}`,
              noTagsSelected: "No tags",
            };
          }}
        />
        <DemoControls>
          <button type="reset" class={DEMO_BUTTON}>
            form reset
          </button>
          <button type="submit" class={DEMO_BUTTON}>
            submit
          </button>
        </DemoControls>
      </form>

      <DemoControls>
        <button
          type="button"
          id="tags-add-value"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.addValue("kept")}
        >
          el.addValue("kept")
        </button>
        <button
          type="button"
          id="tags-add-elm"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.addValue("elm")}
        >
          el.addValue("elm")
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setMaxed((on) => !on)}
        >
          {maxed() ? "max: 2" : "max: unlimited"}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setAllowOverflow((on) => !on)}
        >
          allowOverflow: {String(allowOverflow())}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setDelimiter(delimiter() === "," ? ";" : ",")}
        >
          delimiter: {delimiter()}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setAllowDuplicates((on) => !on)}
        >
          allowDuplicates: {String(allowDuplicates())}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setEditable((on) => !on)}
        >
          editable: {String(editable())}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setBlur(blur() === "add" ? "" : "add")}
        >
          blurBehavior: {blur() === "add" ? "add" : "none"}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setDisabled((on) => !on)}
        >
          {disabled() ? "enable" : "disable"}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setReadOnly((on) => !on)}
        >
          readOnly: {String(readOnly())}
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => setControlled((on) => !on)}
        >
          {controlled() ? "controlled: on" : "controlled: off"}
        </button>
      </DemoControls>

      <DemoControls>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.setValue(["deno", "fresh", "jsr"])}
        >
          el.setValue(["deno", "fresh", "jsr"])
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.addValue("elm")}
        >
          el.addValue("elm")
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.setValueAtIndex(0, "rewritten")}
        >
          el.setValueAtIndex(0, "rewritten")
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.clearValue()}
        >
          el.clearValue()
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.setInputValue("typed")}
        >
          el.setInputValue("typed")
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.clearInputValue()}
        >
          el.clearInputValue()
        </button>
        <button
          type="button"
          class={DEMO_BUTTON}
          onClick={() => tags()?.commands.focus()}
        >
          el.focus()
        </button>
      </DemoControls>

      <DemoReadout>
        <div>
          value: <span id="tags-value">{value().join(", ") || "—"}</span>
        </div>
        <div>
          count: <span id="tags-count">{count()}</span>
        </div>
        <div>
          inputValue: <span id="tags-input-value">{inputValue() || "—"}</span>
        </div>
        <div>
          highlighted: <span id="tags-highlighted">{highlighted()}</span>
        </div>
        <div>
          invalid: <span id="tags-invalid">{invalid()}</span>
        </div>
        <div class="mt-2 text-xs">
          events: <span id="tags-events">{events().join(" · ") || "—"}</span>
        </div>
      </DemoReadout>
    </DemoCard>
  );
}
