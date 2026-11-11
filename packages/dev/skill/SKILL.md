---
name: spin-theme
description: |
  Author a spin theme: a DTCG token document that satisfies the contract,
  passes the gates, and looks like something a person chose. Use when asked
  for a theme, a skin, a palette, a dark mode, a reskin, or a new look for a
  spin product.
triggers:
  - "spin theme"
  - "author a theme"
  - "new theme"
  - "reskin"
  - "dark mode for spin"
---

# Authoring a spin theme

A spin theme is one JSON document of design tokens. The build reads it and
writes CSS custom properties; every utility and every element in the library
resolves against those properties. A theme is written, not generated: the
starter can give you the look, and no tool can decide what the product should
look like.

This file is the method. It is written to be followed.

## What you are making

One document, at `spin/<name>.json` in the project, or
`packages/theme/src/languages/<name>.json` if it is a design language the package ships.
The document declares groups of tokens; each token is a value and, where the
group does not already say it, a type.

You also produce the decisions behind the document. The tokens are the machine
form of the decisions; the decisions are what a person reviewing the theme needs
to read. Keep them somewhere: the document's own `$description` fields are one
place, and they are the place the studio shows.

## The three layers

- **The house skill** is this file: the order of the work, the gates, and the
  standard a theme is held to. It says nothing about what the theme should look
  like.
- **A style reference** is a direction: a named look with its own rules, one
  file per style, installed beside this file in the skill's own directory. It
  says what to spend the axes on. Read the one that matches the product, and
  only that one.
- **The theme** is house plus style plus the product's own decisions. The
  product's decisions are the ones nobody could have guessed: the name of the
  product's primary action, the one colour the brand already owns, the density
  the users work at.

The style references travel with the skill, by file:

| Style                  | What it is for                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `high-end-agency`      | A near-black, near-monochrome surface where the type and the space do the talking. Work that has to be looked at carefully.                  |
| `editorial-minimalism` | A printed page: warm paper, a serif that reads, and rules where other systems have boxes. Long-form reading.                                 |
| `industrial-brutalism` | A machine's panel: a rigid grid, a visible frame, one hazard colour, and type that shouts in one place. Data-dense tools.                    |
| `warm-soft-saas`       | A friendly product: warm neutrals, a soft accent, round everything, and enough air that a form feels like a conversation.                    |
| `dark-tech-cinematic`  | A dark instrument: deep blacks, one luminous accent, and light that comes from the screen. Tools used for hours in a dim room.               |
| `morphism`             | A material: surfaces pressed into the page or moulded out of it, with light doing the shaping. Consumer products that want to feel physical. |

If the style references did not come with the skill, the table above is still
enough to start: pick a row, or pick none of them and write the thesis first.

## The half hour

| Minutes  | What happens                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| 0 to 5   | Write the thesis. One sentence: what the product is, and what it feels like to use. Nothing else until this exists. |
| 5 to 12  | Decide the axes in one pass: type, shape, depth, ink and surface, motion. One pass. Do not dither.                  |
| 12 to 22 | Fill the document. The checklist below, group by group, in the order the document reads.                            |
| 22 to 27 | Run the gates. The battery first, then the rendered checks. Fix what they found.                                    |
| 27 to 30 | Look at it. Both modes, one real page, and a person.                                                                |

If minute 22 arrives and the theme still looks like a recolour, the thesis was
not a thesis. Go back to minute 0.

### The thesis

One sentence, in the document's own `$description`. What the product is, and
what it feels like to use. "A technical tool set like a printed journal: warm
paper, a didone for display, one red ink, and rules where other systems have
shadows."

A thesis that names a colour, a font or a style is not a thesis. It is a
decision you made before you knew what you were deciding.

### The axes, in one pass

Five decisions, and each one constrains the others. Decide them together,
against the thesis, and write them down before you open the document.

- **Type**: one working face, one display face at most, and the size of the jump
  at the top of the scale.
- **Shape**: the radius language, and how heavy the edges are.
- **Depth**: whether things are drawn or lit, and what separates them when they
  are neither.
- **Ink and surface**: how many surfaces, how they separate, where the accent is
  allowed to go.
- **Motion**: how long, and with what curve.

## The checklist

The checklist is the theme's own groups, in the order the document reads. For
each one: what it is for, what a good answer looks like, and what a lazy answer
looks like.

