/**
 * `/tokens` moved to `/utilities`: the token probe now lives alongside the
 * catalog it resolves against. This file is a redirect so existing links
 * keep working.
 */
import { Navigate } from "@solidjs/router";
import type { JSX } from "solid-js";

export default function TokensRedirect(): JSX.Element {
  return <Navigate href="/utilities" />;
}
