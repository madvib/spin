/**
 * Incremental Adoption: adopt Spin layer by layer inside an existing codebase.
 */
import type { JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Code, PageHeader, PropList, Section, type PropEntry } from "../../../ui/index.ts";

const TOKENS_ONLY_CONFIG = `import { defineConfig } from "vite";
import { spin } from "@spinjs/dev/vite";

export default defineConfig({
  plugins: [
    spin.vite({
      // Emit CSS variables and utilities only; leave existing <button> and <input> CSS untouched
      primitives: false,
    }),
  ],
});`;

const SCOPED_PRIMITIVES_CONFIG = `spin.vite({
  // Style only the native elements you've migrated so far
  primitives: ["button", "badge", "card", "dialog"],
})`;

const COPY_SINGLE_COMPONENT = `# Add one accessible component without touching the rest of your widget library
npx spin component copy combobox basic`;

const SHARED_BRAND_CONFIG = `import { brand } from "@acme/design-system";

spin.vite({
  extends: brand,
})`;

const ROLLOUT_STAGES: readonly PropEntry[] = [
  {
    name: "Stage 1 · Tokens & utilities only",
    badge: "primitives: false",
    description:
      "Generate your brand's CSS variables (--color-*, --spacing-*, --radius-*) and layout utilities without restyling existing <button>, <input>, or <table> tags.",
  },
  {
    name: "Stage 2 · Opt in to HTML elements one by one",
    badge: "primitives: [...]",
    description:
      "Enable Spin's native element styles incrementally — start with badges and cards, then migrate buttons, inputs, and dialogs as old CSS modules retire.",
  },
  {
    name: "Stage 3 · Drop in interactive components where needed",
    badge: "spin component copy",
    description:
      "Copy individual accessible widgets (a combobox, date picker, or menu) into src/lib/components/ and mount them inside existing React, Solid, Vue, or Svelte views.",
  },
  {
    name: "Stage 4 · Turn on lint rules per folder",
    badge: "oxlint / ESLint",
    description:
      "Scope Spin's lint rules to migrated directories first so new code stays consistent while legacy routes finish converting.",
  },
];

export default function Paths(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Incremental Adoption"
        lede="Adopt Spin gradually in an existing app: start with tokens and utilities, opt in to HTML elements, or add single components."
      />

      <Section id="stages" title="A practical migration path">
        <p class="max-w-prose">
          You don't need a big-bang rewrite to bring Spin into an existing
          product. Every layer — design tokens, layout utilities, native HTML
          element styles, interactive components, and lint rules — can be turned
          on independently:
        </p>
        <PropList items={ROLLOUT_STAGES} />
      </Section>

      <Section id="tokens-only" title="1. Start with tokens and utilities only">
        <p class="max-w-prose">
          If your app already has global CSS or a component library styling bare{" "}
          <code>&lt;button&gt;</code> and <code>&lt;input&gt;</code> tags, set{" "}
          <code>primitives: false</code>. Spin still generates your{" "}
          <code>spin/&lt;brand&gt;/</code> CSS variables, light and dark modes,
          and utility classes (<code>bg-surface</code>, <code>p-4</code>,{" "}
          <code>text-muted</code>), while leaving every HTML tag untouched:
        </p>
        <div class="my-3">
          <Code
            code={TOKENS_ONLY_CONFIG}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
        <p class="max-w-prose text-muted">
          Existing stylesheets can also read Spin's CSS custom properties
          directly (such as <code>var(--color-primary)</code> and{" "}
          <code>var(--radius-md)</code>) while you migrate.
        </p>
      </Section>

      <Section id="elements" title="2. Enable HTML elements one tag at a time">
        <p class="max-w-prose">
          Pass an array to <code>primitives</code> to turn on Spin's element
          styles selectively as you retire legacy stylesheets:
        </p>
        <div class="my-3">
          <Code
            code={SCOPED_PRIMITIVES_CONFIG}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
      </Section>

      <Section id="components" title="3. Add single interactive components">
        <p class="max-w-prose">
          Interactive components are copied one at a time into your repo — you
          never bundle 38 widgets just to use one combobox or dialog. Copy the
          component you need and bind it with{" "}
          <A href="/docs/authoring/components">React, Solid, Vue, Svelte, or HTML</A>:
        </p>
        <div class="my-3">
          <Code
            code={COPY_SINGLE_COMPONENT}
            lang="bash"
            title="Terminal"
          />
        </div>
      </Section>

      <Section id="monorepo" title="4. Share one brand across multiple apps">
        <p class="max-w-prose">
          In a monorepo with multiple web apps (for example, a marketing site, a
          product dashboard, and docs), export your shared brand package and pass
          it to <code>extends</code> so every app inherits the same tokens and
          components:
        </p>
        <div class="my-3">
          <Code
            code={SHARED_BRAND_CONFIG}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
      </Section>
    </main>
  );
}
