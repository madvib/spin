/**
 * pages/[...all].tsx — the catch-all. Nothing else matches here.
 */
import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

export default function NotFound(): JSX.Element {
  return (
    <main class="mx-auto max-w-screen-md px-4 py-24 text-center">
      <p class="text-text-muted">
        This page does not exist.{" "}
        <A href="/" class="text-primary underline">
          home
        </A>
      </p>
    </main>
  );
}
