# Spin primitives reference

Generated from the primitive manifest (`@spinjs/preset`) and the design
languages' `font.style` entries (`@spinjs/theme`). Do not edit by hand —
run `bun run skill` in `packages/dev` to regenerate.

## Actions

### breadcrumbs

Write `<a>`, `<li>`.


Closed variants: `breadcrumbs`, `breadcrumbs-arrow`, `breadcrumbs-box`, `breadcrumbs-list`.

### button

Write `<button>`, `<span>`.

- `<button>` owns background, corner, decoration, edge, elevation, face, ink, size, tracking, weight.
- `<span>` lays out only.

Closed variants: `bare`, `button-icon`, `contrast`, `danger`, `ghost`, `icon`, `outline`, `primary`, `s-lg`, `s-sm`, `secondary`.

Brand tokens a brand states for this primitive:
- `button.shadow` (shadow).
- `button.shadow-hover` (shadow).

### join

Class-only primitive: no bare tag.


Closed variants: `join`, `join-item`.

### kbd

Write `<kbd>`.

- `<kbd>` owns background, corner, edge, elevation, face, ink, size.

No variants.

## Inputs

### checkbox

Write `<input>`.

- `<input>` owns background, corner, edge, elevation, ink.

No variants.

Brand tokens a brand states for this primitive:
- `checkbox.depth` (number).

### field

Write `<input>`, `<select>`, `<textarea>`.

- `<input>` owns background, corner, edge, elevation, face, ink, size.
- `<select>` owns background, corner, edge, elevation, face, ink, size.
- `<textarea>` owns background, corner, edge, elevation, face, ink, size.

Closed variants: `bare`, `s-lg`, `s-sm`.

### label

Write `<label>`.

- `<label>` owns face, ink, size, weight.

No variants.

### meter

Write `<meter>`.

- `<meter>` owns background, corner, edge, face, opacity, size.

No variants.

### radio

Write `<input>`.

- `<input>` owns background, corner, edge, elevation, ink.

No variants.

### switch

Write `<input>`.

- `<input>` owns background, corner, edge, elevation, ink.

No variants.

Brand tokens a brand states for this primitive:
- `switch.depth` (number).

## Containers & layout

### card

Write `<card>`, `<card-action>`, `<card-content>`, `<card-description>`, `<card-figure>`, `<card-footer>`, `<card-header>`, `<card-title>`.

- `<card>` owns background, corner, edge, elevation.
- `<card-action>` lays out only.
- `<card-content>` owns ink.
- `<card-description>` owns ink, size, weight.
- `<card-figure>` owns edge.
- `<card-footer>` lays out only.
- `<card-header>` lays out only.
- `<card-title>` owns face, ink, size, tracking, weight.

Closed variants: `card-default`, `card-ghost`, `card-narrow`, `card-wide`.

Brand tokens a brand states for this primitive:
- `card.radius` (dimension).
- `card.padding` (dimension).
- `card.border` (color).
- `card.elevation` (shadow).

### details

Write `<details>`, `<summary>`.

- `<details>` owns background, corner, edge.
- `<summary>` owns background, corner, edge, ink, weight.

No variants.

### dialog

Write `<dialog>`, `<footer>`, `<h1>`, `<h2>`, `<h3>`, `<header>`.

- `<dialog>` owns background, corner, edge, elevation, ink, opacity.

No variants.

### fieldset

Write `<fieldset>`, `<legend>`.

- `<fieldset>` owns corner, edge.

No variants.

### hr

Write `<hr>`.

- `<hr>` owns edge.

Closed variants: `divider-dashed`, `divider-vertical`.

### panel

Write `<hr>`, `<panel>`, `<panel-list>`.

- `<panel>` owns background, corner, edge, elevation.
- `<panel-list>` lays out only.

No variants.

## Display

### stat

Class-only primitive: no bare tag.


Closed variants: `stat`, `stat-desc`, `stat-row`, `stat-title`, `stat-value`.

### swatch

Write `<swatch>`.

- `<swatch>` owns corner, edge.

Closed variants: `s-lg`, `s-md`, `s-sm`.

### table

Write `<caption>`, `<table>`, `<td>`, `<th>`.

- `<caption>` owns face, ink, size, tracking, weight.
- `<table>` owns edge, face, ink, size.
- `<td>` owns edge.
- `<th>` owns background, edge, face, ink, size, tracking, weight.

Closed variants: `striped`, `wrap`.

Brand tokens a brand states for this primitive:
- `table.rule` (color).
- `table.zebra` (color).

## Feedback & status

### alert

Write `<alert>`.

- `<alert>` owns background, corner, edge, ink, size, weight.

Closed variants: `alert-accent`, `alert-accent-muted`, `alert-danger`, `alert-danger-muted`, `alert-neutral`, `alert-neutral-muted`, `alert-primary`, `alert-primary-muted`, `alert-secondary`, `alert-secondary-muted`, `alert-success`, `alert-success-muted`, `alert-warning`, `alert-warning-muted`.

Brand tokens a brand states for this primitive:
- `alert.radius` (dimension).
- `alert.padding` (dimension).
- `alert.padding-inline` (dimension).
- `alert.edge` (color).

### badge

Write `<badge>`.

- `<badge>` owns background, corner, edge, ink, size, weight.

Closed variants: `badge-accent`, `badge-accent-muted`, `badge-close`, `badge-danger`, `badge-danger-muted`, `badge-info`, `badge-info-muted`, `badge-lg`, `badge-neutral`, `badge-neutral-muted`, `badge-primary`, `badge-primary-muted`, `badge-secondary`, `badge-secondary-muted`, `badge-sm`, `badge-success`, `badge-success-muted`, `badge-warning`, `badge-warning-muted`.

