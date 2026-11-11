import { createEffect, createSignal, onCleanup } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { combobox } from "@spinjs/components/combobox";
import {
  fontDeclarationFor,
  injectFontFaces,
  type CatalogFont,
  type SpinFontDeclaration,
} from "../lib/fonts.ts";
import { spinClient } from "../lib/client.ts";


/** The first family in a stack, without its quotes. */
export function firstFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

/** The stack a catalogue family resolves to. */
export function stackFor(font: CatalogFont): string {
  const category = font.category.toLowerCase();
  const fallback = category.includes("mono")
    ? "ui-monospace, monospace"
    : category === "serif" || category === "slab-serif"
    ? "Georgia, serif"
    : "ui-sans-serif, system-ui, sans-serif";
  return `"${font.family}", ${fallback}`;
}

export function ensureCatalogPreviewStyles(fonts: readonly CatalogFont[]): void {
  if (typeof document === "undefined") return;
  for (const font of fonts) {
    injectFontFaces([fontDeclarationFor(font)]);
  }
}

let client: ReturnType<typeof spinClient> | undefined;

function searchFonts(query: string): Promise<readonly CatalogFont[]> {
  client ??= spinClient();
  return client
    .then((ready) => ready.fonts.catalog({ query }))
    .then((listed) => listed as readonly CatalogFont[]);
}

export function FamilyField(props: {
  value: string;
  label: string;
  onCommit: (stack: string, font?: SpinFontDeclaration) => void;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const field = createSpinComponent(element, combobox);
  const [catalogMatches, setCatalogMatches] = createSignal<
    readonly CatalogFont[]
  >([]);
  const items = () =>
    catalogMatches().map((font) => ({
      value: stackFor(font),
      label: font.family,
      group: font.category,
    }));
  const displayFamily = () => firstFamily(props.value);
  let asked: string | undefined;
  let answered: string | undefined;
  const loadMatches = (raw: string) => {
    const query = firstFamily(raw);
    if (query === asked || query === answered) return;
    asked = query;
    void searchFonts(query).then((listed) => {
      if (asked !== query) return;
      answered = query;
      ensureCatalogPreviewStyles(listed);
      setCatalogMatches(listed);
    });
  };
  createEffect(() => {
    loadMatches(props.value);
  });
  createEffect(() => {
    const unbind = field.bind(
      {
        items: items(),
        allowCustomValue: true,
        inputValue: displayFamily(),
        placeholder: "Search fonts (e.g. Inter, Fraunces, JetBrains Mono)…",
      },
      {
        "input-value-change": (event: CustomEvent<{ inputValue: string }>) => {
          loadMatches(event.detail.inputValue);
        },
        "value-change": (event: CustomEvent<{ value: readonly string[] }>) => {
          const stack = event.detail.value[0];
          if (stack === undefined) return;
          const matched = catalogMatches().find(
            (font) => stackFor(font) === stack || font.family === stack,
          );
          props.onCommit(
            matched !== undefined ? stackFor(matched) : stack,
            matched !== undefined ? fontDeclarationFor(matched) : undefined,
          );
        },
      },
    );
    onCleanup(unbind);
  });
  createEffect(() => {
    field.commands.setInputValue(displayFamily());
  });
  createEffect(() => {
    const host = element() ?? null;
    if (host === null) return;
    const commit = (fromEnter: boolean) => {
      const input = host.querySelector("input");
      if (input === null) return;
      const typed = input.value.trim();
      if (typed === "") return;
      if (
        !fromEnter &&
        (typed === displayFamily() || typed === props.value)
      ) {
        return;
      }
      const matched = catalogMatches().find(
        (font) =>
          font.family.toLowerCase() === typed.toLowerCase() ||
          font.id.toLowerCase() === typed.toLowerCase(),
      );
      if (matched !== undefined) {
        props.onCommit(stackFor(matched), fontDeclarationFor(matched));
        return;
      }
      if (typed.includes(",")) {
        props.onCommit(typed);
        return;
      }
      const clean = typed.replace(/^["']|["']$/g, "");
      props.onCommit(`"${clean}", ui-sans-serif, system-ui, sans-serif`);
    };
    const onKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key === "Enter") commit(true);
    };
    const onFocusOut = () => commit(false);
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("focusout", onFocusOut);
    onCleanup(() => {
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("focusout", onFocusOut);
    });
  });
  return (
    <studio-font-combobox
      ref={(el: HTMLElement) => setElement(el)}
      class="w-full"
      prop:inputValue={displayFamily()}
      prop:allowCustomValue={true}
    />
  );
}

export default FamilyField;
