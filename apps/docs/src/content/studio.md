<!-- USER COPY SLOT: studio-intro — your own Studio framing, or the default below. -->

# Using the Studio

The Studio is the theme editor that runs beside your app. One origin serves
both: your pages and the editor, so every edit repaints the live app before it
ever touches disk.

## Mounting & first run

Add `mountSpinApp(root, { studioDir })` to the plugin options in dev (the
install page has the snippet). Open the floating action button in the corner of
any page. If your project has no `spin/` directory yet, the Studio offers the
starters and the scaffold — pick one, and the first save creates the file.

## The live overlay loop

Dragging a slider or picking a color updates the in-memory overlay
(`overlay.set`) and repaints your running app immediately. Nothing is written
until you press `Mod+S`. The overlay is a diff, not a document: discard it and
the app returns to what is on disk.

Every edit validates before it previews. An invalid token value is refused with
the reason named. A color that breaks a legibility floor is refused with the
nearest-passing hex offered as remedy — in both light and dark modes. The
stylesheet can never be broken by the editor, because the editor never writes a
broken value.

> **Note:** If `spin/<theme>.json` changes on disk while you have unsaved edits
> — a teammate, a rebase — the top bar reports `changed` and refuses to clobber
> the file. Save merges nothing; it writes what you see. Resolve the conflict in
> your editor first.

## Keyboard verbs

`Mod+Z` undoes, `Mod+Shift+Z` redoes, `Mod+S` saves. Floating pickers navigate
with arrows, `Home`/`End`, `Enter` to commit, `Escape` to dismiss. Focus stays
on the token row across rebuilds, so a screen-reader user never loses their
place when the list re-renders.

## Page-by-page tour

| Page                                                                             | What you do there                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview (`/`)                                                                   | Palette swatches per mode, surface ladder, typography specimens, spacing steps, element previews                                                                                                                                                |
| Colors (`/colors`)                                                               | Brand, neutral-by-role, and status families; flip a role between a literal hex (**set**) and a token reference (`{color.neutral.100}`, **computed**); edit base values vs dark restatements with live contrast ratios and one-click floor fixes |
| Typography (`/type`), Spacing (`/spacing`), Style (`/style`), Motion (`/motion`) | Linked lockstep scale sliders (`LinkToggle`), per-element typography overrides with reset-to-ladder, composite editors (typography, border, shadow, transition, gradient, interactive cubic-bezier curve editor)                                |
| Components (`/components`, `/components/[name]`)                                 | Live specimens of all 32 primitives in the active theme and mode, the exact tokens each primitive reads, and inline editors for component tokens                                                                                                |
| Icons (`/icons`)                                                                 | The 5 installed Iconify collections (`lucide`, `material-symbols`, `tabler`, `carbon`, `ph`); save with attribution to `spin/icons/*.svg`                                                                                                       |
| Findings (`/findings`)                                                           | Source lint diagnostics grouped by rule, auto-fixes applied to files on disk, class-order fixes, promoting repeated utility strings into named shortcuts                                                                                        |

<!-- USER COPY SLOT: studio-close — team workflow notes or review guidance. -->