The scales and the machinery are here, and so are the per-element groups: the
decisions that belong to one element rather than to the system, and the place a
theme styles one element independently of the scales that element otherwise
wears.

A per-element group earns its place only where that independence means
something. A card is not a button and need not round the same way. A field is an
object and a divider is a line, so their edges are not the same weight. A badge
is small enough that the radius language shows at its tightest, so a theme's
shape reads there before it reads anywhere else. Where the independence means
nothing, the group's token is a second name for a scale step, and the honest
answer is to leave it out: every one of them falls back to the system's answer,
so a theme that declares none of them is still a complete theme.

### color

**For.** The structure of the palette: how many surfaces, how they separate,
where the accent is allowed to go, what each status colour means, and which ink
goes on which fill.

**Good.** A ramp of tinted neutrals, never pure black on pure white. Three or
four surface steps that separate by lightness rather than by shadow. One primary
and at most one accent; the neutrals carry the weight and the accent is spent on
small things, a mark, a link, a focus ring. Status colours quiet enough to sit
beside the accent without competing, and dark enough to read as words on the
page. Every fill paired with the ink that goes on it, including the fills
nothing looks at until something goes wrong — and the pairing is a role, not a
habit: `on-semantic-success` belongs to the success fill, `on-semantic-warning`
to the warning fill, `on-secondary` to the secondary fill and `on-accent` to the
accent fill, and each of them has a floor that says so.

**Lazy.** A primary that is the same value as the text, so every link in the
prose disappears while the buttons look perfect. Four accent hues fighting over
the same sentence. Status colours brighter than the brand. A fill with no ink of
its own, so the label is whatever the browser paints. A white ink on a pale
amber badge, because the pairing was never measured.

### font

**For.** The voices, the scale, the weights, the tracking.

**Good.** One UI family used with conviction, and one display family that speaks
only where a display may speak. A scale whose steps are real decisions, with a
display step that is a jump rather than an increment. Hierarchy from weight and
size, so no second typeface is spent on making headings look different. Labels
set small and tracked open. Tabular figures where numbers are read in columns.

**Lazy.** The same sans everywhere and a second family that differs only in
weight. A scale that runs fourteen, fifteen, sixteen, eighteen, twenty,
twenty-two. A display step one and a half times the body. Tracking applied to
everything, so the prose looks spaced out.

### focus

**For.** The ring every interactive element shares: buttons, links, fields,
summaries, dialogs.

**Good.** A width that is visible, because a one pixel ring reads as a rendering
artifact rather than a decision. An offset that separates the ring from the
control it is on. A colour that does not mean anything else, usually the accent
or the link colour, and never the destructive red.

**Lazy.** The ring inherits the control's own colour and disappears on the
coloured control it is drawn on. Or the ring is dropped in favour of a colour
change, which nobody using a keyboard can follow.

### spacing

**For.** The rhythm and the density. Every gap, pad and inset is one step of
this scale.

**Good.** A base unit, usually four or eight pixels, that the steps are
multiples of, and a ladder that has a shape: the small steps are tight enough
for a control's inside, the middle steps carry a card, and one roomy step is
reserved for the gap between two sections of a page. The density the product
wants is visible in the small steps: a dense tool's row height and a reading
surface's measure come from here.

**Lazy.** A ladder of four values that double, so every gap is either cramped or
cavernous and nothing sits in between. Or so many near duplicates, fourteen and
fifteen and sixteen, that the choice becomes arbitrary and the rhythm stops
existing.

### radius

**For.** The shape of the corners. This is a character, and it is one of the
first things anyone sees and one of the last things anyone can explain.

**Good.** A character chosen: square, soft, or pill. A ladder that has that
character, where the small step is nearly square, the large step is clearly
round, and `full` is there for the cases that really are a pill. The gap between
the steps says something on its own.

**Lazy.** One radius everywhere, so nothing can be said about the theme. Or a
ladder of arbitrary values, two and six and ten, that spells no character and
reads as an accident.

### border

**For.** The stroke weight every control and surface draws with.

**Good.** One hairline as the default, and two or three heavier steps that mean
something: the edge of a selected control, the frame of a block. The colour
matters as much as the width, because a hairline that is too strong turns every
surface into a box.

**Lazy.** One width everywhere, so a divider and a field's edge read the same
and the page has no hierarchy of lines.

