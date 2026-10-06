/**
 * Document defaults — what a theme makes its pages look like before any
 * component or utility is written.
 *
 * Every declaration here spends a token the theme owns, which is what makes it
 * theme identity rather than house style: move `--font-family-sans` and the
 * document reads differently. These apply whether or not any primitive is
 * selected, which is the only thing that separates them from components.
 *
 * Reset and the reduced-motion clamp are deliberately absent. Neither spends a
 * token, so neither is a decision a theme makes; both are stage-setting that
 * every document needs, and they ship with the preset.
 */

/**
 * The document floor. `margin: 0` neutralizes user-agent margins that would
 * otherwise beat any component spacing; type and ink come from the theme so a
 * page reads correctly before a single utility is written.
 */
export function documentDefaults(): string {
  return [
    "body {",
    "  font-family: var(--font-family-sans);",
    "  color: var(--color-text);",
    "  background-color: var(--color-surface);",
    "}",
    "",
    "body, h1, h2, h3, h4, h5, h6, p, ul, ol, figure, blockquote {",
    "  margin: 0;",
    "}",
    "",
    "input, textarea, select, button {",
    "  font: inherit;",
    "}",
  ].join("\n");
}
