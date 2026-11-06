/**
 * A prebuilt example in one persistent iframe.
 */
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { mode, theme } from "@spinjs/kit";
import { generateCss, parseTokens } from "@spinjs/spin/theme";
import { starterThemes } from "@spinjs/spin/theme/themes";

export interface ExamplePreviewProps {
  readonly kind: "markup" | "module";
  readonly html?: string;
  readonly url?: string;
  readonly subject?: string;
  readonly height?: string;
}

function themeCss(): string {
  const document =
    starterThemes[theme() as keyof typeof starterThemes] ?? starterThemes.spin;
  const parsed = parseTokens(document);
  return parsed.ok ? generateCss(parsed.tree) : "";
}

export function ExamplePreview(props: ExamplePreviewProps): JSX.Element {
  const [ready, setReady] = createSignal(false);
  let frame: HTMLIFrameElement | undefined;

  const send = (): void => {
    if (!ready()) return;
    const target = frame?.contentWindow;
    if (target === null || target === undefined) return;
    target.postMessage(
      {
        type: "spin-preview",
        kind: props.kind,
        ...(props.html === undefined ? {} : { html: props.html }),
        ...(props.url === undefined ? {} : { url: props.url }),
        ...(props.subject === undefined ? {} : { subject: props.subject }),
        themeCss: themeCss(),
        mode: mode(),
      },
      window.location.origin,
    );
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== frame?.contentWindow) return;
    const data: unknown = event.data;
    if (
      typeof data === "object" &&
      data !== null &&
      Reflect.get(data, "type") === "spin-shell-ready"
    ) {
      setReady(true);
    }
  };
  window.addEventListener("message", onMessage);
  onCleanup(() => window.removeEventListener("message", onMessage));

  createEffect(() => {
    void props.kind;
    void props.html;
    void props.url;
    void props.subject;
    void theme();
    void mode();
    void ready();
    send();
  });

  return (
    <div
      class={`relative w-full overflow-hidden rounded-lg border bg-surface shadow-sm ${
        props.height ?? "h-[24rem]"
      }`}
    >
      <iframe
        ref={(node) => {
          frame = node;
        }}
        title="Spin example"
        src="/examples/shell.html"
        class="h-full w-full border-0"
      />
    </div>
  );
}
