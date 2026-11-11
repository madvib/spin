/**
 * The docs' live playground: a Jibe embed running Spin + SolidJS/React/Vue/Svelte/Vanilla.
 *
 * Mounted through `createJibeEmbed` from `@jibe/embed/sdk`. `vent.config.ts`
 * runs the framework plugin and `spin:stylesheet` using `@spinjs/preset`
 * inside the Jibe workspace; COOP/COEP headers on the docs server enable
 * `SharedArrayBuffer` for Rolldown inside the Jibe iframe.
 */
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { createGenerator } from "@unocss/core";
import {
  createJibeEmbed,
  type EmbedChrome,
  type JibeEmbedHandle,
} from "@jibe/embed/sdk";
import { spinPreset } from "@spinjs/preset";
import { mode, palette, spacing, theme } from "@spinjs/kit";
import {
  demoPalettes,
  demoSpacings,
  designLanguages,
  isDesignLanguage,
  mergeThemeDocuments,
  resolveTheme,
  type ThemeDocument,
} from "@spinjs/theme";
import { SUBJECT_HTML, type Subject } from "../../examples/shared.ts";

export type PlaygroundFramework =
  | "vanilla"
  | "solid"
  | "react"
  | "vue"
  | "svelte";

interface FrameworkWiring {
  readonly ext: "ts" | "tsx";
  readonly plugin:
    | {
        readonly pkg: string;
        readonly statement: string;
        readonly call: string;
      }
    | undefined;
  readonly deps: Readonly<Record<string, string>>;
}

const FRAMEWORK_WIRING: Readonly<Record<PlaygroundFramework, FrameworkWiring>> =
  {
    vanilla: { ext: "ts", plugin: undefined, deps: {} },
    solid: {
      ext: "tsx",
      plugin: {
        pkg: "vite-plugin-solid",
        statement: 'import solid from "vite-plugin-solid";\n',
        call: "solid()",
      },
      deps: { "solid-js": "1.9.17", "vite-plugin-solid": "2.11.14" },
    },
    react: {
      ext: "tsx",
      plugin: undefined,
      deps: {
        react: "19.0.0",
        "react-dom": "19.0.0",
      },
    },
    vue: {
      ext: "ts",
      plugin: {
        pkg: "@vitejs/plugin-vue",
        statement: 'import vue from "@vitejs/plugin-vue";\n',
        call: "vue()",
      },
      deps: { vue: "3.5.13", "@vitejs/plugin-vue": "6.0.1" },
    },
    svelte: {
      ext: "ts",
      plugin: {
        pkg: "@sveltejs/vite-plugin-svelte",
        statement: 'import { svelte } from "@sveltejs/vite-plugin-svelte";\n',
        call: "svelte()",
      },
      deps: { svelte: "5.28.0", "@sveltejs/vite-plugin-svelte": "6.2.0" },
    },
  };

function ventConfig(framework: PlaygroundFramework, themeJson: string): string {
  const wiring = FRAMEWORK_WIRING[framework];
  const pluginImport = wiring.plugin?.statement ?? "";
  const pluginCall =
    wiring.plugin === undefined ? "" : `${wiring.plugin.call}, `;
  return `import { defineVentConfig } from "vent/config";
${pluginImport}import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spinjs/preset";
import { readdirSync, readFileSync } from "node:fs";

// Baked at generation time: the transform must not read theme.json from
// the workspace at bundle time (stale across applies). New theme bytes
// mean new config bytes, so the config cache cannot serve a stale closure.
const SPIN_THEME = ${themeJson};

const read = (path: string): string => String(readFileSync(path, "utf8"));

function collect(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) {
      collect(path, out);
      continue;
    }
    if (/\\.(ts|tsx|js|jsx|vue|svelte|html)$/.test(path)) out.push(read(path));
  }
}
let generator: Awaited<ReturnType<typeof createGenerator>> | null = null;
const stylesheet = {
  name: "spin:stylesheet",
  async transform(code: string, id: string) {
    if (!/(^|\\/)src\\/main(\\.[^\\/]+)?\\.(tsx|ts|jsx|js)$/.test(id)) return null;
    const sources = [read("index.html")];
    collect("src", sources);
    if (generator === null) {
      generator = await createGenerator({
        presets: [spinPreset({ theme: SPIN_THEME })],
      });
    }
    const { css } = await generator.generate(sources.join("\\n"), {
      preflights: true,
    });
    const boot =
      "const spinStyle = document.createElement('style');\\n" +
      "spinStyle.dataset.spin = 'build';\\n" +
      "spinStyle.textContent = " + JSON.stringify(css) + ";\\n" +
      "document.head.append(spinStyle);\\n";
    return { code: boot + code, map: null };
  },
};

export default defineVentConfig({
  provider: "jspm.io",
  plugins: [${pluginCall}stylesheet],
});
`;
}

