import { test } from "bun:test";
/**
 * spin-tree-view e2e: the explorer contract — indent rails, branch-only
 * chevrons, the mode-gated checkbox, and the keyboard map.
 *
 * The route binds a machine-owned tree-view through
 * `{ commands, state, bind }`; this suite pins the things that were
 * silently wrong and visually obvious: a leaf with a disclosure arrow, a
 * checkbox drawn in single-select mode, an expanded parent rendering as
 * checked, and a flat grid where the indent should be.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "playwright-core";

const TREE = "spin-tree-view";

/** One row's rendered shape: label, whether its chevron shows, its icon kind. */
const rows = (
  page: Page,
): Promise<{ label: string; chevron: boolean; kind: string }[]> =>
  page.evaluate((tree) => {
    const out: { label: string; chevron: boolean; kind: string }[] = [];
    const nodes = document.querySelectorAll(`${tree} > div > div`);
    for (const node of nodes) {
      const button = node.querySelector("button");
      if (button === null) continue;
      const icon = button.querySelector("[data-kind]");
      const indicator = button.querySelector(
        "span span.i-lucide-chevron-right",
      );
      out.push({
        label: (button.textContent ?? "").trim(),
        chevron: indicator !== null && indicator.parentElement !== null &&
          getComputedStyle(indicator.parentElement).display !== "none",
        kind: icon?.getAttribute("data-kind") ?? "none",
      });
    }
    return out;
  }, TREE);

