export { emit, type EmitOutput } from "./emit.ts";

import { emit } from "./emit.ts";
import type { ComponentIr } from "@spin/runtime";

export function compile(ir: ComponentIr): { js: string; bindings: number } {
  return emit(ir);
}
