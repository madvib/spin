---
name: spin-type
description: |
  Write type with spin's named styles: one type-<name> class that spends the
  whole tuple, element defaults that read on their own, and the lint's style
  suggestion when a raw class fails. Use when writing or fixing markup that
  sets type, migrating text-* or font-* classes, or restyling a run of text.
triggers:
  - "spin type"
  - "type style"
  - "text-sm to type"
  - "migrate type classes"
  - "restyle text in spin"
---

# Writing type with named styles

Write semantic HTML and get finished type. Every element arrives carrying a
named style, and one `type-<name>` class changes the voice — the whole tuple
at once, never letter by letter.

This file is the method. It is written to be followed.

## What you are making

Markup that reads: elements wearing the style they already carry, and one
`type-<name>` class wherever the run should read differently. The styles live
in the theme under `font.style.*`; the list below is what this theme declares
today, because the file is assembled from the theme's own data.

Read the [migration reference](type-migration.md) beside this file for the
drop-vs-name decision tree and the worked examples.

## The three facts

Write `<h1>` and get the page's loudest statement; write `<p>` and get the
reading voice; write `<small>` and get the small print. Each element carries
one named style by default, so markup reads as a document instead of a pile
of sizes: `<h1>` reads `type-display`, `<h2>` reads `type-title`, `<h3>`
reads `type-heading`, `<h4>` reads `type-label`, `<h5>` and `<h6>` read
`type-overline`, `<p>` reads `type-body`, `<blockquote>` reads `type-quote`,
`type-caption`, `<strong>` reads `type-body-emphasized`, `<figcaption>` reads
`type-caption-emphasized`.

To change how a run of text reads, write one `type-<name>` class. It spends
the whole tuple — face, size, weight, tracking, leading — at once. Never add
a second raw class beside it to "adjust" the style: sizing and weighing by
hand with `text-sm` or `font-medium` names nothing the theme can make, so the
build fails and names the style to write instead.

A style is a voice, not a seat: put any declared style on any element.
`<span class="type-caption">` captions a figure from inside a paragraph, and
no warning fires about where a style sits. The only constraint is the
vocabulary: the style must be one the theme declares, so `type-headline` on
a theme with no `font.style.headline` fails the build and names the nearest
style that exists.

Raw `text-*` sizes and `font-*` families and weights are dead: they render
nothing. Every one of those errors carries the style to write instead — "did
you mean `type-caption`?" is the fix, not a guess. `uppercase` stays; case is
not type size, and the lint leaves it alone.

One voice on a page may be genuinely one-off: a brand lockup or a hero moment
no theme scale has reason to name. Display type the theme cannot name belongs
in the brand's `tokens.json` as a named style, and the utility is `type-<name>`.

## The styles

The styles the theme declares, each with what it is for and what wears it.
Every one is spent as `type-<name>`; the set lives in the theme under
`font.style.*`, so a designer trims or extends it there and this list follows.

### type-brand

**For.** The theme declares this style; nothing here says what it is for yet.

### type-display

**For.** Write `<h1>` and get the page's loudest statement: the hero, the
page title at its largest, one per page.

**Wears it.** `<h1>` reads this by default. Restyle with
`<div class="type-display">` only where the loudest voice must sit on a
non-heading element.

### type-title

**For.** The page title below the hero: section openers, the title of a long
document.

**Wears it.** `<h2>` reads this by default.

### type-heading

**For.** Section headings inside a page: the subheads a reader scans down.

**Wears it.** `<h3>` reads this by default.

### type-subtitle

**For.** The theme declares this style; nothing here says what it is for yet.

### type-lead

**For.** The lede paragraph: the standfirst under a title, larger than the
reading voice, never the body itself.

**Wears it.** Nothing reads this by default — name it with
`<p class="type-lead">` on the opening paragraph.

### type-body

**For.** The reading voice: body copy, list items that read as sentences, the
default texture of a page.

**Wears it.** `<p>` reads this by default. `<li class="type-body">` where a
list item reads as body copy.

### type-quote

**For.** The pull quote: one voice set apart from the body, with its own
measure.

**Wears it.** `<blockquote>` reads this by default.

### type-code

**For.** Code: identifiers, fragments, and blocks a reader copies.

**Wears it.** `<code>` reads this by default.
`<span class="type-code">` where code must sit inside running text on a
non-code element.

### type-label

**For.** Form labels and control captions: small, tracked open, the voice
that names a control rather than reading as copy.

**Wears it.** `<h4>` reads this by default; buttons wear it as their label
voice.

### type-caption

**For.** Captions and small print: footnotes, hints, the quietest voice that
still reads.

**Wears it.** `<small>` reads this by default.
`<span class="type-caption">` captions from inside any element.

### type-overline

**For.** The eyebrow, the kicker: the small tracked-open line above a title
that says what the title is about.

**Wears it.** `<h5>` and `<h6>` read this by default.

### type-body-emphasized

**For.** Strong body: the emphasized run inside the reading voice.

**Wears it.** `<strong>` and `<dt>` read this by default.
`<span class="type-body-emphasized">` emphasizes inside a non-strong element.

### type-caption-emphasized

**For.** Strong caption: the emphasized run inside small print — table
headers, figure labels that must hold their weight at small sizes.

**Wears it.** `<figcaption>` and `<th>` read this by default.

## The one question

The lint names the style ("did you mean `type-X`?"). Ask one question:

1. **Is the element already the style's default?** (`<p>` + `type-body`,
   `<h1>` + `type-display`, …) → **drop the class**. The theme already reads
   that way; the class changes nothing. The fix is deletion.
2. **Otherwise** → **write the style the lint names**: replace the raw class
   with `type-X`. One class, whole tuple — never add a second raw class
   beside it to "adjust" the style.

Never keep a raw `text-*` size or `font-*` family or weight with a reason.
Reasons are migration feedback — report them back, don't act on them.

## The output

- Markup where every run of text either wears its element's default or names
  one `type-<name>` style.
- Zero raw `text-*` sizes and `font-*` families or weights.
- A note of every place the lint's suggestion was bent, and why.
