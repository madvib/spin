import { test } from "bun:test";
import { deepEqual } from "node:assert/strict";
import { scaffoldTheme, treeToJson } from "@spinjs/spin/theme";
import { composeDraft, draftPreview } from "./generate.ts";

const STARTER = treeToJson(scaffoldTheme());

test("composes starter with primary overwritten and accents omitted", () => {
  const text = composeDraft(STARTER, {
    primary: "#ff0000",
    secondary: "#00ff00",
    accent: "#0000ff",
    bodyFont: "",
    headingFont: "",
    starter: STARTER,
    name: "t",
  });
  const doc = JSON.parse(text) as Record<string, any>;
  deepEqual(doc.color.primary.$value, "#ff0000");
});

test("derives on-primary clearing 4.5:1", () => {
  const text = composeDraft(null, {
    primary: "#ff0000",
    secondary: "#00ff00",
    accent: "#0000ff",
    bodyFont: "",
    headingFont: "",
    starter: null,
    name: "t",
  });
  const doc = JSON.parse(text) as Record<string, any>;
  // white contrasts better on red
  deepEqual(doc.color["on-primary"].$value, "#111111");
});

test("writes font stacks and declarations", () => {
  const text = composeDraft(null, {
    primary: "#123456",
    secondary: "#abcdef",
    accent: "#fedcba",
    bodyFont: '"Inter", ui-sans-serif, system-ui, sans-serif',
    headingFont: '"Fraunces", Georgia, serif',
    faces: [
      { family: "Inter", src: 'url(https://example/inter.woff2) format("woff2")', weight: "400", style: "normal", display: "swap" },
    ],
    starter: null,
    name: "t",
  });
  const doc = JSON.parse(text) as Record<string, any>;
  if (typeof doc.font.family.body.$value !== "string") throw new Error("no body stack");
  if (!doc.font.family.body.$value.includes("Inter")) throw new Error("body stack names Inter");
  if (!Array.isArray(doc.$extensions.spin.fonts)) throw new Error("no fonts");
  if (doc.$extensions.spin.fonts.length === 0) throw new Error("empty fonts");
});

test("leaves starter fonts alone when the stack is empty", () => {
  const text = composeDraft(STARTER, {
    primary: "#123456",
    secondary: "#abcdef",
    accent: "#fedcba",
    bodyFont: "",
    headingFont: "",
    starter: STARTER,
    name: "t",
  });
  const doc = JSON.parse(text) as Record<string, any>;
  const fonts = doc.$extensions?.spin?.fonts ?? [];
  if (fonts.length !== 0) throw new Error("empty stacks must not append declarations");
});

test("draftPreview answers invalid JSON without throwing", () => {
  const result = draftPreview("{not json", "light");
  deepEqual(result.swatches, []);
  deepEqual(result.surfaces, []);
});


test("overwrites secondary and accent from choices even when they differ from the template", () => {
  const text = composeDraft(STARTER, {
    primary: "#ff0000",
    secondary: "#00ff00",
    accent: "#0000ff",
    bodyFont: "",
    headingFont: "",
    starter: STARTER,
    name: "t",
  });
  const doc = JSON.parse(text) as Record<string, any>;
  deepEqual(doc.color.secondary.$value, "#00ff00");
  deepEqual(doc.color.accent.$value, "#0000ff");
});
