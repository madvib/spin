# The class object: the markup's half of the agreed design

**Status: landed (`35621b1`). One component proves it: the slider.**

## The design (agreed 2026-10-21, "the rest looks good")

The class string was where the state lived. `data-[state=open]:bg-primary` puts
the machine's state in the class string and splits the brand's decision about
what that state looks like between the markup and the component that publishes
the attribute. **The bindings never own the class** — that is the entire point
of the markup being the brand.

⇒ The class attribute takes an **object**: the keys are the utilities, the
values are the conditions.

```html
<div class={{ "mb-4 text-sm text-muted": true,
              "text-primary": slider.state === "focus" }}
  data-mode={slider.state}
  {...slider.getValueTextProps()}>
```

- The **keys are static strings**, so the build sees them: uno's default
  extractor reads the attribute's VALUE (an object literal, not a class list)
  and finds nothing — a utility nobody extracts has no rule and cannot apply.
  The preset's `classObjectExtractor` reads the keys.
- The **values are live reads**: `slider.state` reads the signal, so the binding
  is an effect and the class re-applies when the state moves.
- The **compiler merges** it: the keys whose value is truthy, in the source's
  order. A key may name several utilities.

## The three pieces

| the piece                                                | where                                     |
| -------------------------------------------------------- | ----------------------------------------- |
| `classOf` — the merge                                    | `packages/runtime/src/directives/bind.ts` |
| the emit wraps a class attribute's object in it          | `packages/runtime/src/plugin/emit.ts`     |
| `classObjectExtractor` — the keys are the build's to see | `packages/preset/src/extractors.ts`       |
| the class check reads the object's keys                  | `packages/syntax/src/classes.ts`          |

⇒ **The reactivity was already there**: the 10-21 work made the api's readers
read the signals (one writer — the mirror), so `slider.state` is a live read
today.

## What the shape still has to answer

- **The static classes in a `true` key is the ugly bit.** The alternatives: the
  class attribute keeps its static string and takes the conditions some other
  way; or the object is the only form.
- **The typing.** "Typed like `machine.prop`" needs the api's type DERIVED from
  the def — today 34 components hand-write their api interface (`SliderApi` and
  its 33 siblings), and the class expression's state references cannot be
  checked against a hand-written type.
- **The corpus.** 2180 static class attributes and 137 `data-[state=…]:` hooks.
  The migration off the hooks is what retires the `data-*` facts vocabulary (the
  wrong direction: +96 runtime lines and a 345-line codemod, built against a
  channel this design replaces).

## The measurements that constrain it

- **`not-data-[open]` does not match in uno.** A condition's absence is not
  expressible ⇒ a conditional class is always a _presence_ ⇒ the derived facts
  stay enums, and the "closed" rules keep a value form.
- **The class check must see the object's keys, not its values' literals.** The
  first version took every literal and reported two phantom classes (`alpha`,
  `hue` — a channel's name in a text expression). Pinned by a test.
