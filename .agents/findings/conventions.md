# The repo's conventions a change must not break

## The code is NOT `deno fmt`-clean

`deno fmt --check` fails on **11 of 12** files sampled from
`packages/components/src`. The committed style keeps signatures on one line
(`export function initial(args: AvatarArgs, authored: (name: string)
=> boolean): AvatarContext {`),
where `deno fmt` would wrap them.

**⇒ Never run `deno fmt` over the tree as part of a change.** It reformats 186
HTML example files and every machine file, which buries the change in noise: the
authoring-API conversion measured **+11 062 lines** with the formatter and
**−575 lines** without it.

**⇒ Format by hand, in the file's own style.** `deno fmt` is still useful for a
file you have rewritten, but check the result against the file's neighbours
before committing it.

## The gates

| the gate    | the command                                                                            |
| ----------- | -------------------------------------------------------------------------------------- |
| the units   | `deno test --allow-read --allow-import packages/components/src/ packages/runtime/src/` |
| the types   | `deno check packages/components/src/ packages/runtime/src/`                            |
| the e2e     | `/tmp/run-e2e.sh /home/madvib/dev/spin-runtime` (36 suites)                            |
| the recipes | `deno run -A scripts/recipe-check.ts`                                                  |
| the classes | `deno run -A scripts/uno-class-check.ts`                                               |

**⇒ A stale dev server on a suite's port makes that suite fail with a
`waitForSelector` timeout that looks like a regression.** Check with
`ss -tlnp | grep -E ":52[0-9][0-9]"` and clear with `fuser -k -n tcp <port>`
before believing a failure.

## The component's three files

```
packages/components/src/spin-<name>/
  <name>.machine.ts        the statechart
  <name>.bindings.ts       the DOM contract
  <name>.machine.test.ts   the units
```

The bindings name the event MAP; the machine's factory returns
`Machine<Ctx, XEvents>`.

## The authoring API's shape, in one place

```ts
// the event MAP: the contract with the outside
export interface XEvents {
  "SET_VALUE": { value: string };
  "PING": {};
}
export type XEvent = EventUnion<XEvents>;

// the spec: the `on` map's KEY narrows the event
createMachine<XContext, XEvents>({
  on: {
    "SET_VALUE": { assign: (_ctx, event) => ({ value: event.value }) },
  },
});
```

**A body used once is inlined and loses its event-type guard** (the key
narrows). **A body used more than once is a named const**, typed by the map's
union, and it keeps its guard.
