/**
 * Browser-side Studio RPC host for static deployments (`/__spin/jibe-studio/`).
 *
 * Answers `studio-bridge.js` MessageChannel calls entirely in memory using
 * `@spinjs/theme`, `@spinjs/preset`, and `@unocss/core` so `/studio` boots and
 * edits live on static hosts (Cloudflare Pages) with no Node daemon.
 */
import { createGenerator } from "@unocss/core";
import {
  componentExamples,
  primitiveComponents,
  spinPreset,
} from "@spinjs/preset";
import {
  demoPalettes,
  demoSpacings,
  designLanguages,
  isDesignLanguage,
  parseDocument,
  parseTokens,
  removeToken,
  renameToken,
  setToken,
  themeGates,
  treeToJson,
  type Mode,
  type ThemeDocument,
} from "@spinjs/theme";

interface StudioBridgeCall {
  readonly id: number;
  readonly path: string;
  readonly body: string;
}

export function attachStudioSandbox(
  getFrame: () => HTMLIFrameElement | undefined,
  getInitialLanguage: () => string,
): { readonly onLoad: () => void; readonly dispose: () => void } {
  const initialLang = isDesignLanguage(getInitialLanguage())
    ? getInitialLanguage()
    : "editorial";
  const themes = new Map<string, string>([
    [
      "acme",
      JSON.stringify(
        designLanguages[initialLang as keyof typeof designLanguages],
        null,
        2,
      ),
    ],
  ]);
  let activeTheme = "acme";
  let connected = false;

  const listThemes = () =>
    [...themes.entries()].map(([name, text]) => ({
      name,
      text,
      file: `spin/${name}/tokens.json`,
      origin: "brand" as const,
    }));

  const handleCall = async (
    path: string,
    input: Record<string, unknown>,
  ): Promise<unknown> => {
    switch (path) {
      case "project/current":
      case "project/detect":
        return {
          root: "/app",
          spin: true,
          uno: true,
          wired: true,
          themes: [...themes.keys()],
        };
      case "project/config/read":
        return {
          config: { brand: activeTheme },
          file: "spin/config.json",
        };
      case "project/config/write": {
        const cfg = input["config"] as { brand?: string } | undefined;
        if (typeof cfg?.brand === "string" && themes.has(cfg.brand)) {
          activeTheme = cfg.brand;
        }
        return { error: null };
      }
      case "project/themes/list":
        return listThemes();
      case "project/themes/read": {
        const name = String(input["name"] ?? activeTheme);
        return { text: themes.get(name) ?? null };
      }
      case "project/themes/write": {
        const name = String(input["name"] ?? activeTheme);
        const text = String(input["text"] ?? "");
        themes.set(name, text);
        return { error: null };
      }
      case "project/themes/copy": {
        const from = String(input["from"] ?? activeTheme);
        const to = String(input["to"] ?? "");
        const src = themes.get(from);
        if (src === undefined || to === "") return { error: "Unknown source theme" };
        themes.set(to, src);
        return { error: null };
      }
      case "project/themes/remove": {
        const name = String(input["name"] ?? "");
        if (themes.size <= 1) return { error: "Cannot remove the last brand" };
        themes.delete(name);
        return { error: null };
      }
      case "project/themes/facets":
        return [
          ...Object.keys(demoPalettes).map((name) => ({ name, kind: "palette" as const })),
          ...Object.keys(demoSpacings).map((name) => ({ name, kind: "spacing" as const })),
        ];
      case "project/brand/get": {
        const brand = String(input["brand"] ?? activeTheme);
        const text = themes.get(brand) ?? [...themes.values()][0] ?? "{}";
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return {
          name: brand,
          definition: { name: brand, description: "In-browser Studio preview brand" },
          layers: {
            "tokens.json": parsed,
          },
          composed: parsed,
          valid: true,
          issues: [],
        };
      }
      case "theme/analyze": {
        const text = String(input["text"] ?? "{}");
        const required = input["required"] as readonly string[] | undefined;
        const modes = input["modes"] as readonly Mode[] | undefined;
        const parsed = parseDocument(text);
        const battery = themeGates(text, {
          ...(required !== undefined ? { required } : {}),
          ...(modes !== undefined ? { modes } : {}),
        });
        return {
          error: parsed.ok ? null : parsed.error,
          issues: [...battery.issues],
          tree: parsed.ok ? parsed.tree : null,
        };
      }
      case "theme/tokens/set": {
        const text = String(input["text"] ?? "{}");
        const parsed = parseTokens(text);
        if (!parsed.ok) return { error: parsed.error, code: null, text: null };
        const res = setToken(
          parsed.tree,
          input["path"] as string[],
          input["value"] as never,
          input["type"] as never,
          input["mode"] as Mode | undefined,
        );
        if (!res.ok) {
          return {
            error: res.path ? `${res.path}: ${res.detail}` : res.detail,
            code: res.code,
            text: null,
          };
        }
        return { error: null, code: null, text: treeToJson(res.tree) };
      }
      case "theme/tokens/remove": {
        const text = String(input["text"] ?? "{}");
        const parsed = parseTokens(text);
        if (!parsed.ok) return { error: parsed.error, code: null, text: null };
        const res = removeToken(parsed.tree, input["path"] as string[]);
        if (!res.ok) return { error: res.detail, code: res.code, text: null };
        return { error: null, code: null, text: treeToJson(res.tree) };
      }
      case "theme/tokens/rename": {
        const text = String(input["text"] ?? "{}");
        const parsed = parseTokens(text);
        if (!parsed.ok) return { error: parsed.error, code: null, text: null };
        const res = renameToken(
          parsed.tree,
          input["from"] as string[],
          input["to"] as string[],
        );
        if (!res.ok) return { error: res.detail, code: res.code, text: null };
        return { error: null, code: null, text: treeToJson(res.tree) };
      }
      case "preview/css": {
        const name = String(input["name"] ?? activeTheme);
        const text = String(input["text"] ?? "{}");
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
        return Object.values(componentExamples).map((examples) => {
          const component = primitiveComponents[examples.id];
          return {
            name: examples.id,
            tags: [...(component?.tags ?? [])],
            variants: [...(component?.variants ?? [])],
            reads: [...(component?.reads ?? [])],
            examples: {
              ...(examples.onLoad !== undefined ? { onLoad: examples.onLoad } : {}),
              ...(examples.classes !== undefined ? { classes: [...examples.classes] } : {}),
              note: examples.note,
              rows: [...examples.rows],
            },
          };
        });
      case "findings/list":
        return { groups: [], unreadable: [], files: 24 };
      case "findings/corpus":
        return { repetition: [], order: [] };
      case "icons/collections":
      case "icons/catalog":
      case "icons/saved/list":
      case "fonts/catalog":
        return [];
      case "overlay/set":
        return { ok: true };
      default:
        return null;
    }
  };

  const connect = (): void => {
    if (connected) return;
    const target = getFrame()?.contentWindow;
    if (target === null || target === undefined) return;
    connected = true;
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<StudioBridgeCall>) => {
      const call = event.data;
      const parsed = JSON.parse(call.body === "" ? "{}" : call.body) as {
        json?: Record<string, unknown>;
      };
      void handleCall(call.path, parsed.json ?? {}).then((json) => {
        channel.port1.postMessage({ id: call.id, response: { json } });
      });
    };
    target.postMessage({ type: "spin-bridge-init" }, window.location.origin, [
      channel.port2,
    ]);
  };

  const onMessage = (event: MessageEvent): void => {
    if (typeof window !== "undefined" && event.origin !== window.location.origin) {
      return;
    }
    const data = event.data as { type?: string } | null;
    if (data?.type !== "spin-bridge-ready") return;
    connect();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", onMessage);
  }

  return {
    onLoad: () => {
      connected = false;
      connect();
    },
    dispose: () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("message", onMessage);
      }
    },
  };
}
