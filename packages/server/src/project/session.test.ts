import { describe, expect, test } from "bun:test";
import {
  clearOverlay,
  forgetDiskDocument,
  noteDiskDocument,
  noteDiskDocuments,
  overlayDirty,
  setOverlay,
} from "./session.ts";

const doc = (primary: string): Record<string, unknown> =>
  ({ color: { primary: { $value: primary } } }) as unknown as Parameters<typeof setOverlay>[0][string];

describe("overlay dirty", () => {
  test("a generate noting static themes keeps a save's note", () => {
    clearOverlay();
    noteDiskDocuments({});
    setOverlay({ minimal: doc("#b91c1c") });
    // The save notes the rewritten file; a generate landing after it notes
    // only the static themes its own plugin knows.
    noteDiskDocument("minimal", JSON.stringify(doc("#b91c1c")));
    noteDiskDocuments({ studio: doc("#000000") });
    expect(overlayDirty()).toEqual([]);
    clearOverlay();
  });

  test("a removed theme stops comparing against its own ghost", () => {
    clearOverlay();
    setOverlay({ minimal: doc("#b91c1c") });
    noteDiskDocument("minimal", JSON.stringify(doc("#b91c1c")));
    expect(overlayDirty()).toEqual([]);
    forgetDiskDocument("minimal");
    expect(overlayDirty()).toEqual(["minimal"]);
    clearOverlay();
  });

  test("an edit still reads dirty against the noted disk", () => {
    clearOverlay();
    noteDiskDocument("minimal", JSON.stringify(doc("#111111")));
    setOverlay({ minimal: doc("#b91c1c") });
    expect(overlayDirty()).toEqual(["minimal"]);
    clearOverlay();
  });
});
