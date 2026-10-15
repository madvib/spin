import type { JSX } from "solid-js";

/** The readout row every demo ends with: mono, tabular, quiet. */
export function DemoReadout(props: { children: JSX.Element }) {
  return (
    <div class="mt-4 font-mono text-xs text-text-muted tabular-nums">
      {props.children}
    </div>
  );
}
