/**
 * Code snippets for the Styling & Markup subgroup (`/docs/styling/*`).
 */
export const STYLING_SNIPPETS = {
  classlessCard: `<card class="stack">
  <div class="split">
    <h3>Billing notifications</h3>
    <badge class="primary">Enabled</badge>
  </div>
  <label>
    Alert email
    <input type="email" placeholder="ops@example.com" />
  </label>
  <div class="row justify-end">
    <button type="button" class="secondary">Cancel</button>
    <button type="button">Save</button>
  </div>
</card>`,
  cascadeLayers: `/* Emitted by @spinjs/spin/preset in cascade order: */
@layer reset, primitives, default;`,
} as const;
