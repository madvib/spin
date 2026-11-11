/**
 * Create your brand: the init sequence's four screens.
 *
 * One parent component holds all four screens' state — no route-per-step —
 * and each screen drives one brand procedure: create, setDesignLanguage,
 * setPalette, setType. The studio renders previews and drives the calls;
 * it owns no init logic. A brand that renders a finished page, unique by
 * construction.
 */
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { designLanguages, type DesignLanguageName, typeSuggestions } from "@spinjs/theme";
import { A, useNavigate } from "@solidjs/router";
import { inDrawer } from "../lib/host.ts";
import {
  project,
  refetchBrand,
  refetchProject,
  refetchThemes,
  setActiveName,
} from "../lib/store.ts";
import { refetchProjectThemes } from "../components/Settings.tsx";
import { spinClient } from "../lib/client.ts";
import { listProjectThemes, problemText } from "../lib/themes.ts";
import { loadIconCollections } from "../lib/icons.ts";
import type { IconCollection } from "../lib/icons.ts";
import type { CatalogFont } from "../lib/fonts.ts";
import { fontDeclarationFor, injectFontFaces } from "../lib/fonts.ts";
import { ThemePreview } from "../components/ThemePreview.tsx";
import { FamilyField } from "../components/FamilyField.tsx";
import ColorField from "../components/ColorField.tsx";
import { ConcernPage, Section } from "../components/Concern.tsx";

const TITLES = ["Brand", "Design language", "Color", "Type and icons"];

const NAME_PATTERN = /^[a-z0-9-]+$/;

/** One line of character per design language, in the chooser's words. */
const LANGUAGE_CAPTIONS: Readonly<Record<string, string>> = {
  minimal: "Quiet surfaces, hairlines, nothing to prove.",
  material: "Tonal steps and ink that means it.",
  neobrutalist: "Hard offsets, loud borders, no apologies.",
  neumorphic: "Soft extrude, light that comes from inside.",
  editorial: "Print on screen: serif display, hairline rules.",
  glassmorphic: "Frosted layers floating over the page.",
};

