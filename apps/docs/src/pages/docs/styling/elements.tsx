/**
 * Primitives: how Spin's stylesheet layers work, tag vs. class mode,
 * variants, `.bare`, and compound element anatomy.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Markdown } from "../../../markdown.tsx";
import { PageHeader, Section } from "../../../ui/index.ts";
import markupMd from "../../../content/markup.md?raw";

export default function StylingElements(): JSX.Element {
  return (
    <main class="flex flex-col">
      <PageHeader
        title="Primitives"
        lede="How Spin's stylesheet layers work, how primitive rules style HTML and custom elements (by tag or by class), and how variants, compound parts, and utilities compose."
      />
      <Markdown text={markupMd} />

      <Section id="live-preview" title="Live primitive composition">
        <p class="max-w-prose">
          The markup above rendered live against the active theme — switch
          starters or toggle light/dark mode in the top bar to see every
          surface, border, radius, and button variant update from the theme:
        </p>
        <div class="grid gap-6 md:grid-cols-2">
          <div class="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface-raised p-4">
            <div class="stack-sm">
              <p class="overline">Button variants &amp; .bare</p>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" class="primary">Save changes</button>
                <button type="button">Neutral</button>
                <button type="button" class="secondary">Secondary</button>
                <button type="button" class="outline">Outline</button>
                <button type="button" class="ghost">Ghost</button>
                <button type="button" class="danger">Delete</button>
              </div>
              <div class="flex flex-wrap items-center gap-3 pt-1">
                <button type="button" class="primary s-sm">Small</button>
                <button type="button" class="primary s-lg">Large</button>
                <button
                  type="button"
                  class="bare inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
                >
                  <span>Chrome-free (.bare)</span>
                </button>
              </div>
            </div>
            <div class="stack-xs border-t border-border pt-3">
              <p class="overline">Status tones</p>
              <div class="flex flex-wrap items-center gap-2">
                <badge variant="primary">primary</badge>
                <badge variant="success">success</badge>
                <badge variant="warning-muted">warning-muted</badge>
                <badge variant="error">error</badge>
              </div>
            </div>
          </div>

          <card>
            <card-header>
              <card-title>Alert routing</card-title>
              <card-description>
                Notify on-call engineers when error budgets burn.
              </card-description>
              <card-action>
                <badge variant="success">Active</badge>
              </card-action>
            </card-header>
            <card-content class="stack-sm">
              <label for="demo-webhook-url">Webhook endpoint</label>
              <field>
                <span
                  class="i-lucide-webhook icon-sm text-text-muted"
                  aria-hidden="true"
                />
                <input
                  id="demo-webhook-url"
                  type="url"
                  placeholder="https://hooks.acme.dev/incidents"
                />
              </field>
            </card-content>
            <card-footer class="justify-end">
              <button type="button" class="ghost">Cancel</button>
              <button type="button" class="primary">Save rule</button>
            </card-footer>
          </card>
        </div>
        <p class="max-w-prose">
          Browse all 26 primitives, their variant classes, and the exact theme
          tokens each rule reads in the{" "}
          <A href="/components?kind=elements">Components catalog</A>.
        </p>
      </Section>
    </main>
  );
}
