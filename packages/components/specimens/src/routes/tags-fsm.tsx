import { createSignal } from "solid-js";
import { createSpin } from "@spin/hooks/solid";
import type { TagsCommands } from "../../../src/spin-tags-input/tags.bridge.ts";

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
  validate?: (details: { inputValue: string; value: readonly string[] }) => boolean;
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

  const tags = createSpin<TagsProps, TagsCommands>(
    "spin-tags-input-fsm",
    () => ({
      label: "Skills",
      placeholder: "Add a skill",
      defaultValue: SEED,
      delimiter: delimiter(),
      allowDuplicates: allowDuplicates(),
      allowOverflow: allowOverflow(),
      editable: editable(),
      disabled: disabled(),
      readOnly: readOnly(),
      blurBehavior: blur(),
      ...(maxed() ? { max: 2 } : {}),
      ...(controlled() ? { value: value() } : {}),
    }),
    {
      "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
        setValue([...event.detail.value]);
        setCount(event.detail.value.length);
      },
      "input-value-change": (event: CustomEvent<{ inputValue: string }>) => {
        setInputValue(event.detail.inputValue);
      },
      "highlight-change": (event: CustomEvent<{ highlightedValue: number | null }>) => {
        setHighlighted(String(event.detail.highlightedValue));
      },
      "value-invalid": (event: CustomEvent<{ reason: string }>) => {
        setInvalid(event.detail.reason);
        note(`value-invalid: ${event.detail.reason}`);
      },
    },
  );

  return (
    <section>
      <h2 class="text-xl mb-1">Tags input — forked FSM</h2>
      <p class="text-muted mb-4">
        Type and press Enter (or the delimiter) to add a tag. ArrowLeft from an empty caret walks the
        tags; Backspace and Delete remove; Enter on a highlighted tag edits it in place (double-click
        works too). Blur with text adds or clears per <code>blurBehavior</code>.
      </p>

      <form
        class="mb-4"
        onSubmit={(event) => {
          event.preventDefault();
          note("submit");
        }}
        onReset={() => note("form reset")}
      >
        <spin-tags-input-fsm
          id="tags-input"
          ref={(node: HTMLElement) => {
            tags.ref(node);
            const host = node as TagsElement;
            // The scope grammar types props as bool/string/int/string[], so
            // the behavior functions cross as element properties — the
            // bridge reads them off the root.
            host.sanitizeValue = (raw: string): string => raw.trim().toLowerCase();
            host.validate = ({ inputValue: raw }: { inputValue: string }) => raw !== "banned";
            host.translations = {
              tagAdded: (raw: string): string => `Added ${raw}`,
              tagDeleted: (raw: string): string => `Removed ${raw}`,
              noTagsSelected: "No tags",
            };
          }}
        />
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            type="reset"
            class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          >
            form reset
          </button>
          <button
            type="submit"
            class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          >
            submit
          </button>
        </div>
      </form>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          id="tags-add-value"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().addValue("kept")}
        >
          el.addValue("kept")
        </button>
        <button
          type="button"
          id="tags-add-elm"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().addValue("elm")}
        >
          el.addValue("elm")
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setMaxed((on) => !on)}
        >
          {maxed() ? "max: 2" : "max: unlimited"}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setAllowOverflow((on) => !on)}
        >
          allowOverflow: {String(allowOverflow())}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setDelimiter(delimiter() === "," ? ";" : ",")}
        >
          delimiter: {delimiter()}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setAllowDuplicates((on) => !on)}
        >
          allowDuplicates: {String(allowDuplicates())}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setEditable((on) => !on)}
        >
          editable: {String(editable())}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setBlur(blur() === "add" ? "" : "add")}
        >
          blurBehavior: {blur() === "add" ? "add" : "none"}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setDisabled((on) => !on)}
        >
          {disabled() ? "enable" : "disable"}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setReadOnly((on) => !on)}
        >
          readOnly: {String(readOnly())}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => setControlled((on) => !on)}
        >
          {controlled() ? "controlled: on" : "controlled: off"}
        </button>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().setValue(["deno", "fresh", "jsr"])}
        >
          el.setValue(["deno", "fresh", "jsr"])
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().addValue("elm")}
        >
          el.addValue("elm")
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().setValueAtIndex(0, "rewritten")}
        >
          el.setValueAtIndex(0, "rewritten")
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().clearValue()}
        >
          el.clearValue()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().setInputValue("typed")}
        >
          el.setInputValue("typed")
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().clearInputValue()}
        >
          el.clearInputValue()
        </button>
        <button
          type="button"
          class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text shadow-sm transition-colors duration-fast hover:bg-surface"
          onClick={() => tags.commands().focus()}
        >
          el.focus()
        </button>
      </div>

      <div class="text-sm text-muted font-mono">
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
          events:{" "}
          <span id="tags-events">{events().join(" · ") || "—"}</span>
        </div>
      </div>
    </section>
  );
}