test("spin-tree-view e2e", () =>
  runComponentSuite({
    port: 5246,
    route: "/tree-view",
    ready: `${TREE} [role="treeitem"]`,
    timeoutMs: 30000,
  }, async ({ page }) => {
    await step("branches carry the chevron, leaves never do", async () => {
      const list = await rows(page);
      const branch = list.find((row) =>
        row.kind === "branch-open" || row.kind === "branch-closed"
      );
      const leaf = list.find((row) => row.kind === "leaf");
      assert.ok(branch !== undefined, "the seeded data has a branch");
      assert.ok(leaf !== undefined, "the seeded data has a leaf");
      assert.equal(
        branch?.chevron,
        true,
        `a branch discloses (${branch?.label})`,
      );
      assert.equal(
        leaf?.chevron,
        false,
        `a leaf has no arrow (${leaf?.label})`,
      );
    });

    await step("one glyph per row, matched to its kind", async () => {
      const perRow = await page.evaluate((tree) => {
        const out: { kind: string; icons: string[] }[] = [];
        for (const row of document.querySelectorAll(`${tree} > div > div`)) {
          const icons: string[] = [];
          const spans = row.querySelectorAll("span");
          for (const span of spans) {
            const cls = String(span.className);
            const isGlyph = cls.includes("i-lucide-folder") ||
              cls.includes("i-lucide-folder-open") ||
              cls.includes("i-lucide-file");
            if (!isGlyph) continue;
            if (getComputedStyle(span).display !== "none") {
              icons.push(cls.split(" ")[0] ?? "");
            }
          }
          const kindNode = row.querySelector("[data-kind]");
          out.push({
            kind: kindNode === null
              ? "?"
              : String(kindNode.getAttribute("data-kind")),
            icons,
          });
        }
        return out;
      }, TREE);
      assert.ok(perRow.length > 0, "rows render");
      for (const row of perRow) {
        assert.equal(
          row.icons.length,
          1,
          `${row.kind} shows exactly one icon (saw ${row.icons.join(",")})`,
        );
        const want = row.kind === "leaf"
          ? "i-lucide-file"
          : row.kind === "branch-open"
          ? "i-lucide-folder-open"
          : "i-lucide-folder";
        assert.equal(row.icons[0], want, `${row.kind} shows its own glyph`);
      }
    });
    await step("single-select mode draws no checkbox", async () => {
      const box = await page.evaluate((tree) => {
        const node = document.querySelector(`${tree} [role="checkbox"]`);
        return node === null ? "absent" : getComputedStyle(node).display;
      }, TREE);
      assert.equal(box, "none", "the box is hidden in single mode");
    });

    await step(
      "multiple mode draws it, and only from the checked state",
      async () => {
        await page.getByRole("button", { name: /selectionMode/ }).click();
        await page.waitForFunction(
          () => {
            const node = document.querySelector(
              "spin-tree-view [role='checkbox']",
            );
            return node !== null && getComputedStyle(node).display !== "none";
          },
          undefined,
          { timeout: 5000 },
        );
        const painted = await page.evaluate((tree) => {
          // An expanded parent must not render as a checked box: the fill
          // reads the checked fact alone.
          const openBranch = document.querySelector(
            `${tree} [role=treeitem][aria-expanded=true] [role=checkbox]`,
          );
          return openBranch === null
            ? "no open branch"
            : getComputedStyle(openBranch).backgroundColor;
        }, TREE);
        assert.ok(
          painted === "no open branch" || painted === "rgba(0, 0, 0, 0)",
          `an expanded parent's box is unfilled (${String(painted)})`,
        );
        await page.getByRole("button", { name: /selectionMode/ }).click();
      },
    );

    await step("no row's fill runs past the card", async () => {
      const fits = await page.evaluate((tree) => {
        const card = document.querySelector(`${tree}`)?.closest(
          "[class*=rounded-lg]",
        );
        if (card === null || card === undefined) return "no card";
        const edge = card.getBoundingClientRect().right;
        const over: string[] = [];
        for (const row of document.querySelectorAll(`${tree} > div > div`)) {
          const button = row.querySelector("button");
          if (button === null) continue;
          if (button.getBoundingClientRect().right > edge + 0.5) {
            over.push((button.textContent ?? "").trim().slice(0, 20));
          }
        }
        return over;
      }, TREE);
      assert.deepEqual(fits, [], `rows past the card: ${JSON.stringify(fits)}`);
    });

    await step("a leaf's chevron is absent from layout entirely", async () => {
      // `hidden` loses to the span's own `flex`, so the gate is a data flag.
      const displays = await page.evaluate((tree) => {
        const out: { label: string; display: string; kind: string }[] = [];
        for (const row of document.querySelectorAll(`${tree} > div > div`)) {
          const button = row.querySelector("button");
          if (button === null) continue;
          const icon = button.querySelector("span.i-lucide-chevron-right");
          const indicator = icon === null ? null : icon.parentElement;
          if (indicator === null) continue;
          out.push({
            label: (button.textContent ?? "").trim().slice(0, 18),
            display: getComputedStyle(indicator).display,
            kind: indicator.getAttribute("data-branch") === null
              ? "leaf"
              : String(indicator.getAttribute("data-branch")),
          });
        }
        return out;
      }, TREE);
      for (const row of displays) {
        if (row.kind === "leaf") {
          assert.equal(
            row.display,
            "none",
            `a leaf has no arrow (${row.label})`,
          );
        } else {
          assert.notEqual(
            row.display,
            "none",
            `a branch discloses (${row.label})`,
          );
        }
      }
    });

    await step(
      "indent and rails ride the geometry channel per depth",
      async () => {
        const indents = await page.evaluate((tree) => {
          const out: { level: string; indent: string; rail: string }[] = [];
          for (const row of document.querySelectorAll(`${tree} > div > div`)) {
            const button = row.querySelector("button");
            if (button === null) continue;
            const rail = row.querySelector("span.absolute");
            out.push({
              level: row.getAttribute("aria-level") ?? "?",
              indent: getComputedStyle(button).marginInlineStart,
              rail: rail === null ? "none" : getComputedStyle(rail).left,
            });
          }
          return out;
        }, TREE);
        const byLevel = new Map<string, { indent: string; rail: string }>();
        for (const row of indents) {
          if (!byLevel.has(row.level)) {
            byLevel.set(row.level, { indent: row.indent, rail: row.rail });
          }
        }
        const first = byLevel.get("1");
        const second = byLevel.get("2");
        const third = byLevel.get("3");
        assert.ok(
          first !== undefined && second !== undefined,
          "depths 1-2 render",
        );
        assert.equal(first?.indent, "0px", "depth 1 has no indent");
        assert.ok(
          Number.parseFloat(second?.indent ?? "0") > 0,
          `depth 2 is indented (${second?.indent})`,
        );
        if (third !== undefined) {
          assert.ok(
            Number.parseFloat(third.indent) >
              Number.parseFloat(second?.indent ?? "0"),
            `depth 3 indents further (${third.indent})`,
          );
          assert.notEqual(
            third.rail,
            "0px",
            `depth 3 has a rail (${third.rail})`,
          );
        }
        assert.equal(first?.rail, "0px", "depth 1 has no rail");
      },
    );

    await step("star expands every branch", async () => {
      await page.locator(`${TREE} button`).first().focus();
      await page.keyboard.press("*");
      await page.waitForFunction(
        () =>
          document.querySelectorAll(
            "spin-tree-view [role=treeitem][aria-expanded=true]",
          ).length >= 3,
        undefined,
        { timeout: 5000 },
      );
      const expanded = await page.evaluate((tree) =>
        document.querySelectorAll(`${tree} [role=treeitem][aria-expanded=true]`)
          .length, TREE);
      const total = await page.evaluate((tree) =>
        document.querySelectorAll(`${tree} [role=treeitem]`).length, TREE);
      assert.ok(expanded >= 3, `star expanded ${expanded} branches`);
      assert.ok(total > expanded, "a leaf never reports expanded");
    });
  }));
