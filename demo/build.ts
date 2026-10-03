/**
 * Render the button so the API is visible rather than asserted.
 *
 *     deno task demo            # writes demo/index.html
 *     open demo/index.html
 *
 * Everything below is the real pipeline: the preset emits the utilities, the
 * primitives ship their stylesheet, and the two meet in one document.
 */
import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spin/preset";
import { generatePrimitivesCss } from "@spin/primitives";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("./", import.meta.url);
const THEME = JSON.parse(
  await readFile("packages/theme/examples/default/light.json"),
);

const uno = await createGenerator({
  presets: [spinPreset({ themes: { light: THEME } })],
});
const { css } = await uno.generate("flex grid items-center gap-4 text-lg p-4 animate-spin animate-pulse animate-fade-in");

// The primitives ship as CSS; a consumer links it, it does not need uno.
const primitives = generatePrimitivesCss();

const button = (label: string, cls = "", extra = "") =>
  `<button class="btn ${cls}" ${extra}>${label}</button>`;

await mkdir(OUT, { recursive: true });
await writeFile(
  new URL("index.html", OUT),
  `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>spin · primitives</title>
<style>${css}</style>
<style>${primitives}</style>
<style>
  body { margin: 0; font-family: var(--font-family-sans); background: var(--color-surface); color: var(--color-text); }
  .demo { max-width: 46rem; margin: 0 auto; padding: 3rem 1.5rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  p.lede { color: var(--color-text-muted); margin: 0 0 2.5rem; }
  section { margin-block: 2rem; }
  h2 { font-size: .8125rem; text-transform: uppercase; letter-spacing: .08em;
       color: var(--color-text-muted); margin: 0 0 .875rem; font-weight: 600; }
  code { font-family: var(--font-family-mono); font-size: .8125rem;
         background: var(--color-surface-raised); padding: .125rem .375rem;
         border-radius: var(--radius-sm); }
  pre { background: var(--color-surface-raised); padding: 1rem;
        border-radius: var(--radius-md); overflow-x: auto; margin: 0;
        font-family: var(--font-family-mono); font-size: .8125rem;
        border: 1px solid var(--color-border); }
  .states { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; }
  .fields { display: flex; flex-direction: column; gap: .75rem; max-width: 24rem; }
  .box { border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: var(--spacing-2); }
</style>
</head>
<body>
<div class="demo">
  <h1>spin primitives</h1>
  <p class="lede">The classless surface, as it actually ships.</p>

  <section>
    <h2>Variants · classless</h2>
    <div class="states">
      ${button("default")}
      ${button("secondary", "secondary")}
      ${button("outline", "outline")}
      ${button("contrast", "contrast")}
      ${button("danger", "danger")}
      ${button("ghost", "ghost")}
    </div>
  </section>

  <section>
    <h2>States</h2>
    <div class="states">
      ${button("hover me")}
      ${button("disabled", "", "disabled")}
      <button class="btn" aria-busy="true">busy</button>
    </div>
  </section>

  <section>
    <h2>Sizes</h2>
    <div class="states">
      ${button("small", "s-sm")}
      ${button("medium")}
      ${button("large", "s-lg")}
    </div>
  </section>

  <section>
    <h2>A group · joined corners</h2>
    <div role="group" style="display:flex">
      ${button("left", "secondary")}
      ${button("middle", "secondary")}
      ${button("right", "secondary")}
    </div>
  </section>

  <section>
    <h2>Utilities still win</h2>
    <div class="states">
      ${button("bg-secondary", "secondary", 'style="background:var(--color-secondary)"')}
    </div>
  </section>
  <section>
    <h2>Form</h2>
    <div class="fields">
      <label>Name <input></label>
      <label>Email <input type="email"></label>
      <label>Password <input type="password"></label>
      <label>Search <input type="search"></label>
      <label>Phone <input type="tel"></label>
      <label>Website <input type="url"></label>
      <label>Quantity <input type="number"></label>
      <label>Volume <input type="range"></label>
      <label>Color <input type="color"></label>
      <label>Date <input type="date"></label>
      <label>File <input type="file"></label>
      <label>Disabled <input disabled></label>
      <label>Invalid <input aria-invalid="true"> <small>Fix this field</small></label>
      <label>Valid <input aria-invalid="false"> <small>Looks good</small></label>
      <fieldset>
        <legend>Pick one</legend>
        <label><input type="radio" name="pick"> First</label>
        <label><input type="radio" name="pick"> Second</label>
      </fieldset>
      <fieldset disabled>
        <legend>Disabled group</legend>
        <label><input type="checkbox"> Cannot touch this</label>
      </fieldset>
      <label><input type="checkbox" role="switch"> Notifications</label>
      <label>Choice <select><option>One</option><option>Two</option><option>Three</option></select></label>
      <label>Notes <textarea rows="3"></textarea></label>
    </div>
  </section>

  <section>
    <h2>Content</h2>

    <h3>Prose</h3>
    <p>A paragraph with a <a href="#">link</a>, <strong>strong</strong>, <code>code</code>,
      <kbd>Ctrl</kbd> + <kbd>S</kbd>, <mark>mark</mark>,
      <abbr title="asynchronous JavaScript and XML">AJAX</abbr>, <small>small</small>,
      H<sub>2</sub>O, x<sup>2</sup>, <ins>inserted</ins> and <del>deleted</del> text.</p>

    <h3>Lists</h3>
    <ul>
      <li>Unordered item</li>
      <li>Another item</li>
    </ul>
    <ol>
      <li>Ordered item</li>
      <li>Another item</li>
    </ol>
    <dl>
      <dt>Term</dt>
      <dd>Definition</dd>
    </dl>

    <h3>Quote</h3>
    <blockquote>
      <p>A quotation with an attribution.</p>
      <footer>— The author</footer>
    </blockquote>

    <h3>Code</h3>
    <pre><code>const theme = "light";
document.documentElement.dataset.theme = theme;</code></pre>

    <h3>Table</h3>
    <table>
      <caption>Plain table</caption>
      <tr><th>Name</th><th>Value</th></tr>
      <tr><td>Alpha</td><td>1</td></tr>
      <tr><td>Beta</td><td>2</td></tr>
    </table>
    <table class="striped">
      <caption>Striped table</caption>
      <tbody>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>1</td></tr>
        <tr><td>Beta</td><td>2</td></tr>
        <tr><td>Gamma</td><td>3</td></tr>
      </tbody>
      <tfoot>
        <tr><td>Total</td><td>6</td></tr>
      </tfoot>
    </table>

    <h3>Figure</h3>
    <figure>
      <svg width="120" height="80" viewBox="0 0 120 80" role="img" aria-label="Demo image">
        <rect width="120" height="80" rx="8" fill="var(--color-surface-raised)" stroke="var(--color-border)"></rect>
        <circle cx="60" cy="40" r="16" fill="var(--color-primary)"></circle>
      </svg>
      <figcaption>A figure with a caption.</figcaption>
    </figure>

    <h3>Rule</h3>
    <hr>
  </section>

  <section>
    <h2>Disclosure</h2>
    <details>
      <summary>Closed by default</summary>
      <p>The body stays hidden until the summary is activated.</p>
    </details>
    <details open>
      <summary>Open</summary>
      <p>The body is visible because the widget carries <code>open</code>.</p>
    </details>
    <dialog open>
      <h3>Dialog</h3>
      <p>A modal, rendered visible with <code>open</code> and a backdrop.</p>
    </dialog>
  </section>

  <section>
    <h2>Layout</h2>
    <header class="box"><p>header — introductory content</p></header>
    <main class="box">
      <p>main — the main content region</p>
      <article class="box"><p>article — a self-contained composition</p></article>
    </main>
    <footer class="box"><p>footer — closing content</p></footer>
    <div class="box">
      <div class="container" style="background:var(--color-surface-raised)">
        <p>.container caps the column at 80ch and pads the gutters.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>Nav</h2>
    <nav aria-label="Primary">
      <ul>
        <li><a href="#" aria-current="page">Current</a></li>
        <li><a href="#">Sibling</a></li>
        <li><a href="#">Another</a></li>
      </ul>
    </nav>
    <nav aria-label="breadcrumb" style="margin-top:.75rem">
      <ol>
        <li><a href="#">Home</a></li>
        <li><a href="#">Section</a></li>
        <li>Current</li>
      </ol>
    </nav>
  </section>

  <section>
    <h2>Group</h2>
    <div class="states">
      <div role="group" style="display:flex">
        ${button("left", "secondary")}
        ${button("middle", "secondary")}
        ${button("right", "secondary")}
      </div>
      <form role="search" style="display:flex">
        <input type="search" placeholder="Search…">
        <button class="btn secondary">Go</button>
      </form>
      <button data-tooltip="Reveals on hover or focus" data-placement="top">tooltip top</button>
      <button data-tooltip="Placement is the author's call" data-placement="bottom">tooltip bottom</button>
    </div>
  </section>

  <section>
    <h2>Feedback</h2>
    <div class="states">
      <div aria-busy="true">Loading region</div>
      <button class="btn" aria-busy="true">busy button</button>
    </div>
    <div class="states" style="margin-top:.75rem">
      <progress max="100" value="60"></progress>
      <progress></progress>
    </div>
    <p style="margin-top:.75rem">Save <span class="visually-hidden">— changes cannot be undone</span></p>
  </section>

  <section>
    <h2>Card</h2>
    <div class="card">
      <h3>Card title</h3>
      <p>A raised, bordered surface with padding.</p>
    </div>
  </section>

  <section>
    <h2>Animation</h2>
    <div class="states">
      <span class="animate-spin" style="display:inline-block;width:1.25rem;height:1.25rem;border:2px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%"></span>
      <span class="animate-pulse" style="display:inline-block;width:1.25rem;height:1.25rem;background:var(--color-primary);border-radius:50%"></span>
      <span class="animate-fade-in" style="display:inline-block;padding:.375rem .75rem;background:var(--color-surface-raised);border:1px solid var(--color-border);border-radius:var(--radius-md)">fade-in</span>
    </div>
  </section>

  <section>
    <h2>Source</h2>
    <pre>&lt;button&gt;Save&lt;/button&gt;
&lt;button class="secondary"&gt;Save&lt;/button&gt;
&lt;button class="danger" aria-busy="true"&gt;Save&lt;/button&gt;</pre>
  </section>
</div>
</body>
</html>`,
);

console.log("wrote demo/index.html");
