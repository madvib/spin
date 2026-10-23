/**
 * Markup: the opt-in rule and the elements themselves. The rows' code tabs
 * carry the markup — nothing here narrates what the rows already show.
 */
import type { JSX } from "solid-js";
import { componentExamples } from "@spin/preset";
import { Section } from "../../bits.tsx";
import { ExampleRow } from "../../example-row.tsx";

export default function Markup(): JSX.Element {
  return (
    <Section id="markup" title="Markup">
      <p>
        A tag in your markup is the opt-in — classes carry the identity,
        utilities carry the finish.
      </p>
      <ExampleRow name="buttons" html={componentExamples.button.rows[0].html} />
      <ExampleRow name="badges" html={componentExamples.badge.rows[0].html} />
      <ExampleRow name="fields" html={componentExamples.input.rows[0].html} />
    </Section>
  );
}
