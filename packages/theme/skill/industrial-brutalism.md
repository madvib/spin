---
name: Industrial Brutalism
slug: industrial-brutalism
mood: A machine's panel, with a rigid grid, a visible frame, one hazard colour, and type that shouts in exactly one place.
audience: Data-heavy tools, telemetry, and anything read as numbers rather than read as prose. Also a portfolio for people who would rather be seen as precise.
anchor: The ux-ui kit's industrial archetype, and the open-design corpus's brutalism, neobrutalism, hud and hashicorp systems.
---

# Industrial Brutalism

The interface is a machine, and the machine does not apologise for how it looks.
It has a frame, a grid, and a label for everything, and the reader who needs it
will thank you for the density.

This is the direction for a tool whose job is to show a lot of state at once: a
fleet console, a trading screen, a declassified document. It is deliberately
unfriendly in the way a good instrument is unfriendly: nothing is rounded,
nothing is soft, and nothing is there that is not load-bearing.

## The type voice

Two voices, never three. A heavy grotesque for the structural headers, set in
capitals, tracked tight, with the leading compressed so the words form a block
rather than a line. A mono for everything else that carries information: data,
labels, metadata, coordinates, unit identifiers.

The mono is set small, in the eleven to thirteen pixel region, and tracked open,
in capitals, the way a terminal or a typed report sets it. The two faces are
chosen to disagree: a condensed or very heavy sans against a humanist mono.

The structural type is the shout. It appears on a page head or a section marker,
and nowhere else, which is what keeps the shout a shout.

## The palette direction

One substrate, chosen once, and used consistently. Unbleached documentation
paper around `#f2f1ec`, or a deactivated CRT around `#0d0d0f`. Never both in one
interface, and never a mid grey.

Carbon ink, close to black but never pure, and one hazard colour: a red around
`#e61919`, used for the vital number, for a strike-through, or for a structural
rule. It is the only colour in the theme. A terminal green may be used for
exactly one thing, one indicator or one readout, and if it does not serve a
purpose it is omitted.

## The shape

Exactly ninety degrees. Zero radius on every corner of every surface, no
exceptions, and the radius ladder is a single zero rather than a scale.

Borders are one or two pixels and they are visible: they compartmentalise the
page into zones, the way a panel is divided into bays. The border weight is not
a hairline here; it is a frame.

## The depth

Nothing floats. Depth is carried by the frame and the grid, and by the hierarchy
of type sizes. There is no shadow, no blur, no glow.

If a shadow must exist, it is a hard offset with no blur, the same way a
stencil's edge is hard, and it is used once, on the thing that is meant to be
the focus.

## The motion

Fast and mechanical, in the eighty to one hundred and forty millisecond region,
with a linear or hard ease-out curve. No overshoot, no spring, no bounce. A
state changes and it has changed.

Motion is not an entrance in this style. An element that appears is simply
there. The only motion worth spending is a value that is live and changing.

## The density

Very dense. Rows of twenty-four to twenty-eight pixels, mono at twelve, no
padding between everything, and the air spent in one place only: an oversized
number or a structural header, so the page has a single loud element instead of
a uniform hum.

## The decisions that make it recognisable

1. **Ninety-degree corners and visible compartment lines.** Not a style choice
   applied to a page: the lines are the page's structure.
2. **One hazard colour on an otherwise monochrome ground.** Red means the thing
   that matters, and nothing else is coloured, so red still means it.
3. **A mono carrying every label, in capitals, tracked open,** against a heavy
   grotesque for the structure.

## How it drifts into the house style

It drifts when a radius creeps in, because the first rounded corner is the end
of the machine. It drifts when the red multiplies into a second and a third
accent, because a palette is a palette and the hazard colour stops meaning
anything. And it drifts when the hairline turns into a soft shadow, because the
compartments become floating cards and the page becomes a set of boxes with data
in them.

The tell is the radius. Four pixels of radius and the frame is a card.