### opacity

**For.** How much of a thing is shown, as a fraction. The steps a rule reaches
for.

**Good.** A short ladder where each step has a job: a ghost for decoration, a
dim for a disabled control, a middle for a placeholder, one for shown. A theme
that spends a low opacity on a dead control has decided that the dead control
still has to say what it says, and has chosen the ink that goes on it.

**Lazy.** A full zero to hundred scale with no opinion, so "disabled" means
whatever the rule asked for. Dimming with opacity spends it on the whole
element, so the label dims with the fill and the control stops being readable.

### motion

**For.** The timing signature. Motion points; it does not perform.

**Good.** Four durations with names that say what they are for: fast for a state
change the reader has already decided to expect, base for a transition, slow for
a panel, and loop for the endless ones — the skeleton's pulse, the spinner, the
status dot. Two or three curves: an entrance that eases out, an exit that eases
in, and a standard that lands a press. The loop is a step of its own, so a theme
that wants a two-second pulse says so without making every panel's transition
two seconds long, and it never sits below the floor below which an endless
animation reads as a strobe. The loop is not a transition: `duration-loop` is
not a class, because a transition that takes as long as a pulse is not what a
transition is. The endless animations spend the loop directly.

**Lazy.** A sheet of near-identical durations, or one duration for everything. A
bounce on a control that should land. A loop faster than a quarter of a second.
A slow transition carrying the loop, so every page that uses `duration-slow`
inherits a pulse.

### breakpoint

**For.** The viewport widths where the layout steps change.

**Good.** A few widths that mean something: where a column becomes two, where a
rail becomes a drawer, where the type steps up. Named for what changes there. A
product that never reflows may declare one width and be right.

**Lazy.** The device widths copied from a framework, none of which corresponds
to anything in this product.

### z-index

**For.** The stacking order, so a layer is a decision and not a number typed at
the call site.

**Good.** A named layer per kind of thing, and the numbers spaced so a layer can
be inserted between two without renumbering the world.

**Lazy.** Arbitrary numbers, or one number for everything, so a dropdown and a
toast fight and the document order decides.

### icon

**For.** The glyph sizes.

**Good.** A ladder measured in `em`, so a glyph tracks the control it sits in,
with steps that are real jumps. A step of an eighth of an em against sixteen
pixel prose is two pixels, which is nothing.

**Lazy.** Three sizes that differ by two pixels, so the ladder is invisible and
every icon is nudged by hand where it is used.

### avatar

**For.** The size ladder of a face.

**Good.** Three sizes with jobs: in a list or a comment, beside a name, and as
the subject of a page. The ratios are chosen so the face does not lead the row
it sits in.

**Lazy.** One size for everything, so the profile header is the same size as the
avatar in a comment and the page has no scale.

### element

**For.** The contract knows this group; nothing here says what it is for yet.

### link

**For.** The rule under a link in prose.

**Good.** A hair at the width of the rule the rest of the theme draws with, or
none at all when the colour alone carries it. A link is a word on the page, not
a sticker on it.

**Lazy.** The browser's default underline, which is thicker than the theme's
rules and in a colour the theme never chose.

### button

**For.** The voice of the primary control. It is the element a reader sees first
and judges the theme by.

**Good.** A weight heavier than the prose around it. A case that suits the
label: capitals want air, sentence case wants none, and the two go together. An
elevation at rest and a different one when touched: a flat block that lifts by a
hard offset, or a fill that deepens.

**Lazy.** Caps, bold, red, and a shadow, so the button shouts over the thing
next to it. Or every value left at the fallback, so the control is whatever the
platform draws.

### stat

**For.** The contract knows this group; nothing here says what it is for yet.

### card

**For.** The surface that holds other things: its own corner, its own air, its
own edge, its own elevation.

**Good.** Each one decided. A card is not a button and need not round the same
way. The elevation is usually none: a card is paper on paper, separated by a
hairline and by air, and a shadow would make it a photograph of a sheet.

**Lazy.** The fallback on every token, so the card is a rounded rectangle with a
soft shadow, identical to every other surface, and the page has no figure and no
ground.

### alert

**For.** The message that has to be read.

**Good.** Its own corner, and its own air, with more above and below the text
than beside it, because the text is read in a line. Its own edge. The tone
variants recolour one edge of the same frame, so an error and a notice are the
same object in two colours.

