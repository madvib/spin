import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { designLanguages } from "@spinjs/theme";
import { createThemeState } from "./theme-state.ts";

/**
 * The theme state an app creates over its own documents.
 *
 * The default state knows the shipped starters. The reference app serves the
 * project's `spin/*.json` beside them, so it builds its own — and the rules a
 * control needs are the same: a name the app does not hold is not served, and
 * a mode the theme does not declare is not rendered.
 */

/** A storage pair no other test shares, so one state cannot seed another. */
function storage(name: string) {
  return { theme: `kit-test-${name}:theme`, mode: `kit-test-${name}:mode` };
}

test("a stored theme the app does not hold falls back to one it does", () => {
  const state = createThemeState({
    documents: { neumorphic: designLanguages.neumorphic, minimal: designLanguages.minimal },
    initialTheme: "minimal",
    storage: storage("unknown"),
    followSystem: false,
  });
  deepStrictEqual(state.theme(), "minimal");
  state.setTheme("no-such-theme");
  deepStrictEqual(state.theme(), "minimal", "an unknown name is ignored");
});

test("a mode the theme does not serve is clamped to one it does", () => {
  // Console's own face is dark and it serves no light rendering; a reader
  // arriving from a light theme must not be shown a mode it does not have.
  const darkOnly = { ...designLanguages.neumorphic, modes: ["dark"] };
  const state = createThemeState({
    documents: { neumorphic: darkOnly },
    initialTheme: "neumorphic",
    initialMode: "light",
    storage: storage("clamp"),
    followSystem: false,
  });
  deepStrictEqual(state.theme(), "neumorphic");
  deepStrictEqual(state.modes(), ["dark"]);
  deepStrictEqual(state.mode(), "dark");
});

test("the system request resolves to the platform's mode when served", () => {
  const state = createThemeState({
    documents: { minimal: designLanguages.minimal },
    initialTheme: "minimal",
    initialMode: "system",
    storage: storage("system"),
    followSystem: false,
  });
  // `followSystem` off still resolves the request against the platform's
  // current preference; minimal serves both, so the answer is one of them.
  deepStrictEqual(["light", "dark"].includes(state.mode()), true);
});

test("a two-mode theme keeps the mode the reader asked for", () => {
  const state = createThemeState({
    documents: { minimal: designLanguages.minimal },
    initialTheme: "minimal",
    initialMode: "dark",
    storage: storage("two-mode"),
    followSystem: false,
  });
  deepStrictEqual(state.mode(), "dark");
  state.setMode("light");
  deepStrictEqual(state.mode(), "light");
});
