# E2E tests

One question: can a stranger install and use this? The test starts where the
user starts — a checkout with no build output, the real entry — and ends where
the user ends: rendered output in a real browser. Nothing of ours is replaced:
no stub generator, no fake DOM, no test harness standing in for the preset or
the runtime.

## Good: the stranger run

```ts
// A fresh checkout, the real build, a real browser. Asserts what is on the
// page: the components render, styled, with no build error. Fails loud
// naming the step; silent on success. Not in default green — it builds and
// drives a browser — so it runs explicitly.
//   deno task e2e
```

## Bad: the same test, harness replacing product

```ts
// BAD: the "browser" is linkedom, so layout, computed style and event order
// are the shim's. Every one of those is exactly what this repo needs to be
// right, and none of them runs.
it("renders the tree", () => {
  const { document } = parseHTML("<tree-view></tree-view>");
  assert(document.querySelector("ul") !== null);
});
```

A DOM shim is not a browser. It has no layout, so `display` and `hidden` mean
nothing; it has no real event ordering, so the mousedown-before-click
sequence that swallows a first click does not exist. Both of this repo's
real regressions were invisible to a shim and obvious in Chromium.

## Bad: the same test, scripted generator claiming e2e

```ts
// BAD: the CSS is a fixture string. This is an integration test wearing an
// e2e name — it proves the page loads, not that the preset styled it.
it("shows a styled button", async () => {
  await page.setContent(`<style>${FIXTURE_CSS}</style><button>Save</button>`);
  assert(await page.$eval("button", (b) => getComputedStyle(b).backgroundColor) !== "rgba(0, 0, 0, 0)");
});
```

Name it what it is (integration) and write the e2e beside it with the real
generator. Both earn their place; neither substitutes for the other.

## Rules

- **Start as a stranger.** No build output, no cached bundle, the real entry.
  Anything the test inherits from a previous run is a hidden precondition.
- **End at the user's boundary.** What is rendered and computed in the
  browser: the element, its `display`, the pixels. Not what our internals
  recorded.
- **Real browser, always.** Layout, computed style and event order are the
  product in this repo. `linkedom` is for unit-level DOM shape only, never
  for a claim about how something looks or behaves.
- **Gate, don't skip.** Browser or port absent: the suite gates from outside
  (a task name, a binary check at the runner), never `if (!hasChrome())
  return` inside the test. A skipped e2e is a suite that cannot fail.
- **Slow is honest.** E2E builds and drives a browser. It runs explicitly,
  not in default green — and that exclusion is declared, not silent.
