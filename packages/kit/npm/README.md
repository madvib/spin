# @spin/kit

The shared pieces the spin apps use: the theme state, the picker that changes
it, and the brand mark. Internal to this repository — the home for the brand's
own components, not a package a consumer installs.

## Exports

One entry point. It is Solid-based, and the JSX it ships is Solid's.

```
@spin/kit
  theme state     theme · setTheme · mode · setMode
                  starterList · modesFor · StarterName
  components      ThemePicker
  the mark        Mark · Logo · LogoSize · LogoSpec · logoSpec
                  Web · WebGlyph
```

## The theme state

One signal pair — which starter, which mode — and one effect that writes
`data-theme` and `data-mode` on the document element, with the choice persisted
in `localStorage`. Apps re-export or import it; they do not reimplement it.

The list of starters is derived from `@spin/theme/themes`, so a starter added to
the package appears here without anyone maintaining a list. The modes a starter
supports are read from its own document, so the control never offers a mode the
theme does not have.

A stored choice that no longer exists falls back to the default starter, and a
starter that loses a mode drops to one it has.

## The picker

`ThemePicker` is the one theme and appearance control: the current starter's
name and an appearance icon on the trigger, every starter with a live swatch
preview of that document's own tokens in the panel, and a sun/moon pair for the
mode, shown only for starters that have more than one.

It closes on a click outside and on Escape, and it renders nothing but the
trigger until it is opened.

## The mark

Two pieces of one drawing.

`Mark` is the hero: the spinnaker, animated. Nine spokes from a hub, four rings
of sagging capture silk, a spider that descends and climbs its own silk, and the
whole assembly swinging as one damped pendulum. Hover wakes it and the spider
climbs; `prefers-reduced-motion` skips the animation whole and leaves the
drawing finished and still. The class decides the box and the ink.

`Logo` is the corner mark: the web, at the size a corner mark actually appears.
It is one filled path, in one ink that it inherits, so it wears any surface. It
comes in three sizes, which are the theme's own spacing steps: `sm` (a rail,
twenty pixels), `md` (a header, thirty-two) and `lg` (a page, forty-eight). One
drawing serves all three; the mark is scaled, never redrawn.

The corner mark is drawn, not stroked, on purpose. A hairline that suits a hero
is a grey smudge at sixteen pixels, and the wordmark beside it is type — the
theme's brand face — because a wordmark drawn as thread turns to mush at the
size a corner mark appears.

`Web` is that mark on its own: the heavy web the owner chose, for the places a
mark appears without the word beside it — the studio's rail, the site's icon.
`WebGlyph` is the same drawing at a favicon's size: the heavy web needs no
second version, because one filled path holds its edge at sixteen pixels.

## Attribution

The mark is not ours. It is the **Spider web** icon of the **Game Icons** set,
made by **Lorc**, and it is used here under the **Creative Commons Attribution
3.0 Unported (CC BY 3.0)** licence.

- Author: Lorc — <http://lorcblog.blogspot.com>
- Collection: Game Icons, by Delapouite — <https://game-icons.net/>
- The icon: Spider web — <https://game-icons.net/1x1/lorc/spider-web.html>
- Licence: CC BY 3.0 — <https://creativecommons.org/licenses/by/3.0/>

The licence asks a derivative work to say who made the icon, so the credit
travels with the mark: this README, the npm package it ships in, and the
documentation site.

## Notes

The kit styles itself with the same vocabulary as everything else, so the app
that uses it scans the kit's sources along with its own — the docs site does
exactly that, so the picker's classes exist in its sheet.

The kit's own tests render its components to a string. Deno has no DOM, and
Solid's automatic runtime is the DOM one, so the kit carries a small server
runtime (`src/ssr-jsx.ts`) that its JSX compiles against under Deno. The apps
never load it: they compile the kit with Solid's DOM compiler.
