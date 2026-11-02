export { emit, type EmitOutput } from "../compiler/emit.ts";

import { emit } from "../compiler/emit.ts";
import type { ComponentIr } from "@spinjs/runtime";

export function compile(ir: ComponentIr): { js: string; bindings: number } {
  return emit(ir);
}
