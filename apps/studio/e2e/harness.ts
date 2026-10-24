/**
 * The browser harness the studio's end-to-end tests share.
 *
 * One browser for the file, one page per test, and a test that drives a
 * browser declared as such: its timers and sockets outlive the call that
 * started them, and the op and resource sanitizers cannot tell that from a
 * test that forgot to clean up.
 */

import assert from "node:assert/strict";
import type { Browser } from "playwright-core";
import { launchBrowser, StudioPage } from "./studio.ts";

import { beforeAll, afterAll, test as bunTest } from "bun:test";

let browser: Browser | undefined;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});


/**
 * A test that drives a browser.
 *
 * The browser is the subject, not the leak: its timers and sockets outlive
 * the call that started them, and the op and resource sanitizers cannot tell
 * that from a test that forgot to clean up.
 */
export function test(
  name: string,
  fn: (t?: any) => Promise<void>,
): void {
  bunTest(name, fn);
}

/**
 * One page for one test, closed when the test ends.
 *
 * The browser withholds what it has not been given: the clipboard is one such
 * thing, and reading it is a permission the browser grants on request. A test
 * whose contract ends at the clipboard asks for it here — so the shared
 * browser drives it, and the file keeps ONE browser.
 */
export async function withPage<T>(
  fn: (page: StudioPage) => Promise<T>,
  options: { permissions?: readonly string[] } = {},
): Promise<T> {
  const launched = browser;
  assert(launched !== undefined, "the browser did not launch");
  const context = await launched.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const permissions = options.permissions ?? [];
  if (permissions.length > 0) await context.grantPermissions([...permissions]);
  const page = await context.newPage();
  try {
    return await fn(new StudioPage(page));
  } finally {
    await context.close();
  }
}

/** Two tabs: the watcher never navigates, so what it reads is the page it had. */
export async function withWatcher<T>(
  fn: (driver: StudioPage, watcher: StudioPage) => Promise<T>,
): Promise<T> {
  const launched = browser;
  assert(launched !== undefined, "the browser did not launch");
  const driver = await launched.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const watcher = await launched.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    return await fn(new StudioPage(driver), new StudioPage(watcher));
  } finally {
    await driver.close();
    await watcher.close();
  }
}
