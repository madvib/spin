/**
 * spin-file-upload e2e: the dropzone modes and the validation split,
 * behind the app-controller handle.
 *
 * The route binds a machine-owned file-upload through
 * `{ commands, state, bind }`; this suite exercises the two entry paths
 * (the picker and a drop), the accept/size rules, focus and drag modes,
 * row removal, and the imperative clear.
 */

import { strict as assert } from "node:assert";
import { runComponentSuite, step } from "./harness.ts";
import { type Page } from "npm:playwright-core";

const READOUT = "#upload-value";
const DROPZONE = "#upload [role='button']";

/** Drops a set of files on the dropzone through a real DataTransfer. */
async function dropFiles(
  page: Page,
  files: readonly { name: string; type: string; bytes: number }[],
): Promise<void> {
  await page.evaluate((entries) => {
    const dropzone = document.querySelector(
      "#upload [role='button']",
    ) as HTMLElement;
    const dt = new DataTransfer();
    for (const entry of entries) {
      dt.items.add(
        new File([new Uint8Array(entry.bytes)], entry.name, {
          type: entry.type,
        }),
      );
    }
    dropzone.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, dataTransfer: dt }),
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: dt }),
    );
  }, files);
}

const rowTexts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll("#upload [role='listitem']")].map((node) =>
      node.textContent ?? ""
    )
  );

Deno.test("spin-file-upload e2e", () =>
  runComponentSuite(
    { port: 5237, route: "/file-upload", ready: DROPZONE },
    async ({ page }) => {
      await step("the dropzone renders with its input wired", async () => {
        const accept = await page.evaluate(() =>
          document.querySelector("#upload input[type='file']")?.getAttribute(
            "accept",
          )
        );
        assert.equal(
          accept,
          "image/*",
          "the accept rule reaches the hidden input",
        );
        assert.deepEqual(await rowTexts(page), [], "no rows at rest");
      });

      await step(
        "choosing through the picker lands accepted files",
        async () => {
          await page.locator("#upload input[type='file']").setInputFiles([
            {
              name: "photo.png",
              mimeType: "image/png",
              buffer: Buffer.alloc(2048),
            },
            {
              name: "notes.txt",
              mimeType: "text/plain",
              buffer: Buffer.alloc(8),
            },
          ]);
          assert.equal(
            await page.locator(READOUT).textContent(),
            "photo.png — notes.txt (accept)",
            "the accept rule splits the selection",
          );
          assert.deepEqual(
            await rowTexts(page),
            ["photo.png2 KB"],
            "the accepted file renders its row",
          );
        },
      );

      await step("dropping more files appends to the selection", async () => {
        await dropFiles(page, [{
          name: "second.png",
          type: "image/png",
          bytes: 1024,
        }]);
        assert.deepEqual(
          await rowTexts(page),
          ["photo.png2 KB", "second.png1 KB"],
          "the drop appends",
        );
      });

      await step(
        "dropping a too-large file is rejected by the size rule",
        async () => {
          await dropFiles(page, [{
            name: "huge.png",
            type: "image/png",
            bytes: 2 * 1024 * 1024,
          }]);
          const readout = await page.locator(READOUT).textContent() ?? "";
          assert.ok(
            readout.includes("huge.png (too-large)"),
            `the size rule reports: ${readout}`,
          );
          assert.equal(
            await rowTexts(page).then((rows) =>
              rows.some((row) => row.includes("huge"))
            ),
            false,
            "and the oversized file never lands",
          );
        },
      );

      await step("a row's delete trigger removes the file", async () => {
        await page.locator("#upload [aria-label='Remove photo.png']").click();
        assert.deepEqual(
          await rowTexts(page),
          ["second.png1 KB"],
          "the named row leaves",
        );
      });

      await step("the clear trigger empties the selection", async () => {
        await page.locator("#upload [aria-label='Clear']").click();
        assert.deepEqual(await rowTexts(page), [], "all rows leave");
        assert.equal(
          await page.locator(READOUT).textContent(),
          "",
          "and the readout empties",
        );
      });

      await step("focus reports through the dropzone bag", async () => {
        await page.locator(DROPZONE).focus();
        assert.equal(
          await page.locator(DROPZONE).getAttribute("data-focus"),
          "",
          "the focused mode reports",
        );
        await page.locator(DROPZONE).blur();
        assert.equal(
          await page.locator(DROPZONE).getAttribute("data-focus"),
          null,
          "and blur returns to idle",
        );
      });
    },
  ));
