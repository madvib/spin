import { defaultTwin } from "@spin/runtime";

export type AvatarState = "loading" | "loaded" | "error";

export interface AvatarContext {
  src: string;
  label: string;
  fallback: string;
}

/**
 * The avatar's arguments: the machine's own domain types. The host sets
 * typed values; nothing parses text here.
 *
 * The twin (`defaultSrc`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface AvatarArgs {
  src?: string;
  defaultSrc?: string;
  label?: string;
  fallback?: string;
}

/**
 * The machine's context, built from its arguments: what the args did not
 * carry takes the machine's own default.
 *
 * The seed twin (`defaultSrc`) is the host's write of the src — the
 * framework resolved it into the args — so it counts as a write too.
 */
export function initial(
  args: AvatarArgs = {},
  authored: (name: string) => boolean,
): AvatarContext {
  // A host that wrote `defaultSrc` wrote the src channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    src: written("src") ? args.src ?? "" : "",
    label: args.label ?? "",
    fallback: args.fallback ?? "",
  };
}
