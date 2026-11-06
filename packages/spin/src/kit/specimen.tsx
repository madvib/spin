/**
 * One example, as a reader meets it: the specimen, the markup that produced
 * it, and the copy control for the markup.
 */
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { JSX } from "solid-js";
import {
  CODE_INK,
  type CodeToken,
  type CodeTokenType,
  formatExampleHtml,
  tokenizeCode,
  tokenizeHtml,
} from "./code.ts";
import { Marker } from "./section.tsx";

export {
  CODE_INK,
  type CodeToken,
  type CodeTokenType,
  formatExampleHtml,
  tokenizeCode,
  tokenizeHtml,
};

/** The word the copy control carries after it has copied. */
const COPIED_MS = 1200;

const SWITCH =
  "inline-flex min-h-0 items-center justify-center cursor-pointer rounded-sm border border-transparent bg-transparent px-2 py-1 normal-case type-caption text-muted shadow-none hover:bg-surface-raised focus:bg-surface-raised aria-[pressed=true]:bg-primary aria-[pressed=true]:text-on-primary";

const COPY_CONTROL =
  "absolute end-2 bottom-2 inline-flex min-h-0 items-center gap-1 cursor-pointer rounded-sm border bg-surface-raised px-2 py-1 normal-case type-caption text-muted opacity-0 pointer-events-none transition-opacity duration-fast group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto hover:border-strong";

const CODE_PRE =
  "max-h-[20rem] max-w-full whitespace-pre-wrap overflow-y-auto overflow-x-auto rounded-md border bg-surface p-4 type-code text-muted shadow-sm";
const SPECIMEN_PANEL =
  "min-h-[2rem] flex items-center justify-center rounded-md border bg-surface p-6 shadow-sm";
/** A panel whose content floats: menus, calendars, popovers, and crops escape the card instead of clipping inside it. */
const SPECIMEN_PANEL_OVERLAY =
  "min-h-[2rem] flex items-center justify-center overflow-visible rounded-md border bg-surface p-6 shadow-sm";

export interface SpecimenProps {
  /** The example's name, as the row's heading reads it. */
  readonly name: string;
  /** The markup, exactly as a consumer writes it. */
  readonly html: string;
  /** The authored recipe, as the code view shows and the copy control copies.
   * The mounted tag upgrades in place; the recipe is what a consumer copies
   * into their project (or takes with `spin component copy`). */
  readonly source?: string;
  /** Runs against the row after it mounts, for property-driven examples. */
  readonly onLoad?: string;
  /** The view the row opens on. */
  readonly initial?: "component" | "code";
  /** A rendered tree instead of the HTML, for a component-built preview. */
  readonly preview?: JSX.Element;
  /** Extra controls in the section header row. */
  readonly actions?: JSX.Element;
  /** A class on the inner stage host. */
  readonly stage?: string;
  /** Inline style on the inner stage host. */
  readonly stageStyle?: JSX.CSSProperties;
  /** A class on the outer specimen panel and code container. */
  readonly panelClass?: string;
  /** A class on the code view. */
  readonly codeClass?: string;
  /** The content floats above the card (menu, calendar, popover): let it overflow instead of clipping. */
  readonly overlay?: boolean;
}

function StageHost(props: {
  readonly html: string;
  readonly onLoad?: string;
  readonly class?: string;
  readonly style?: JSX.CSSProperties;
}): JSX.Element {
  let host!: HTMLDivElement;
  onMount(() => {
    const script = props.onLoad;
    if (script === undefined) return;
    const scopedDocument = new Proxy(host, {
      get(target, key) {
        const hasOwn = key in target;
        const receiver = hasOwn ? target : document;
        const value = Reflect.get(receiver, key, receiver);
        return typeof value === "function" ? value.bind(receiver) : value;
      },
    });
    new Function("document", script)(scopedDocument);
  });
  return (
    <div
      ref={host}
      class={props.class}
      style={props.style}
      innerHTML={props.html}
    />
  );
}

/**
 * One specimen: a marked heading, a component/code switch, the stage, the
 * markup, and a copy control that belongs to the markup.
 */
export function Specimen(props: SpecimenProps): JSX.Element {
  const [view, setView] = createSignal<"component" | "code">(
    props.initial ?? "component",
  );
  const [copied, setCopied] = createSignal(false);
  let timer: number | undefined;
  onCleanup(() => clearTimeout(timer));

  const formatted = createMemo(() =>
    formatExampleHtml(props.source ?? props.html)
  );
  const tokens = createMemo(() => tokenizeHtml(formatted()));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted());
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), COPIED_MS) as unknown as number;
  };

  return (
    <section class="mb-4">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 class="flex items-center gap-2">
            <Marker />
            {props.name}
          </h3>
        </div>
        <div class="flex items-center gap-2">
          {props.actions}
          <div class="flex items-center gap-1" role="group" aria-label="view">
            <button
              type="button"
              class={SWITCH}
              aria-pressed={view() === "component"}
              onClick={() => setView("component")}
            >
              component
            </button>
            <button
              type="button"
              class={SWITCH}
              aria-pressed={view() === "code"}
              onClick={() => setView("code")}
            >
              code
            </button>
          </div>
        </div>
      </div>
      <Show when={view() === "component"}>
        <div
          class={`${props.overlay === true ? SPECIMEN_PANEL_OVERLAY : SPECIMEN_PANEL} ${props.panelClass ?? ""}`}
        >
          <Show
            when={props.preview}
            fallback={
              <StageHost
                html={props.html}
                onLoad={props.onLoad}
                class={`flex w-full min-w-0 flex-col items-center ${props.stage ?? ""}`}
                style={props.stageStyle}
              />
            }
          >
            {props.preview}
          </Show>
        </div>
      </Show>
      <Show when={view() === "code"}>
        <div class={`group relative ${props.panelClass ?? ""}`}>
          <pre class={`${CODE_PRE} ${props.codeClass ?? ""}`}>
            <code class="break-all">
              <For each={tokens()}>
                {(token) => (
                  <span class={CODE_INK[token.type]}>{token.value}</span>
                )}
              </For>
            </code>
          </pre>
          <button
            type="button"
            onClick={copy}
            class={COPY_CONTROL}
            aria-label={`Copy the ${props.name} example`}
          >
            <i
              class={copied()
                ? "i-lucide-check icon-md"
                : "i-lucide-copy icon-md"}
              aria-hidden="true"
            />
            {copied() ? "copied" : "copy"}
          </button>
        </div>
      </Show>
    </section>
  );
}
