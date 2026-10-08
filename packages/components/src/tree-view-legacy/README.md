# tree-view-legacy

Isolated from the single-shape conversion because `@zag-js/tree-view` requires a
`collection: TreeCollection` prop (from `@zag-js/collection`). The consume
codegen passes scope props directly to `createMachine` as machine props — there
is no hook to transform raw `nodes: TreeNodes[]` into a `TreeCollection` instance
within the plain `{ machine, connect }` machine-def contract.

The zag tree-view machine defaults `collection` to `collection.empty()` (an
empty tree) and calls `prop("collection").findNodes(...)` / `.findNode(...)`
throughout its implementation. Without a `TreeCollection`, the machine cannot
function.

This component retains the `load()` + `use:` + parts.action pattern until the
framework provides a way to wire collection-based machines into the single
shape.
