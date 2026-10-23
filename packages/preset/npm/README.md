# @spin/preset

The UnoCSS preset: the utility vocabulary a theme spends, the element library
that vocabulary dresses, and the vite plugin that turns a project's theme
documents into the stylesheet.

## Exports

`@spin/preset` is the preset itself. The other entry points are the parts that
other packages read.

```
@spin/preset
  spinPreset        the preset, and the default export
  SpinPresetOptions theme · themes · primitives · classless · wind4
  catalog           describeCatalog · CatalogSection
  uno               toUnoTheme · UnoTheme
  roles             requiredRolesFor · scaffold · scaffoldDocument
  primitives        primitiveContracts · primitiveComponents · claimedElements
                    paintedElements · primitiveVariants · primitiveReadsByGroup
                    PrimitiveContract · PrimitiveComponent · ComponentToken
  session           setOverlay · clearOverlay · overlayThemes · hasOverlay
                    overlayDirty · noteDiskDocument · noteDiskDocuments
                    resolveThemes
  wind4             wind4Layers · wind4Exclusions · Wind4Options · Wind4Layers
                    Wind4Exclusion
  procedures        presetContract · presetRouter · overlayContract · overlayRouter
                    primitivesContract · primitivesRouter · listedComponents
  examples          componentExamples · examplesFor · ComponentExamples · FixtureExample
  organization      SECTIONS · SAMPLES · Section · Sample · CatalogGroupId
                    sectionFor · utilitiesFor · claimedGroups
  scales            buildScale · scaleClass · BuiltScale · Scale · Axis · Step · EDGES

@spin/preset/plugin
  spin              the unplugin: scan, generate, serve
  projectThemes     the starters, forked by the project's own documents
  spinAliases       the specifier table that bridges the workspace
  SpinPluginOptions · DevServer

@spin/preset/config
  spinConfig · configScaffoldText · SpinConfigOptions

@spin/preset/solid
  the JSX intrinsic-element types, for TypeScript
```

## Contract

Only what the preset defines exists. A utility the theme does not name matches
no rule and emits no CSS; a class outside the vocabulary is a class that
generates nothing.

Values come from the theme. A rule resolves its name against the token tree and
emits the token's custom property, so a colour, a step, or a duration is never
written into the preset. Aliases emit as `var(--token)` rather than being
inlined, so a theme swap is a selector swap.

Primitives are classless by default: `<button>` is a button. `classless: false`
makes each one claim only its own class instead.

The cascade is layered. The theme's variables and the primitives sit below the
utility layer, so a component is a default and a utility is a decision. Utility
against utility is source order, which is CSS-correct; no merge utility is
applied.

## The plugin

`spin.vite()` replaces the Uno plugin in a spin app. It scans the project's
sources, generates the sheet from the project's themes (the shipped starters,
forked by `spin/*.json`), safelists the catalog so a utility chosen at runtime
still resolves, and serves the stylesheet as a CSS module the studio can swap in
place.

`mountSpinApp(root)` — from `@spin/api` — mounts the API and the studio beside
the app, so the editor and the project it edits are one origin.