let spinModulesPromise: Promise<Record<string, string>> | undefined;

function spinModules(): Promise<Record<string, string>> {
  spinModulesPromise ??= (async () => {
    const [preset, runtime] = await Promise.all([
      fetch("/jibe/spin-preset.js").then((response) => response.text()),
      fetch("/jibe/spin-runtime.js").then((response) => response.text()),
    ]);
    return { "@spinjs/preset": preset, "@spinjs/components/runtime": runtime };
  })();
  return spinModulesPromise;
}

const STUDIO_ORIGIN =
  typeof window === "undefined" ? "" : window.location.origin;

interface StudioCall {
  readonly id: number;
  readonly path: string;
  readonly body: string;
}

interface StudioTheme {
  readonly name: string;
  readonly text: string;
  readonly file: string | null;
}

export function activeFileForFramework(
  framework: PlaygroundFramework,
): string {
  switch (framework) {
    case "solid":
    case "react":
      return "src/App.tsx";
    case "vue":
      return "src/App.vue";
    case "svelte":
      return "src/App.svelte";
    case "vanilla":
      return "index.html";
  }
}

function indentMarkup(markup: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return markup
    .trim()
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}

function jsxMarkup(markup: string, framework: "solid" | "react"): string {
  let out = markup.trim().replace(
    `onclick="this.closest('card').querySelector('dialog').showModal()"`,
    `onClick={(e) => e.currentTarget.closest("card")?.querySelector("dialog")?.showModal()}`,
  );
  if (framework === "react") {
    out = out.replaceAll("for=", "htmlFor=");
  }
  return indentMarkup(out, 4);
}

