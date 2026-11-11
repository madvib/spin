/**
 * Hover and completion over every class-carrying attribute.
 *
 * Diagnostics read every spelling the vocabulary can appear in; hover and
 * completion must read the same ones, or the editor answers some classes
 * and stays silent on others. What is tested here is the three spellings
 * the opener admits — `class`, `classList={{ ... }}`, `:class="..."` —
 * driving the public `hoverAt`/`completionsAt`, never the opener itself:
 * the class under the cursor resolves, and a known utility completes, in
 * all three.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { deepStrictEqual, ok } from "node:assert/strict";
import { engineAnswers } from "@spinjs/preset";
import { readProjectThemes } from "@spinjs/diagnostics";
import { designLanguages, editorialLanguage } from "@spinjs/theme";
import { completionsAt, hoverAt } from "../../src/lsp/features.ts";
import type { EngineAnswers } from "@spinjs/diagnostics";

/** A project with a theme, holding one document under each spelling. */
async function project(): Promise<{ root: string; uri: string; vueUri: string; text: string; vueText: string }> {
  const root = await mkdtemp(join(tmpdir(), "spin-lsp-"));
  await mkdir(`${root}/spin`);
  await writeFile(`${root}/spin/spin.json`, JSON.stringify(editorialLanguage));
  await mkdir(`${root}/src`);
  const text = `export const App = (active: boolean) => (
  <p class="bg-primary">plain</p>
  <div classList={{ "bg-primary": active }}>object</div>
);
`;
  await writeFile(`${root}/src/app.tsx`, text);
  // A bound class is Vue's own spelling, so it lives in a Vue file — the
  // same document a Vue author hovers. A plain list is the resting shape;
  // the opener admits the attribute, and the literal carries the class.
  const vueText = `<template>
  <div :class="bg-primary">bound</div>
</template>
`;
  await writeFile(`${root}/src/app.vue`, vueText);
  return { root, uri: `file://${root}/src/app.tsx`, vueUri: `file://${root}/src/app.vue`, text, vueText };
}

/** What the style engine answers for the fixture project, as the server fills them. */
function answersFor(root: string): EngineAnswers {
  return engineAnswers([
    ...Object.values(designLanguages),
    ...Object.values(readProjectThemes(root)),
  ]);
}

/** The hover over the `bg-primary` the line carries. */
function hovered(text: string, uri: string, root: string, line: string): string {
  const row = text.split("\n").find((candidate) => candidate.includes(line)) as string;
  const lines = text.split("\n");
  const at = lines.indexOf(row);
  const value = hoverAt(uri, text, at, row.indexOf("bg-primary") + 2, answersFor(root))?.contents.value;
  ok(value !== undefined, `hover resolves bg-primary in ${line}`);
  return value;
}

test("hover resolves the class under every class-carrying spelling", async () => {
  const { root, uri, vueUri, text, vueText } = await project();
  try {
    for (const line of [`class="bg-primary"`, `classList={{`]) {
      const value = hovered(text, uri, root, line);
      ok(
        value.includes("background-color"),
        `hover shows the declarations in ${line}: ${value}`,
      );
    }
    const value = hovered(vueText, vueUri, root, `:class=`);
    ok(
      value.includes("background-color"),
      `hover shows the declarations in :class=: ${value}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("completion names a known utility under every class-carrying spelling", async () => {
  const { root, uri, vueUri, text, vueText } = await project();
  try {
    const answers = answersFor(root);
    const completed = (doc: string, docUri: string, docLine: number, character: number, needle: string): void => {
      const items = completionsAt(docUri, doc, docLine, character, answers);
      deepStrictEqual(
        items.some((item) => item.label === "bg-primary"),
        true,
        `bg- completes to bg-primary in ${needle}`,
      );
    };
    const lines = text.split("\n");
    for (const needle of [`class="bg-primary"`, `classList={{`]) {
      const at = lines.findIndex((row) => row.includes(needle));
      const row = lines[at] as string;
      completed(text, uri, at, row.indexOf("bg-primary") + "bg-".length, needle);
    }
    const vueLines = vueText.split("\n");
    const at = vueLines.findIndex((row) => row.includes(`:class=`));
    const row = vueLines[at] as string;
    completed(vueText, vueUri, at, row.indexOf("bg-primary") + "bg-".length, `:class=`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
