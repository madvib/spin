import assert, { deepStrictEqual } from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createIssue,
  readIssues,
  removeIssue,
  reopenIssue,
  resolveIssue,
} from "./issues.ts";

describe("local .spin/issues.json store", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "spin-issues-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates, resolves, reopens, and removes issues in .spin/issues.json", () => {
    deepStrictEqual(readIssues(root), []);

    const created = createIssue(root, {
      route: "/login",
      annotations: [
        {
          selector: "button.primary",
          boundingBox: { x: 120, y: 240, width: 160, height: 40 },
          route: "/login",
          tag: "button",
          classes: "primary",
          comment: "Primary CTA contrast feels low in dark mode",
        },
      ],
    });

    assert(created.id.startsWith("iss_"));
    deepStrictEqual(created.status, "open");
    deepStrictEqual(created.title, "Primary CTA contrast feels low in dark mode");
    assert(!existsSync(join(root, "spin", "issues.json")));

    const listed = readIssues(root);
    deepStrictEqual(listed.length, 1);
    deepStrictEqual(listed[0]?.id, created.id);

    const resolved = resolveIssue(root, created.id);
    deepStrictEqual(resolved?.status, "resolved");

    const reopened = reopenIssue(root, created.id);
    deepStrictEqual(reopened?.status, "open");

    deepStrictEqual(removeIssue(root, created.id), true);
    deepStrictEqual(readIssues(root), []);
  });
});
