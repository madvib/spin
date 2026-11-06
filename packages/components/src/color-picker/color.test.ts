import { test } from "bun:test";
import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { parseColor } from "./color.ts";

test("parses short and long hex with alpha", () => {
  strictEqual(parseColor("#f00").toString("hex"), "#FF0000");
  strictEqual(parseColor("#f008").toString("hexa"), "#FF000088");
  strictEqual(parseColor("#ff0000").toString("hex"), "#FF0000");
  strictEqual(parseColor("#ff000080").toString("hexa"), "#FF000080");
});

test("parses rgb, hsl, and hsb function forms", () => {
  strictEqual(parseColor("rgb(255, 0, 0)").toString("hex"), "#FF0000");
  strictEqual(parseColor("rgba(255, 0, 0, 0.5)").toString("hexa"), "#FF000080");
  strictEqual(parseColor("hsl(0, 100%, 50%)").toString("hex"), "#FF0000");
  strictEqual(parseColor("hsla(120, 100%, 50%, 0.5)").toString("hexa"), "#00FF0080");
  strictEqual(parseColor("hsb(240, 100%, 100%)").toString("hex"), "#0000FF");
  strictEqual(parseColor("hsba(60, 100%, 100%, 0.5)").toString("hexa"), "#FFFF0080");
});

test("parses named colors and grey aliases", () => {
  strictEqual(parseColor("red").toString("hex"), "#FF0000");
  strictEqual(parseColor("rebeccapurple").toString("hex"), "#663399");
  strictEqual(parseColor("darkgrey").toString("hex"), "#A9A9A9");
});

test("throws on invalid input so parse falls back", () => {
  throws(() => parseColor("not-a-color"));
  throws(() => parseColor("#12"));
  throws(() => parseColor(""));
});

test("round-trips through every space", () => {
  for (const input of ["#10b981", "#ff0000", "#10b981ff"]) {
    const hex = parseColor(input).toString(
      input.length > 7 ? "hexa" : "hex",
    );
    const color = parseColor(input);
    for (const space of ["rgba", "hsla", "hsba"] as const) {
      strictEqual(
        parseColor(color.toFormat(space).toString("css")).toString(
          input.length > 7 ? "hexa" : "hex",
        ),
        hex,
        `${input} via ${space}`,
      );
    }
  }
});

test("clamps channel writes to the range", () => {
  const color = parseColor("#ff0000");
  strictEqual(color.withChannelValue("red", 999).getChannelValue("red"), 255);
  strictEqual(color.withChannelValue("red", -999).getChannelValue("red"), 0);
  strictEqual(color.withChannelValue("alpha", 99).getChannelValue("alpha"), 1);
  strictEqual(color.withChannelValue("alpha", -99).getChannelValue("alpha"), 0);
  strictEqual(
    color.toFormat("hsla").withChannelValue("hue", 720).getChannelValue("hue"),
    360,
  );
});

test("clamps stepped channels at the range ends", () => {
  const color = parseColor("#ff0000");
  strictEqual(color.incrementChannel("red", 999).getChannelValue("red"), 255);
  strictEqual(color.decrementChannel("red", 999).getChannelValue("red"), 0);
  strictEqual(
    color.toFormat("hsla").incrementChannel("hue", 1).getChannelValue("hue"),
    1,
  );
});

test("ranges match the stepped controls", () => {
  const hue = parseColor("hsl(0, 0%, 0%)").getChannelRange("hue");
  deepStrictEqual(hue, { minValue: 0, maxValue: 360, step: 1, pageSize: 15 });
  const alpha = parseColor("#000000").getChannelRange("alpha");
  deepStrictEqual(alpha, { minValue: 0, maxValue: 1, step: 0.01, pageSize: 0.1 });
  const red = parseColor("#000000").getChannelRange("red");
  deepStrictEqual(red, { minValue: 0, maxValue: 255, step: 1, pageSize: 17 });
});

test("unsupported channels throw on the wrong space", () => {
  const rgb = parseColor("#ff0000");
  throws(() => rgb.getChannelValue("hue"));
  throws(() => rgb.withChannelValue("hue", 10));
  throws(() => rgb.getChannelRange("hue"));
  throws(() => rgb.incrementChannel("hue", 1));
});
