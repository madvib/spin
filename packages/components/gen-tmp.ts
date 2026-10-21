import { createGenerator } from "@unocss/core";
import { spinPreset } from "../../packages/preset/src/index.ts";
import { starterThemes } from "../../packages/theme/src/themes/index.ts";

const uno = await createGenerator({ presets: [spinPreset({ themes: starterThemes })] });
const tokens = [
  "data-[stage=minimized]:h-12!",
  "data-[stage=minimized]:!h-12",
  "!h-12",
  "h-12!",
  "data-[stage=maximized]:w-full!",
  "data-[stage=maximized]:max-w-full",
  "data-[stage=minimized]:max-h-12",
];
const { css, matched } = await uno.generate(new Set(tokens), { preflights: false });
console.log([...matched].join("\n"));
console.log(css);