Brand tokens a brand states for this primitive:
- `badge.edge` (dimension).
- `badge.pill` (boolean).

### progress

Write `<progress>`.

- `<progress>` owns background, corner, elevation.

Closed variants: `progress-indeterminate`.

### skeleton

Class-only primitive: no bare tag.


Closed variants: `skeleton`, `skeleton-circle`, `skeleton-text`.

### tooltip

Write `<tooltip>`.

- `<tooltip>` owns background, corner, edge, ink, size.

No variants.

## Typography

### icon

Class-only primitive: no bare tag.


Closed variants: `icon-lg`, `icon-md`, `icon-sm`.

Brand tokens a brand states for this primitive:
- `icon.sm` (dimension).
- `icon.md` (dimension).
- `icon.lg` (dimension).

### prose

Write `<a>`, `<abbr>`, `<b>`, `<blockquote>`, `<body>`, `<canvas>`, `<code>`, `<dd>`, `<del>`, `<dl>`, `<dt>`, `<embed>`, `<figcaption>`, `<figure>`, `<footer>`, `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>`, `<iframe>`, `<img>`, `<ins>`, `<li>`, `<mark>`, `<object>`, `<ol>`, `<p>`, `<pre>`, `<prose>`, `<samp>`, `<small>`, `<strong>`, `<sub>`, `<sup>`, `<svg>`, `<ul>`, `<video>`.

- `<a>` owns corner, decoration, edge, ink.
- `<abbr>` owns decoration.
- `<b>` owns weight.
- `<blockquote>` owns face, size, tracking, weight.
- `<body>` owns background, face, ink, size.
- `<code>` owns background, corner, face, ink, size, tracking, weight.
- `<dd>` lays out only.
- `<dl>` lays out only.
- `<dt>` owns weight.
- `<figcaption>` owns face, ink, size, tracking, weight.
- `<figure>` lays out only.
- `<h1>` owns face, size, tracking, weight.
- `<h2>` owns face, size, tracking, weight.
- `<h3>` owns face, size, tracking, weight.
- `<h4>` owns face, size, tracking, weight.
- `<h5>` owns face, size, tracking, weight.
- `<h6>` owns face, size, tracking, weight.
- `<li>` owns face, size, weight.
- `<ol>` owns face, size, tracking, weight.
- `<p>` owns face, size, tracking, weight.
- `<pre>` owns face.
- `<prose>` lays out only.
- `<samp>` owns face, size.
- `<small>` owns face, ink, size, tracking, weight.
- `<strong>` owns weight.
- `<sub>` owns size.
- `<sup>` owns size.
- `<ul>` owns face, size, tracking, weight.

No variants.

## Utilities

### a11y

Class-only primitive: no bare tag.


Closed variants: `visually-hidden`.

### range

Write `<input>`.

- `<input>` owns background, corner, edge, ink.

No variants.

## Named text styles

Spend one `type-<name>` class to read in that voice.

### type-brand

Tuple: family {font.family.brand}, size {font.size.lg}, weight {font.weight.bold}, tracking {font.tracking.tight}, leading {font.leading.none}.

### type-display

Tuple: family {font.family.serif}, size {font.size.3xl}, weight {font.weight.bold}, tracking {font.tracking.tight}, leading {font.leading.tight}.

### type-title

Tuple: family {font.family.sans}, size {font.size.2xl}, weight {font.weight.semibold}, tracking {font.tracking.normal}, leading {font.leading.snug}.

### type-heading

Tuple: family {font.family.sans}, size {font.size.xl}, weight {font.weight.semibold}, tracking {font.tracking.normal}, leading {font.leading.snug}.

### type-subtitle

Tuple: family {font.family.sans}, size {font.size.lg}, weight {font.weight.medium}, tracking {font.tracking.normal}, leading {font.leading.snug}.

### type-lead

Tuple: family {font.family.sans}, size {font.size.lg}, weight {font.weight.regular}, tracking {font.tracking.normal}, leading {font.leading.relaxed}.

### type-body

Tuple: family {font.family.sans}, size {font.size.md}, weight {font.weight.regular}, tracking {font.tracking.normal}, leading {font.leading.relaxed}.

### type-quote

Tuple: family {font.family.serif}, size {font.size.lg}, weight {font.weight.regular}, tracking {font.tracking.normal}, leading {font.leading.relaxed}.

### type-code

Tuple: family {font.family.mono}, size {font.size.sm}, weight {font.weight.regular}, tracking {font.tracking.normal}, leading {font.leading.normal}.

### type-label

Tuple: family {font.family.sans}, size {font.size.sm}, weight {font.weight.medium}, tracking {font.tracking.wide}, leading {font.leading.snug}.

### type-caption

Tuple: family {font.family.sans}, size {font.size.xs}, weight {font.weight.regular}, tracking {font.tracking.normal}, leading {font.leading.snug}.

### type-overline

Tuple: family {font.family.sans}, size {font.size.xs}, weight {font.weight.semibold}, tracking {font.tracking.wider}, leading {font.leading.snug}.

### type-body-emphasized

Tuple: family {font.style.body.family}, size {font.style.body.size}, weight {font.weight.semibold}, tracking {font.style.body.tracking}, leading {font.style.body.leading}.

### type-caption-emphasized

Tuple: family {font.style.caption.family}, size {font.style.caption.size}, weight {font.weight.semibold}, tracking {font.style.caption.tracking}, leading {font.style.caption.leading}.
