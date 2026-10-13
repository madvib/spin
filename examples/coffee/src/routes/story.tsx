/**
 * The shop: who is selling you this.
 *
 * A single card, a table of the week's schedule, and an alert for the
 * standing notice. This page is here so the example has prose in it — a
 * theme read against body copy looks different from a theme read against
 * swatches, and the studio's judgements should be made against copy.
 */

import { Alert, Badge, Card } from "../components/spin.tsx";
export default function Story() {
  return (
    <div class="stack-lg max-w-3xl mx-auto p-8">
      <header class="stack">
        <h1 class="text-3xl">The shop</h1>
        <p class="text-text-muted">
          A two-person roastery on the edge of town, roasting for shops between
          here and the coast.
        </p>
      </header>
      <Card class="stack p-6">
        <h2 class="text-xl">The week</h2>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monday</td>
              <td>Orders close at noon</td>
            </tr>
            <tr>
              <td>Tuesday</td>
              <td>Roast day</td>
            </tr>
            <tr>
              <td>Wednesday</td>
              <td>Shipping</td>
            </tr>
            <tr>
              <td>Friday</td>
              <td>Cupping, open to the trade</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <Alert variant="warning">
        Roasts are Tuesdays, shipping Wednesdays. Orders placed before Monday
        are in the following week's batch.
      </Alert>
    </div>
  );
}