**Lazy.** A coloured box at the page's radius and the page's padding, so the
only difference between a warning and an error is a fill.

### field

**For.** The control a finger has to find.

**Good.** Its own corner, and its own edge, and the edge a step stronger than
the dividers around it, because a field is an object and a divider is a line. A
field that is only as strong as a rule is a hole in the page.

**Lazy.** The page's hairline, so the field reads as a row of text rather than
as something you can put a cursor in.

### badge

**For.** The small tag, and what shape it is.

**Good.** A decision about the shape, a square tag or a pill, and about the
edge, so the tag holds apart from the page it sits on. A pill says a soft word;
a square tag says a label. The badge is where a theme's radius language shows at
its smallest size, so it is worth deciding.

**Lazy.** Left at the fallback, so the badge is a rounded rectangle of unknown
provenance, or made a pill because pills are in fashion.

### table

**For.** The data grid, and the reading of it.

**Good.** A header weight that names the column without a rule of its own. A
rule under the row at the page's hairline weight. A striped fill one step below
the page, so a reader can hold their place across a wide table without the
stripes becoming a pattern to look at.

**Lazy.** A zebra fill two steps off the page, so the stripes read as a design
decision rather than as help, and a header that is only separated by weight in a
face too small to carry it.

### checkbox

**For.** How physical the box is: one scalar, driving three inset shadows.

**Good.** A decision, and it is a real one. Zero is flat and drawn, an outline
with a tick in it. Higher is lit and raised, a surface catching the light. The
scalar is one decision, so it cannot half happen.

**Lazy.** A depth nobody chose, so the box is half embossed and half flat and
reads as neither.

### switch

**For.** The same question as the checkbox, asked of a different control.

**Good.** The switch answers with the same depth the checkbox does, so the two
controls in one form look like they came from the same machine. A lit switch
beside a drawn checkbox is a bug the theme can prevent.

**Lazy.** The default depth, so the switch floats above the surface while the
checkbox beside it is drawn onto it.

### tooltip

**For.** The contract knows this group; nothing here says what it is for yet.

### shadow

**For.** The elevation ladder. Either a ladder, or nothing.

**Good.** A ladder with meanings: resting, raised, and the overlay that sits
above everything. Each step says what height is in this theme. Or `none` at
every step, with the separation carried by hairlines and air, which is a
decision and often the better one. A hard offset with no blur reads as print; a
diffuse shadow reads as light. Pick one and stay in it.

**Lazy.** The same shadow at every step, so every box is a box. A shadow on
every surface, so nothing is a surface. Three shadows stacked on a card that
never has to float.

## Filling the document

The shape of a token:

```json
"primary": {
  "$type": "color",
  "$value": "#c8102e",
  "$description": "The brand's red.",
  "$modes": { "dark": "#ff5a63" }
}
```

- `$type` may be declared on the group, and then every token under it inherits
  it. Declare it once per group, not once per token.
- `$description` is for the person who opens the file. Write what the token is
  for, not what it is.
- `$modes` holds the value a token takes in another mode. Only colour and focus
  vary by mode: a dark mode changes ink and surface, not space and type. A mode
  the theme does not serve is a value nobody ever sees, and a mode that restates
  anything but the ink is a second set of scales nobody measured — the battery's
  invariance gate says so.
- An alias is a value written as another token's path in braces,
  `"{color.neutral.50}"`. Use aliases for anything that means the same thing in
  two places, so the palette can change under them.
- `modes` at the root of the document says which modes the document serves. A
  theme that serves dark and restates nothing for it renders the light mode
  twice — unless its base is already dark, which is what a terminal palette is,
  and then there is nothing to restate. A theme that serves dark and restates
  half of it is half a theme.

Start a new document from a starter with `{ "$extends": "minimal" }` plus the
tokens the project owns, or vendor a starter whole. The starter's values are
valid, legible, and a finished look — every token they state is a decision
the starter made, and every token the document adds is one the project owns.

## The gates

Run them in this order. The first three are mechanical and they live in one
call; the fourth is a browser; the fifth is a person.

`validateTheme(text, { required, modes })` from `@spinjs/theme`. The same judge
the studio's issues panel uses, so the same answer.