function themeSuffix(themeName: string, modeName: string): string {
  const clean = (part: string): string =>
    part.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${clean(themeName)}--${clean(modeName)}`;
}

function workspaceFiles(
  framework: PlaygroundFramework,
  subject: Subject,
  entry: string,
): Record<string, string> {
  const wiring = FRAMEWORK_WIRING[framework];
  const markup = SUBJECT_HTML[subject];
  const markRuntime = `document.documentElement.dataset.runtime = ${JSON.stringify(framework)};\n`;
  const common = {
    "package.json": `${JSON.stringify(
      {
        name: "spin-playground",
        private: true,
        type: "module",
        dependencies: { "@unocss/core": "66.10.5", ...wiring.deps },
      },
      null,
      2,
    )}\n`,
    "src/process-shim.ts": `export const env = { NODE_ENV: "production" };
export const platform = "browser";
export const cwd = (): string => "/";
export const versions = {};
export default { env, platform, cwd, versions };
`,
  };

  switch (framework) {
    case "solid":
      return {
        ...common,
        [entry]: `${markRuntime}import { render } from "solid-js/web";\nimport { App } from "../App.tsx";\n\nconst root = document.getElementById("app");\nif (root !== null) render(() => <App />, root);\n`,
        "src/App.tsx": `export function App() {\n  return (\n${jsxMarkup(markup, "solid")}\n  );\n}\n`,
      };
    case "react":
      return {
        ...common,
        [entry]: `${markRuntime}import { createRoot } from "react-dom/client";\nimport { App } from "../App.tsx";\n\nconst root = document.getElementById("app");\nif (root !== null) createRoot(root).render(<App />);\n`,
        "src/App.tsx": `export function App() {\n  return (\n${jsxMarkup(markup, "react")}\n  );\n}\n`,
      };
    case "vue":
      return {
        ...common,
        [entry]: `${markRuntime}import { createApp } from "vue";\nimport App from "../App.vue";\n\nconst root = document.getElementById("app");\nif (root !== null) createApp(App).mount(root);\n`,
        "src/App.vue": `<template>\n${indentMarkup(markup, 2)}\n</template>\n`,
      };
    case "svelte":
      return {
        ...common,
        [entry]: `${markRuntime}import { mount } from "svelte";\nimport App from "../App.svelte";\n\nconst root = document.getElementById("app");\nif (root !== null) mount(App, { target: root });\n`,
        "src/App.svelte": `${markup.trim()}\n`,
      };
    case "vanilla":
      return {
        ...common,
        [entry]: `${markRuntime}`,
      };
  }
}

async function hostSeedFiles(): Promise<Record<string, string>> {
  const modules = await spinModules();
  return {
    "vent.json": `${JSON.stringify(
      {
        importMap: {
          process: "/src/process-shim.ts",
        },
        __embed_modules__: modules,
      },
      null,
      2,
    )}\n`,
  };
}

export function resolveSpinJibeTheme(
  activeTheme: string,
  activeMode: string,
  activePalette = "",
  activeSpacing = "",
) {
  let doc = isDesignLanguage(activeTheme)
    ? designLanguages[activeTheme]
    : designLanguages.editorial;
  if (activePalette !== "") {
    const facet = demoPalettes[activePalette];
    if (facet !== undefined) doc = mergeThemeDocuments(doc, facet);
  }
  if (activeSpacing !== "") {
    const facet = demoSpacings[activeSpacing];
    if (facet !== undefined) doc = mergeThemeDocuments(doc, facet);
  }
  const fallback = resolveTheme(designLanguages.editorial, activeMode).values;
  const resolved = resolveTheme(doc, activeMode);
  const str = (key: string): string => {
    const val = resolved.values[key];
    if (typeof val === "string" && val.length > 0) return val;
    const base = fallback[key];
    return typeof base === "string" && base.length > 0 ? base : "";
  };
  return {
    preset: (activeMode === "dark" ? "dark" : "light") as "dark" | "light",
    bg: str("color.surface"),
    surface: str("color.surface-raised"),
    fg: str("color.text"),
    muted: str("color.text-muted"),
    border: str("color.border"),
    accent: str("color.primary"),
    previewBg: str("color.surface"),
  };
}

interface LiveConfigurePatch {
  readonly view?: "split" | "preview" | "code";
  readonly chrome?: "studio" | "preview" | "minimal" | "none";
  readonly activeFile?: string;
  readonly readOnly?: boolean;
  readonly theme?: {
    readonly preset?: "dark" | "light";
    readonly bg?: string;
    readonly fg?: string;
    readonly accent?: string;
    readonly surface?: string;
    readonly muted?: string;
    readonly border?: string;
    readonly previewBg?: string;
  };
}

type LiveJibeEmbedHandle = JibeEmbedHandle;

export interface SpinEmbedProps {
  readonly files: Readonly<Record<string, string>>;
  readonly activeFile?: string;
  readonly visibleFiles?: ReadonlyArray<string>;
  readonly view?: "split" | "preview" | "code";
  readonly chrome?: EmbedChrome;
  readonly studio?: boolean;
  readonly framework?: PlaygroundFramework;
  readonly subject?: Subject;
  readonly height?: string;
  readonly onUpdating?: (updating: boolean) => void;
}

export function SpinEmbed(props: SpinEmbedProps): JSX.Element {
  const embedOrigin =
    (import.meta.env["VITE_JIBE_EMBED_ORIGIN"] as string | undefined) ??
    "https://embed.jibe.run";
  const [ready, setReady] = createSignal(false);
  const [studioOpen, setStudioOpen] = createSignal(false);
  let container: HTMLDivElement | undefined;
  let studioFrame: HTMLIFrameElement | undefined;
  let activeHandle: LiveJibeEmbedHandle | undefined;
  const [liveHandle, setLiveHandle] = createSignal<
    LiveJibeEmbedHandle | undefined
  >(undefined);
  let studioConnected = false;

  const readThemes = async (
    handle: JibeEmbedHandle,
  ): Promise<StudioTheme[]> => {
    const listed = await handle.client.listFiles({});
    const paths = listed.files.filter(
      (path) => path.startsWith("spin/") && path.endsWith(".json"),
    );
    const themes: StudioTheme[] = [];
    for (const path of paths) {
      const read = await handle.client.readFile({ path });
      if ("text" in read) {
        themes.push({
          name: path.slice("spin/".length, -".json".length),
          text: read.text,
          file: path,
        });
      }
    }
    if (themes.length === 0) {
      const name = theme();
      themes.push({
        name,
        text: JSON.stringify(
          isDesignLanguage(name) ? designLanguages[name] : designLanguages.editorial,
          null,
          2,
        ),
        file: null,
      });
    }
    return themes;
  };

  const studioRpc = async (
    path: string,
    input: Record<string, unknown>,
  ): Promise<unknown> => {
    const handle = activeHandle;
    if (handle === undefined) return null;
    switch (path) {
      case "project/themes/list":
        return readThemes(handle);
      case "project/themes/read": {
        const name = String(input["name"] ?? "");
        const read = await handle.client.readFile({
          path: `spin/${name}.json`,
        });
        return { text: "text" in read ? read.text : null };
      }
      case "project/themes/write": {
        const name = String(input["name"] ?? "");
        const text = String(input["text"] ?? "");
        const target = `spin/${name}.json`;
        const listed = await handle.client.listFiles({});
        if (listed.files.includes(target)) {
          await handle.client.writeFile({ path: target, text });
        } else {
          await handle.client.addFile({ path: target, text });
        }
        return { error: null };
      }
      case "project/current": {
        const themes = await readThemes(handle);
        return {
          root: "/",
          spin: true,
          uno: true,
          wired: true,
          themes: themes.map((entry) => entry.name),
        };
      }
      case "preview/css": {
        const name = String(input["name"] ?? "editorial");
        const text = String(input["text"] ?? "");
        try {
          const document = JSON.parse(text) as ThemeDocument;
          const generator = await createGenerator({
            presets: [spinPreset({ themes: { [name]: document } })],
          });
          const { css } = await generator.generate(
            String(input["markup"] ?? ""),
            { preflights: true },
          );
          return { css, error: null };
        } catch (error) {
          return {
            css: "",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      case "components/list":
        return [];
      default:
        return null;
    }
  };

  const connectStudio = (): void => {
    if (studioConnected) return;
    const target = studioFrame?.contentWindow;
    if (target === null || target === undefined) return;
    studioConnected = true;
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<StudioCall>) => {
      const call = event.data;
      const parsed = JSON.parse(call.body === "" ? "{}" : call.body) as {
        json?: Record<string, unknown>;
      };
      void studioRpc(call.path, parsed.json ?? {}).then((json) => {
        channel.port1.postMessage({ id: call.id, response: { json } });
      });
    };
    target.postMessage({ type: "spin-bridge-init" }, STUDIO_ORIGIN, [
      channel.port2,
    ]);
  };

  const onStudioLoad = (): void => {
    studioConnected = false;
    connectStudio();
  };
  const onStudioReady = (event: MessageEvent): void => {
    if (event.origin !== STUDIO_ORIGIN) return;
    const data = event.data as { type?: string } | null;
    if (data?.type !== "spin-bridge-ready") return;
    connectStudio();
  };
  window.addEventListener("message", onStudioReady);
  onCleanup(() => window.removeEventListener("message", onStudioReady));

  const themedFiles = (
    framework: PlaygroundFramework,
    subject: Subject,
    themeName: string,
    modeName: string,
    paletteName: string,
    spacingName: string,
  ): Record<string, string> => {
    const wiring = FRAMEWORK_WIRING[framework];
    let doc = isDesignLanguage(themeName)
      ? designLanguages[themeName]
      : designLanguages.editorial;
    const activePalette = demoPalettes[paletteName];
    if (activePalette !== undefined) doc = mergeThemeDocuments(doc, activePalette);
    const activeSpacing = demoSpacings[spacingName];
    if (activeSpacing !== undefined) doc = mergeThemeDocuments(doc, activeSpacing);
    const themeJson = JSON.stringify(doc, null, 2);
    const inner =
      framework === "vanilla"
        ? `\n${indentMarkup(SUBJECT_HTML[subject], 6)}\n    `
        : "";
    // The entry path rotates per appearance: vent caches config-transform
    // output by module path, so an appearance-only apply that keeps the path
    // re-serves stale CSS. A new path forces a fresh transform; the
    // update diff removes the previous entry.
    const entryKey = `src/main.${themeSuffix(`${themeName}-${paletteName}-${spacingName}`, modeName)}.${wiring.ext}`;
    const generated = workspaceFiles(framework, subject, entryKey);
    const paletteAttr = paletteName === "" ? "" : ` data-palette="${paletteName}"`;
    const spacingAttr = spacingName === "" ? "" : ` data-spacing="${spacingName}"`;
    return {
      ...generated,
      ...props.files,
      "vent.config.ts": ventConfig(framework, themeJson),
      "theme.json": themeJson,
      "spin/spin.json": themeJson,
      "index.html": `<!doctype html>
<html lang="en" data-theme="${themeName}" data-mode="${modeName}"${paletteAttr}${spacingAttr}>
  <body>
    <div id="app" class="min-h-dvh bg-surface p-6 type-body">${inner}</div>
    <script type="module" src="/${entryKey}"></script>
  </body>
</html>
`,
    };
  };
  let appliedFiles: Record<string, string> = {};
  let appliedSignature = "";
  let disposed = false;
  let updateTail: Promise<void> = Promise.resolve();
  let updateDepth = 0;
  const setUpdating = (on: boolean): void => {
    updateDepth += on ? 1 : -1;
    if (updateDepth < 0) updateDepth = 0;
    props.onUpdating?.(updateDepth > 0);
  };
  onCleanup(() => {
    disposed = true;
    const handle = activeHandle;
    activeHandle = undefined;
    setLiveHandle(undefined);
    appliedFiles = {};
    handle?.destroy();
  });

  const mount = async (
    node: HTMLDivElement,
    files: Record<string, string>,
    signature: string,
  ): Promise<void> => {
    setUpdating(true);
    setReady(false);
    setStudioOpen(false);
    studioConnected = false;
    const seed = await hostSeedFiles();
    if (disposed) {
      setUpdating(false);
      return;
    }
    const fw = props.framework ?? "solid";
    const defaultActive = activeFileForFramework(fw);
    const mounted = await createJibeEmbed(node, {
      embedOrigin,
      files: { ...files, ...seed },
      ...(props.chrome === "ide" ? { chrome: "studio" as const } : {}),
      theme: resolveSpinJibeTheme(theme(), mode(), palette(), spacing()),
      activeFile: props.activeFile ?? defaultActive,
      visibleFiles: props.visibleFiles ?? [defaultActive, "spin/spin.json"],
      ...(props.view === undefined ? {} : { view: props.view }),
      chrome: props.chrome === "ide" ? "studio" : (props.chrome ?? "studio"),
    });
    if (disposed) {
      mounted.destroy();
      setUpdating(false);
      return;
    }
    activeHandle = mounted;
    setLiveHandle(mounted);
    appliedFiles = { ...files, ...seed };
    appliedSignature = signature;
    setReady(true);
    setUpdating(false);
  };

  const run = async (
    node: HTMLDivElement,
    files: Record<string, string>,
    signature: string,
  ): Promise<void> => {
    if (disposed) return;
    if (activeHandle === undefined) {
      await mount(node, files, signature);
      return;
    }
    if (signature !== appliedSignature) {
      const previous = activeHandle;
      activeHandle = undefined;
      setLiveHandle(undefined);
      appliedFiles = {};
      previous.destroy();
      await mount(node, files, signature);
      return;
    }
    const seed = await hostSeedFiles();
    if (disposed) return;
    const full = { ...files, ...seed };
    const remove = Object.keys(appliedFiles).filter(
      (path) => full[path] === undefined,
    );
    const changed =
      remove.length > 0 ||
      Object.keys(full).some((path) => appliedFiles[path] !== full[path]);
    if (!changed) return;
    setUpdating(true);
    try {
      await activeHandle.client.apply({ write: full, remove });
      appliedFiles = full;
    } finally {
      setUpdating(false);
    }
  };

  createEffect(() => {
    const node = container;
    if (node === undefined) return undefined;
    const files = themedFiles(
      props.framework ?? "solid",
      props.subject ?? "card",
      theme(),
      mode(),
      palette(),
      spacing(),
    );
    const signature = JSON.stringify([props.visibleFiles ?? null]);
    updateTail = updateTail
      .then(() => run(node, files, signature))
      .catch((error: unknown) => {
        console.error("jibe embed update failed", error);
      });
    return undefined;
  });

  createEffect(() => {
    const h = liveHandle();
    const view = props.view ?? "split";
    const chrome = props.chrome === "ide" ? "studio" : (props.chrome ?? "studio");
    const activeFile = props.activeFile;
    const nextTheme = resolveSpinJibeTheme(theme(), mode(), palette(), spacing());
    const configure = h === undefined ? undefined : h.configure;
    if (typeof configure !== "function") return;
    void configure({
      view,
      chrome,
      ...(activeFile === undefined ? {} : { activeFile }),
      theme: nextTheme,
    }).catch((error: unknown) => {
      console.error("jibe embed configure failed", error);
    });
  });

  return (
    <div
      ref={(node) => {
        container = node;
      }}
      class={`relative w-full overflow-hidden rounded-lg border bg-surface shadow-sm ${
        props.height ?? "h-[28rem]"
      }`}
    >
      <Show when={props.studio === true && ready()}>
        <button
          type="button"
           class="bare absolute right-3 top-3 z-dropdown cursor-pointer rounded-full border bg-surface-raised px-3 py-1 type-code shadow-sm"
          onClick={() => {
            studioConnected = false;
            setStudioOpen((open) => !open);
          }}
        >
          {studioOpen() ? "Close studio" : "Studio"}
        </button>
      </Show>
      <Show when={props.studio === true && studioOpen()}>
        <iframe
          ref={studioFrame}
          title="Spin studio"
          src={`${STUDIO_ORIGIN}/__spin/jibe-studio/index.html`}
          class="absolute inset-0 z-base h-full w-full border-0 bg-surface"
          onLoad={onStudioLoad}
        />
      </Show>
    </div>
  );
}
