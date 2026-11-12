<!-- Why Spin only flags provable contradictions and dead classes. -->

Spin lints check what the theme can prove — never subjective style. Every
rule names either a dead class with the edit that drops it, or two things
that disagree with which one to keep. If the theme cannot prove a
contradiction, the linter stays quiet.

## The theme is the only way to style

A class the theme cannot produce styles nothing, so `closed-vocabulary`
drops it. A class that says what the element already says is dead weight,
so `no-redundant-class` drops it. A class that fights what the element
already says is a contradiction, so `prefer-theme-value` names the fight
and `no-unpaired-ink` names the wrong ink. What the element says is what
the theme gave it — the element's owned decisions, read from the compiled
theme, not an opinion about how the page should look.

## Variants are closed; `bare` is the quiet one

The theme defines what buttons can exist: `primary`, `secondary`,
`outline`, `ghost`, and the rest are the whole set, and a class list must
not contradict the element it sits on. `bare` composes like any variant —
it is the reset that says almost nothing, so almost nothing contradicts
it. Building on it is legitimate by construction, not a loophole.

There is no per-element opt-out. The project-level way out is narrowing
`primitives` in `spinPreset`, visible in config rather than hidden on a
single element.

## The linter never hangs on your code

A file the parser cannot read gets degraded findings, never a hang: the
component parse runs under a budget, the regex walk stands behind it, and
each file is isolated from the next. Malformed input is the input most
worth linting, not a reason to stop.

Report any hang as a correctness bug with the file attached.

## One engine, four doors

`spin lint`, the oxlint and ESLint adapters, `spin lsp`, and the
vocabulary-only build gate are one engine behind four doors. The adapters
are compatibility layers for setups you already run — prefer the LSP for
editor integration. The build gate reads vocabulary only: style choices
never fail a build the author did not ask it to judge.

The same finding in every door, or it is a bug in the door — never a
second opinion.

## Gates you can game are deleted

A check that passes while broken is worse than no check: it teaches the
author the gate holds while the fault ships. So there are no trip wires,
no counts, no tolerated-orphan lists, no per-element silences. A rule
either states a contradiction the theme can prove, or it does not ship.

Every test in the diagnostics suite fails if and only if the behavior
regresses.
