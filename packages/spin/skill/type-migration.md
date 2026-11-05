---
name: Type migration
slug: type-migration
mood: Moving markup off dead raw type utilities and onto the named styles, one mechanical question at a time.
audience: Anyone migrating markup that sets type — agents fixing lint findings, implementers touching old pages, designers checking the result reads.
anchor: The named-type migration brief, and the typography guide's restyle section.
---

# Moving raw type to named styles

Raw `text-*` sizes and `font-*` families and weights render nothing. The lint
names the style to write instead, and the fix is one question: is the element
already that style's default? Drop the class if so, write the style if not.

## The whole vocabulary

Fourteen styles, each spent as `type-<name>`:

| Style | Reads as | Default on |
|---|---|---|
| `type-display` | hero display | `h1` |
| `type-title` | page title | `h2` |
| `type-heading` | section heading | `h3` |
| `type-lead` | lede paragraph | — |
| `type-body` | body copy | `p` |
| `type-quote` | pull quote | `blockquote` |
| `type-code` | code | `code` |
| `type-link` | link | `a` |
| `type-label` | form label | `h4` |
| `type-caption` | caption, small print | `small` |
| `type-overline` | eyebrow, kicker | `h5`, `h6` |
| `type-stat` | big number | — |
| `type-body-strong` | strong body | `strong` |
| `type-caption-strong` | strong caption | `figcaption` |

Placement is open: any style may sit on any element. The third column is the
default, not a rule — `type-caption` on a `span` is fine.

## The one question

1. **Is the element already the style's default?** (`<p>` + `type-body`,
   `<h1>` + `type-display`, …) → **drop the class**. The theme already reads
   that way; the class changes nothing.
2. **Otherwise** → **write the style the lint names**: replace the raw class
   with `type-X`. One class, whole tuple — never add a second raw class
   beside it to "adjust" the style.

Never keep a raw utility with a reason; reasons are feedback to report back.
The `data-spin-escape` attribute is for one-off display type the theme cannot
name (brand lockups, hero moments), not for the long tail.

## Worked examples

**1. Lede copy that reads body.** `<p class="text-sm">` where the paragraph
should read body: the element's default is `body`, so drop the class:

```html
<p>A paragraph reads body on its own.</p>
```

**2. Eyebrow caption.** `<p class="text-xs font-semibold uppercase">`:
`uppercase` stays (case is not type size); the size and weight become the
style the lint names:

```html
<p class="type-caption-strong uppercase">The kicker above the title.</p>
```

On a `figcaption`, drop the size and weight and keep nothing — the element
already reads `caption-strong`.

**3. Search-result chrome.** `<li class="text-sm">` reading body copy: `<li>`
is not `body`'s default, so name it:

```html
<li class="type-body">The result's summary line.</li>
```

**4. Mono label reading code.** `<span class="font-mono text-xs">`:
`<span>` is not `code`'s default, so name it:

```html
<span class="type-code">spin check</span>
```

**5. Strong inline.** `<span class="font-semibold">` emphasizing body copy:
the lint names `type-body-strong`:

```html
<span class="type-body-strong">The emphasized run.</span>
```

On a `<strong>`, drop the class — the element already reads that style.

## How it drifts back to raw utilities

It drifts the moment a second class "adjusts" a style — a size or weight
beside `type-*` that tunes what the theme already decided. It drifts when a
raw class survives with a comment explaining it, because the comment is doing
the lint's job and the class still renders nothing. And it drifts when a page
reaches for the escape for copy the theme could say, because two escapes are
a missing style, not two lockups.

The tell is the raw class. One `text-*` size, and the page is spelling type
letter by letter again.