`required` is the list of paths the document must declare. Absent, it is the
contract's base roles — the palette, the floors that make it usable, and the
focus ring plus `elementPaths()` from `@spinjs/theme` for every element the app
enables. `modes` is the claim about which modes the theme serves; absent, the
document's own root `modes` says it.

What the failures mean:

- **missing required token**: the decision was never made, so the consumer's
  browser default answers for you. Add the token or remove the claim.
- **token has no value**, **invalid color value**, **dimension needs a CSS
  unit**, **text-transform must be one of**: the value cannot be checked, so the
  stylesheet will carry something the browser refuses. Fix the value, not the
  type.
- **alias does not resolve to a token**: the reference points at nothing, and
  the property it emits falls back to unset.
- **alias cycle**: two tokens point at each other.
- **two tokens emit the same property**: two names for one custom property, and
  one of them silently loses.
- **the theme does not serve that mode**: a value written for a mode nobody will
  ever see. A promise nothing keeps.
- **group has no tokens**: a branch of the document that says nothing.

And the one the validator cannot see: **a starter value left in place.** The
validator says the document is valid, because a starter's values are valid.
Read the document and ask of every token: did the project decide this, or did
the starter decide it?

### Gate two: legibility

The floors are the contract's own list: body ink on the page and on the raised
sheet above it at four and a half to one, muted ink on the page and on the
raised sheet at three to one, the ink on a primary, a secondary or an accent
fill at four and a half to one, the ink on a success, a warning, an error or an
info fill at four and a half to one, the ink on a disabled fill at four and a
half to one, the focus ring on the page at three to one, the link on the page at
four and a half to one, and each status colour on the page at four and a half to
one — a status colour is worn as ink as often as it is worn as a fill, so it
owes the text floor rather than the non-text one.

Every fill has an ink of its own, and the ink is a role: `color.on-secondary`
and `color.on-accent` are asked for like `color.on-primary`, because the badge
spends the secondary and the accent tones as filled pills with a word on them,
and a fill with no ink of its own is a label nobody can read.

`validateTheme(text, { required, modes, mode })`. The `mode` option is the one
that measures legibility IN a mode: the document is judged as it reads there, so
the dark palette's own fills and inks are the ones measured and not the light
ones. Run it once per mode the theme serves, and once with no `mode` at all for
the base document.

A failure here is not a preference. A fill without a readable foreground is an
error: the reader cannot read the button, and nothing else in the theme matters.

### Gate three: the battery

`themeGates(text, { required, modes })` — every mechanical gate in one call:
completeness, the floors in every mode the theme serves, the scale ladders, the
loop's strobe floor, the mode coverage, and the mode's invariance. It answers
with one result per gate, so a failure says which gate it belongs to. The
options are the ones above: `required` is the roles the app owes, `modes` is the
claim the theme makes.

```ts
import { themeGates } from "@spinjs/theme";

const report = themeGates(text);
for (const gate of report.gates) {
  for (const issue of gate.issues) {
    console.log(`${gate.gate}: ${issue.path} — ${issue.message}`);
  }
}
```

What the battery adds to the two gates above:

- **scales**: a ladder is a ladder. A spacing step smaller than the one before
  it, a radius ladder that descends, or two elevation steps that spell one
  shadow under two names, is a scale with no shape.
- **motion**: the loop step — `motion.duration.loop`, what every endless
  animation spends — holds the strobe floor. A loop under a quarter of a second
  is a flash, and a flash is a defect rather than a character choice.
- **modes**: every mode the theme serves is a mode it has. A theme that serves
  dark and restates nothing for it renders the light mode twice, which is a
  promise nothing keeps.
- **invariance**: a mode changes ink and focus, and nothing else. The scales and
  the loop are judged once, on the base document, so a mode that restates the
  spacing or the type scale is a second set of decisions nobody measured.

Run it against the document you just wrote — a project theme, not a starter:

```sh
bun -e "
import { readFile } from 'node:fs/promises';
import { themeGates } from '@spinjs/theme';
const text = await readFile('spin/<name>.json', 'utf8');
const report = themeGates(text);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
"
```

### Gate four: the rendered checks

The checks drive a real browser over the app's routes, in every theme and every
mode the app serves, and measure what the browser painted. The harness needs the
app to be running, and it runs the app's own configuration — in this repository,
the reference app's:

```sh
bun run serve                                # the reference app, on http://localhost:5173
bun run visual --url http://localhost:5173   # the check harness, over every route
```

The `--url` is the app under test, and it is worth naming: the harness measures
whatever answers there, so a server left running from another session is a theme
measured against a stale build.

For an app of your own, the same harness with your app's own facts:

```sh
spin check http://localhost:5173 --config <your app's visual/check.ts>
```

- **contrast**: the text on that surface does not read. The measured ratio is in
  the report.
- **state contrast**: every filled control, in rest, hover, focus, pressed and
  disabled, measured against its own fill. The states are where themes fail,
  because the resting state is the one that was looked at. This check reports
  and does not fail the run; `--state-contrast-strict` makes it decide.
- **geometry**: the size the theme claims is not the size the browser painted.
- **zero-area interactive**: a control a pointer cannot reach, usually a padding
  or a height of zero.
- **strobe animation**: an endless animation under the floor below which it
  reads as a flash.
- **render defect**: the page did not render.
- **console error**, **failed request**: the theme broke the page.

### Gate five: the look

A person, on a render. No script decides this, and a script that claimed to
would be measuring its own author.

Where to look, in the order that catches the most:

- **The studio.** Every element, live, in both modes, with the values in view,
  at the element's own size and density. A theme that looks right there is right
  in the product.
- **A real page.** A table, a form, a long document, a dense list. A theme that
  only works in specimens falls apart in a table.
- **The montage.** Every theme in one screenshot. If two of them are
  interchangeable, one is not finished.

## The judgement

What to look for, in this order.

1. **Distinctness.** Could this be any other theme with different hexes? If so
   it is a default, not a theme. Cover the product's name and look again.
2. **Completeness.** Every token decided, no starter value left unowned, every declared
   mode restated.
3. **Legibility in every state.** Rest, hover, focus, active, disabled, in every
   mode. A fill always has an ink.
4. **Restraint with effects.** Shadow, blur, lift, glow. Each asks for
   attention. A theme that spends all of them spends none of them.
5. **Dark mode designed, not inverted.** A dark mode is a second palette with
   its own ink, not the light one with the lightness taken out. The surface goes
   dark first, then every colour is asked whether it still means what it meant.

Then the two tests that catch a recolour:

- **The montage.** Every theme in one screenshot. If two of them are
  interchangeable, one is not finished.
- **The real page.** A table, a form, a long document, a dense list. A theme
  that only works in specimens falls apart in a table.

And the ten second test: the first thing a person sees should be the product,
not the theme.

## What a theme that misses the bar looks like

| Symptom                                      | Cause                                              | Fix                                                            |
| -------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| It reads as a recolour                       | The axes were inherited, not decided.              | Go back to the thesis. Pick the axis it lives on and push it.  |
| One radius and one shadow everywhere         | The defaults were never replaced.                  | Shape and depth are the two groups authors skip.               |
| Buttons shout in caps and red                | The character tokens were inherited.               | The control's voice is a decision, not a default.              |
| A dark mode that is the light one, inverted  | The modes were not designed.                       | Re-pick the surfaces, re-pick the accent, re-pick the ink.     |
| A badge nobody can read                      | The pairing was never measured.                    | The ink on the fill, and the floor that holds it.              |
| Every transition takes two seconds           | The loop was carried by the slowest transition.    | Give the loop a step of its own.                               |
| It looks good in swatches and bad in a table | It was judged on specimens.                        | The real page is the yardstick.                                |
| An illegible button in hover or disabled     | The states were never looked at.                   | The state contrast check. The states are where themes fail.    |
| Every surface is a card                      | Depth is doing the work that whitespace should do. | Flat surfaces, and let the air and the hairline separate them. |

## What is not a theme's business

Layout archetypes, the variance mandate, block coherence, screen economy, the
spacing between blocks, and the composition of a page. Those are a page's
business and belong to the patterns section of the documentation. A theme
supplies the materials; a pattern arranges them.

A theme also does not decide the product's content, its words, or its icons. It
decides the material those things are made of.

## The output

- The theme document, at `spin/<name>.json` or in the package's themes
  directory.
- The decisions behind it, in the document's own descriptions.
- The gate results: the battery's report — one entry per gate, each with the
  issues it found — the measured contrast ratio for each pair, and the state
  contrast run.
- A note of every place the brief was bent, and why.