export default function InitPage() {
  const navigate = useNavigate();
  const [step, setStep] = createSignal(0);
  const [name, setName] = createSignal("");
  const [nameTouched, setNameTouched] = createSignal(false);
  const [description, setDescription] = createSignal("");
  const [logo, setLogo] = createSignal<{ name: string; svg: string } | undefined>(undefined);
  const [language, setLanguage] = createSignal("editorial");
  const [primary, setPrimary] = createSignal("#c8102e");
  const [neutral, setNeutral] = createSignal("");
  const [modes, setModes] = createSignal<"light" | "dark" | "both">("both");
  const [faces, setFaces] = createSignal<{ display?: string; body?: string; mono?: string }>({});
  const [suggestion, setSuggestion] = createSignal<string | undefined>(undefined);
  const [icons, setIcons] = createSignal<string | undefined>(undefined);
  const [stroke, setStroke] = createSignal<string | undefined>(undefined);
  const [problem, setProblem] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  const [existing] = createResource(listProjectThemes);
  const taken = createMemo(() => new Set((existing() ?? []).map((theme) => theme.name)));
  const nameError = createMemo((): string | undefined => {
    const value = name().trim();
    if (value === "") return "Name the brand.";
    if (!NAME_PATTERN.test(value)) return "Lowercase letters, digits, and dashes.";
    if (taken().has(value)) return `A brand named ${value} already exists.`;
    return undefined;
  });

  const starters = createMemo(() =>
    (Object.keys(designLanguages) as DesignLanguageName[]).map((key) => ({
      name: key,
      text: JSON.stringify(designLanguages[key]),
      caption: LANGUAGE_CAPTIONS[key] ?? "",
    }))
  );

  const suggestions = createMemo(() => typeSuggestions());
  const [collections] = createResource(loadIconCollections);

  async function run(label: string, call: () => Promise<{ error: string | null }>): Promise<boolean> {
    setBusy(true);
    setProblem(null);
    try {
      const outcome = await call();
      if (outcome.error !== null) {
        setProblem(outcome.error);
        return false;
      }
      return true;
    } catch (err) {
      setProblem(`${label}: ${problemText(err)}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(): Promise<void> {
    const root = project()?.root;
    if (root === undefined || nameError() !== undefined) return;
    const client = await spinClient();
    const trim = name().trim();
    const ok = await run("Create brand", () =>
      client.project.brand.create({
        root,
        name: trim,
        ...(description().trim() === "" ? {} : { description: description().trim() }),
      }).then((result) => ({ error: result.error })),
    );
    if (!ok) return;
    setStep(1);
  }

  async function chooseLanguage(): Promise<void> {
    const root = project()?.root;
    if (root === undefined) return;
    const client = await spinClient();
    const ok = await run("Set design language", () =>
      client.project.brand.setDesignLanguage({
        root,
        brand: name().trim(),
        language: language(),
      }).then((result) => ({ error: result.error })),
    );
    if (ok) setStep(2);
  }

  async function seedPalette(): Promise<void> {
    const root = project()?.root;
    if (root === undefined) return;
    const client = await spinClient();
    const ok = await run("Set palette", () =>
      client.project.brand.setPalette({
        root,
        brand: name().trim(),
        primary: primary(),
        ...(neutral().trim() === "" ? {} : { neutral: neutral().trim() }),
      }).then((result) => ({ error: result.error })),
    );
    if (ok) setStep(3);
  }

  async function resetPalette(): Promise<void> {
    const root = project()?.root;
    if (root === undefined) return;
    const client = await spinClient();
    await run("Reset palette", () =>
      client.project.brand.setPalette({
        root,
        brand: name().trim(),
        primary: primary(),
      }).then((result) => ({ error: result.error })),
    );
  }

  async function finish(): Promise<void> {
    const root = project()?.root;
    if (root === undefined) return;
    const client = await spinClient();
    const held = faces();
    const ok = await run("Set type", () =>
      client.project.brand.setType({
        root,
        brand: name().trim(),
        ...(suggestion() === undefined ? {} : { suggestion: suggestion() }),
        ...(held.display === undefined ? {} : { display: held.display }),
        ...(held.body === undefined ? {} : { body: held.body }),
        ...(held.mono === undefined ? {} : { mono: held.mono }),
        ...(icons() === undefined ? {} : { icons: icons() }),
        ...(stroke() === undefined ? {} : { stroke: stroke() }),
      }).then((result) => ({ error: result.error })),
    );
    if (!ok) return;
    refetchProject();
    refetchThemes();
    refetchProjectThemes();
    refetchBrand();
    setActiveName(name().trim());
    navigate("/");
  }

  return (
    <div
      class={inDrawer()
        ? "drawer-flow bg-surface p-4 sm:p-6"
        : "drawer-scroll overflow-y-auto bg-surface p-4 sm:p-6"}
    >
      <div class="mx-auto stack-lg max-w-[72rem]">
        <ConcernPage title="Create your brand">
          <ol class="flex flex-wrap items-center gap-2" aria-label="Brand steps">
            <For each={TITLES}>
              {(title, index) => (
                <li class="flex flex-none items-center gap-2">
                  <span
                    class="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-solid type-body-emphasized"
                    classList={{
                      "border-primary bg-primary text-on-primary": index() <= step(),
                      "border bg-surface-raised text-muted": index() > step(),
                    }}
                    aria-current={index() === step() ? "step" : undefined}
                  >
                    {index() + 1}
                  </span>
                  <span class="whitespace-nowrap type-caption-emphasized">{title}</span>
                </li>
              )}
            </For>
          </ol>

          <Show when={problem()}>
            {(message) => (
              <p class="text-semantic-error" role="alert">
                {message()}
              </p>
            )}
          </Show>

          <Show when={step() === 0}>
            <BrandScreen
              name={name()}
              description={description()}
              logo={logo()}
              nameError={nameTouched() ? nameError() : undefined}
              canContinue={nameError() === undefined}
              busy={busy()}
              onName={(value) => {
                setName(value);
                if (value.trim() !== "") setNameTouched(true);
              }}
              onBlurName={() => setNameTouched(true)}
              onDescription={setDescription}
              onLogo={setLogo}
              onContinue={() => void create()}
            />
          </Show>
          <Show when={step() === 1}>
            <LanguageScreen
              starters={starters()}
              language={language()}
              busy={busy()}
              onPick={setLanguage}
              onBack={() => setStep(0)}
              onContinue={() => void chooseLanguage()}
            />
          </Show>
          <Show when={step() === 2}>
            <ColorScreen
              starterText={starters().find((entry) => entry.name === language())?.text ?? ""}
              primary={primary()}
              neutral={neutral()}
              modes={modes()}
              busy={busy()}
              onPrimary={setPrimary}
              onNeutral={setNeutral}
              onModes={setModes}
              onReset={() => void resetPalette()}
              onBack={() => setStep(1)}
              onContinue={() => void seedPalette()}
            />
          </Show>
          <Show when={step() === 3}>
            <TypeScreen
              suggestions={suggestions()}
              faces={faces()}
              suggestion={suggestion()}
              icons={icons()}
              stroke={stroke()}
              collections={collections() ?? []}
              busy={busy()}
              onFaces={setFaces}
              onSuggestion={setSuggestion}
              onIcons={setIcons}
              onStroke={setStroke}
              onBack={() => setStep(2)}
              onFinish={() => void finish()}
            />
          </Show>
        </ConcernPage>
      </div>
    </div>
  );
}

function BrandScreen(props: {
  name: string;
  description: string;
  logo: { name: string; svg: string } | undefined;
  nameError: string | undefined;
  canContinue: boolean;
  busy: boolean;
  onName: (value: string) => void;
  onBlurName: () => void;
  onDescription: (value: string) => void;
  onLogo: (logo: { name: string; svg: string } | undefined) => void;
  onContinue: () => void;
}) {
  return (
    <Section title="The brand" fact="identity, not tokens">
      <div class="stack-sm">
        <label class="stack-xs">
          Name
          <input
            type="text"
            class="w-36"
            aria-label="Brand name"
            placeholder="acme"
            value={props.name}
            onInput={(event) => props.onName(event.currentTarget.value)}
            onBlur={() => props.onBlurName()}
          />
        </label>
        <div class="type-code text-muted">
          {props.name.trim() === "" ? "spin/<name>/" : `spin/${props.name.trim()}/`}
        </div>
        <Show when={props.nameError}>
          {(error) => (
            <p class="text-semantic-error" role="alert">
              {error()}
            </p>
          )}
        </Show>
        <label class="stack-xs">
          Description
          <textarea
            rows={2}
            class="w-full"
            aria-label="Brand description"
            placeholder="What this brand is for."
            value={props.description}
            onInput={(event) => props.onDescription(event.currentTarget.value)}
          />
        </label>
        <div class="stack-xs">
          <span>Logo</span>
          <label class="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3">
            Drop an SVG here, or pick one
            <input
              type="file"
              accept=".svg,image/svg+xml"
              class="sr-only"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (file === undefined) return;
                props.onLogo({ name: file.name, svg: await file.text() });
              }}
            />
          </label>
          <Show when={props.logo}>
            {(held) => (
              <div
                class="block h-12 w-12 overflow-hidden rounded-md border bg-surface"
                title={held().name}
                innerHTML={held().svg}
              />
            )}
          </Show>
        </div>
        <div class="row">
          <button
            type="button"
            class="primary"
            disabled={!props.canContinue || props.busy}
            onClick={props.onContinue}
          >
            Continue
          </button>
          <A href="/">I&apos;ll do this later</A>
        </div>
      </div>
    </Section>
  );
}

function LanguageScreen(props: {
  starters: readonly { name: string; text: string; caption: string }[];
  language: string;
  busy: boolean;
  onPick: (name: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <Section title="Design language" fact="pick one look">
      <div class="grid gap-3 sm:grid-cols-2">
        <For each={props.starters}>
          {(starter) => (
            <button
              type="button"
              class="bare stack-sm rounded-lg border p-3 text-left"
              classList={{
                "border-primary": props.language === starter.name,
              }}
              aria-pressed={props.language === starter.name}
              onClick={() => props.onPick(starter.name)}
            >
              <ThemePreview text={starter.text} name={starter.name} static />
              <span class="block capitalize type-label">{starter.name}</span>
              <span class="block type-caption text-muted">{starter.caption}</span>
            </button>
          )}
        </For>
      </div>
      <div class="row-sm">
        <button type="button" class="secondary" onClick={props.onBack}>
          Back
        </button>
        <button type="button" disabled={props.busy} onClick={props.onContinue}>
          Continue
        </button>
      </div>
    </Section>
  );
}

function ColorScreen(props: {
  starterText: string;
  primary: string;
  neutral: string;
  modes: "light" | "dark" | "both";
  busy: boolean;
  onPrimary: (value: string) => void;
  onNeutral: (value: string) => void;
  onModes: (modes: "light" | "dark" | "both") => void;
  onReset: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <Section title="Color" fact="one primary seeds the palette">
      <div class="grid gap-6 md:grid-cols-2">
        <div class="stack-sm">
          <div class="row-sm">
            <label class="flex flex-row flex-nowrap items-center gap-2">
              Primary
              <input
                type="text"
                class="w-36"
                aria-label="Primary color"
                value={props.primary}
                onInput={(event) => props.onPrimary(event.currentTarget.value)}
              />
            </label>
            <ColorField value={props.primary} onCommit={(value) => {
              props.onPrimary(value);
              return true;
            }} bare />
          </div>
          <label class="flex flex-row flex-nowrap items-center gap-2">
            Neutral seed
            <input
              type="text"
              class="w-36"
              aria-label="Neutral seed"
              placeholder="Paper and charcoal follow the primary"
              value={props.neutral}
              onInput={(event) => props.onNeutral(event.currentTarget.value)}
            />
          </label>
          <div class="row-sm" role="group" aria-label="Modes">
            <For each={["light", "dark", "both"] as const}>
              {(choice) => (
                <button
                  type="button"
                  class="secondary s-sm"
                  classList={{ "border-primary": props.modes === choice }}
                  aria-pressed={props.modes === choice}
                  onClick={() => props.onModes(choice)}
                >
                  {choice}
                </button>
              )}
            </For>
          </div>
          <button type="button" class="bare self-start p-0 text-muted" onClick={props.onReset}>
            Use the design language palette
          </button>
        </div>
        <ThemePreview text={props.starterText} name="preview" static />
      </div>
      <div class="row-sm">
        <button type="button" class="secondary" onClick={props.onBack}>
          Back
        </button>
        <button type="button" disabled={props.busy} onClick={props.onContinue}>
          Continue
        </button>
      </div>
    </Section>
  );
}

function TypeScreen(props: {
  suggestions: readonly { language: string; display: string; body: string; mono: string; ratio: number }[];
  faces: { display?: string; body?: string; mono?: string };
  suggestion: string | undefined;
  icons: string | undefined;
  stroke: string | undefined;
  collections: readonly IconCollection[];
  busy: boolean;
  onFaces: (faces: { display?: string; body?: string; mono?: string }) => void;
  onSuggestion: (suggestion: string | undefined) => void;
  onIcons: (icons: string | undefined) => void;
  onStroke: (stroke: string | undefined) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [custom, setCustom] = createSignal<readonly CatalogFont[]>([]);
  createEffect(() => {
    const needle = query().trim();
    if (needle === "") {
      setCustom([]);
      return;
    }
    let live = true;
    void spinClient()
      .then((client) => client.fonts.catalog({ query: needle }))
      .then((listed) => {
        if (!live) return;
        const fonts = (listed as readonly CatalogFont[]).slice(0, 6);
        injectFontFaces(fonts.map((font) => fontDeclarationFor(font)));
        setCustom(fonts);
      });
    return () => {
      live = false;
    };
  });
  return (
    <Section title="Type and icons" fact="faces, then the stroke beside them">
      <div class="grid gap-3 sm:grid-cols-2">
        <For each={props.suggestions}>
          {(entry) => (
            <button
              type="button"
              class="bare stack-sm rounded-lg border p-3 text-left"
              classList={{ "border-primary": props.suggestion === entry.language }}
              aria-pressed={props.suggestion === entry.language}
              onClick={() => {
                props.onSuggestion(entry.language);
                props.onFaces({});
              }}
            >
              <span class="block type-label capitalize">{entry.language}</span>
              <span class="block truncate type-title" style={{ "font-family": entry.display }}>
                Ag
              </span>
              <span class="block truncate type-body" style={{ "font-family": entry.body }}>
                The quick brown fox jumps over the lazy dog.
              </span>
              <span class="block truncate type-code" style={{ "font-family": entry.mono }}>
                const brand = true;
              </span>
            </button>
          )}
        </For>
      </div>
      <div class="stack-sm">
        <label class="flex flex-row flex-nowrap items-center gap-2">
          Or search for a face
          <input
            type="text"
            class="w-36"
            aria-label="Search faces"
            placeholder="Inter, Fraunces"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <Show when={custom().length > 0}>
          <ul class="stack-xs">
            <For each={custom()}>
              {(font) => (
                <li class="row-sm flex-wrap">
                  <button
                    type="button"
                    class="secondary s-sm"
                    onClick={() => {
                      props.onSuggestion(undefined);
                      props.onFaces({ ...props.faces, body: `"${font.family}", ui-sans-serif, system-ui, sans-serif` });
                    }}
                  >
                    {font.family}
                  </button>
                  <span style={{ "font-family": `"${font.family}", ui-sans-serif, system-ui, sans-serif` }}>
                    {font.category}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <div class="stack-xs">
          <span class="type-caption-emphasized text-muted">Custom faces</span>
          <label class="flex flex-row flex-nowrap items-center gap-2">
            Display
            <div class="min-w-0 flex-1">
              <FamilyField
                value={props.faces.display ?? ""}
                label="Display face"
                onCommit={(stack) => {
                  props.onSuggestion(undefined);
                  props.onFaces({ ...props.faces, display: stack });
                }}
              />
            </div>
          </label>
          <label class="flex flex-row flex-nowrap items-center gap-2">
            Body
            <div class="min-w-0 flex-1">
              <FamilyField
                value={props.faces.body ?? ""}
                label="Body face"
                onCommit={(stack) => {
                  props.onSuggestion(undefined);
                  props.onFaces({ ...props.faces, body: stack });
                }}
              />
            </div>
          </label>
          <label class="flex flex-row flex-nowrap items-center gap-2">
            Mono
            <div class="min-w-0 flex-1">
              <FamilyField
                value={props.faces.mono ?? ""}
                label="Mono face"
                onCommit={(stack) => {
                  props.onSuggestion(undefined);
                  props.onFaces({ ...props.faces, mono: stack });
                }}
              />
            </div>
          </label>
        </div>
        <div class="stack-xs">
          <span class="type-caption-emphasized text-muted">Icons</span>
          <div class="row-sm flex-wrap" role="group" aria-label="Icon collection">
            <For each={props.collections}>
              {(collection) => (
                <button
                  type="button"
                  class="secondary s-sm"
                  classList={{ "border-primary": props.icons === collection.prefix }}
                  aria-pressed={props.icons === collection.prefix}
                  onClick={() => props.onIcons(collection.prefix)}
                >
                  {collection.name}
                </button>
              )}
            </For>
          </div>
          <div class="row-sm" role="group" aria-label="Icon stroke">
            <For each={["outline", "filled"] as const}>
              {(choice) => (
                <button
                  type="button"
                  class="secondary s-sm"
                  classList={{ "border-primary": props.stroke === choice }}
                  aria-pressed={props.stroke === choice}
                  onClick={() => props.onStroke(choice)}
                >
                  {choice}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
      <div class="row-sm">
        <button type="button" class="secondary" onClick={props.onBack}>
          Back
        </button>
        <button type="button" disabled={props.busy} onClick={props.onFinish}>
          Create brand
        </button>
      </div>
    </Section>
  );
}
