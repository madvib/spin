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
      // Compile your theme and utility classes without restyling existing HTML tags
      primitives: false,
    }),
  ],
});`;

const SCOPED_PRIMITIVES_CONFIG = `spin.vite({
  // Enable Spin's element styles only for tags you've migrated so far
  primitives: ["button", "badge", "card", "dialog"],
})`;

const COPY_SINGLE_COMPONENT = `npx spin component copy combobox basic`;

const SHARED_BRAND_CONFIG = `import { brand } from "@acme/design-system";

spin.vite({
  extends: brand,
})`;

const ROLLOUT_STAGES: readonly PropEntry[] = [
  {
    name: "Stage 1 · Theme & layout utilities only",
    badge: "primitives: false",
    description:
      "Bring in your brand's colors, typography, light/dark modes, and utility classes while leaving existing global button, input, and table CSS untouched.",
  },
  {
    name: "Stage 2 · Enable HTML elements one tag at a time",
    badge: "primitives: [...]",
    description:
      "Opt into Spin's styled elements gradually — start with cards and badges, then turn on buttons, inputs, and dialogs as legacy CSS retires.",
  },
  {
    name: "Stage 3 · Add individual interactive components",
    badge: "on demand",
    description:
      "Copy a single accessible combobox, select, or date picker into your app without replacing the rest of your existing widget library.",
  },
  {
    name: "Stage 4 · Scope lint rules to migrated folders",
    badge: "oxlint / ESLint",
    description:
      "Enable Spin's lint rules on migrated directories first so new screens stay consistent while older routes finish converting.",
  },
];

export default function Paths(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Incremental Adoption"
        lede="Roll Spin into an existing product step by step without a big-bang rewrite."
      />

      <Section id="stages" title="Four independent stages">
        <p class="max-w-prose">
          Every layer of Spin can be enabled on its own, so you can adopt a
          shared theme and utilities today and migrate HTML elements or
          interactive widgets route by route:
        </p>
        <PropList items={ROLLOUT_STAGES} />
      </Section>

      <Section id="utilities-only" title="1. Start with your theme and utilities">
        <p class="max-w-prose">
          If your app already has global styles or an existing component library
          controlling bare HTML tags, pass <code>primitives: false</code>. Spin
          compiles your brand theme, light and dark modes, and utility classes
          without touching any native HTML elements:
        </p>
        <div class="my-3">
          <Code
            code={TOKENS_ONLY_CONFIG}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
      </Section>

      <Section id="elements" title="2. Turn on HTML elements selectively">
        <p class="max-w-prose">
          Pass a list of element names to <code>primitives</code> to hand
          specific tags over to Spin as you retire old stylesheets:
        </p>
        <div class="my-3">
          <Code
            code={SCOPED_PRIMITIVES_CONFIG}
            lang="ts"
            title="vite.config.ts"
          />
        </div>
      </Section>

      <Section id="components" title="3. Drop in single interactive components">
        <p class="max-w-prose">
          Interactive components copy into your repository one at a time — you
          never ship a monolithic widget bundle just to get one combobox or
          dialog. Copy what you need and bind it in{" "}
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

      <Section id="monorepo" title="4. Share one brand across a monorepo">
        <p class="max-w-prose">
          When a marketing site, product app, and docs site live in one
          workspace, export your brand from a shared package and pass it to{" "}
          <code>extends</code> so every app stays visually aligned:
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
