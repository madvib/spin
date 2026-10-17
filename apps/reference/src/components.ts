import type { PrimitivePage } from "./primitives.ts";

/**
 * The machine components, beside the primitives. Examples are the files
 * each machine ships under `examples/` — the glob below IS the manifest
 * (stem = name, title derived), the same convention the RPC serves.
 * A machine with no examples yet renders its recipe as the single example.
 */
const exampleSources = import.meta.glob(
  "../../../packages/components/src/spin-*/examples/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Compiled: each example is its own element, registered by the element
// transform as a side effect. Same glob, no ?raw.
import.meta.glob(
  "../../../packages/components/src/spin-*/examples/*.html",
  { eager: true },
);

const recipeModules = import.meta.glob(
  "../../../packages/components/src/spin-*/spin-*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const titleOf = (stem: string): string =>
  stem.split("-").map((word) =>
    word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1)
  ).join(" ");

const stripSpin = (dir: string): string =>
  dir.startsWith("spin-") ? dir.slice("spin-".length) : dir;

// `.../spin-tree-view/examples/basic.html` → `tree-view`: the examples
// dir sits between the machine dir and the file.
const exampleMachineOf = (path: string): string =>
  stripSpin(path.split("/").at(-3) ?? "");

// Recipes sit beside the machine dir: `.../spin-tree-view/spin-*.html`.
const recipeMachineOf = (path: string): string =>
  stripSpin(path.split("/").at(-2) ?? "");

const grouped = new Map<string, { examples: { name: string; html: string; source: string; onLoad?: string }[] }>();
for (const [path, html] of Object.entries(exampleSources)) {
  const machine = exampleMachineOf(path);
  const stem = path.split("/").at(-1)?.slice(0, -".html".length) ?? path;
  const group = grouped.get(machine) ?? { examples: [] };
  // Machine-qualified, always: a dashed stem (`media-player`) is not a
  // usable bare tag — the compiled element registers machine-stem, and
  // the mount must name the same element.
  const tag = `${machine}-${stem}`;
  group.examples.push({
    name: `${machine} — ${titleOf(stem)}`,
    html: `<${tag}></${tag}>`,
    source: html,
  });
  grouped.set(machine, group);
}
for (const [path, html] of Object.entries(recipeModules)) {
  const machine = recipeMachineOf(path);
  if (grouped.has(machine)) continue;
  grouped.set(machine, {
    examples: [{ name: `${titleOf(machine)} — Recipe`, html }],
  });
}

/** Mount glue a static file cannot carry: property functions. Keyed by
 * `machine/stem`. The loading example's `loadChildren` is what a consumer
 * writes in their own code (see the note in the example source). */

const EXAMPLE_ONLOAD: Record<string, string> = {
  "toast/basic": `
    document.querySelectorAll("toast-basic").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/action": `
    document.querySelectorAll("toast-action").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/duration": `
    document.querySelectorAll("toast-duration").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/types": `
    document.querySelectorAll("toast-types").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/topleft": `
    document.querySelectorAll("toast-topleft").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/topcenter": `
    document.querySelectorAll("toast-topcenter").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/topright": `
    document.querySelectorAll("toast-topright").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/bottomleft": `
    document.querySelectorAll("toast-bottomleft").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/bottomcenter": `
    document.querySelectorAll("toast-bottomcenter").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/bottomright": `
    document.querySelectorAll("toast-bottomright").forEach((pg) => {
      const btn = pg.querySelector("[data-fire]");
      if (btn === null || btn.getAttribute("data-wired") === "true") return;
      btn.setAttribute("data-wired", "true");
      btn.addEventListener("click", () => {
        pg.create({
          id: "t" + Date.now(),
          title: btn.getAttribute("data-title") ?? "",
          description: btn.getAttribute("data-description") ?? "",
          type: btn.getAttribute("data-type") ?? "info",
          duration: Number(btn.getAttribute("data-duration") ?? 5000),
          priority: 0,
          action: btn.getAttribute("data-action") ?? "",
        });
      });
    });
  `,
  "toast/promise": `
    document.querySelectorAll("toast-promise").forEach((pg) => {
      const id = "upload";
      pg.create({ id: id, title: "Uploading file...", description: "Please wait.", type: "loading", duration: 0, priority: 0, action: "" });
      setTimeout(() => {
        pg.update(id, { title: "Upload successful!", description: "Your file is live.", type: "success", duration: 5000 });
      }, 2500);
    });`,
  "toast/updatable": `
    document.querySelectorAll("toast-updatable").forEach((pg) => {
      const id = "progress";
      pg.create({ id: id, title: "Uploading...", description: "Starting.", type: "loading", duration: 0, priority: 0, action: "" });
      let step = 0;
      const timer = setInterval(() => {
        step += 1;
        if (step >= 3) {
          clearInterval(timer);
          pg.update(id, { title: "Upload complete!", description: "Done.", type: "success", duration: 5000 });
        } else {
          pg.update(id, { description: "Part " + step + " of 3." });
        }
      }, 1200);
    });`,
  "pagination/dropdown": `
    document.querySelectorAll("pagination-dropdown").forEach((pg) => {
      pg.querySelectorAll("[data-size]").forEach((btn) => {
        btn.addEventListener("click", () => {
          pg.setPageSize(Number(btn.getAttribute("data-size")));
        });
      });
    });`,
  "pagination/jump": `
    document.querySelectorAll("pagination-jump").forEach((pg) => {
      const input = pg.querySelector("[data-jump] input");
      pg.querySelector("[data-go]")?.addEventListener("click", () => {
        pg.setPage(Number(input.value));
      });
    });`,
  "tour/basic": `
    document.querySelectorAll("tour-basic").forEach((tour) => {
      tour.querySelector("[data-start]")?.addEventListener("click", () => {
        tour.start();
      });
    });`,
"floating-panel/chat": `
    document.querySelectorAll("floating-panel-chat").forEach((host) => {
      if (host.getAttribute("data-wired") === "true") return;
      host.setAttribute("data-wired", "true");
      let tries = 0;
      const wait = () => {
        if (host.querySelector("[data-chat-input]") !== null) {
          wire(host);
          return;
        }
        if (tries < 120) {
          tries += 1;
          requestAnimationFrame(wait);
        }
      };
      const wire = (root) => {
        const list = root.querySelector("[data-messages]");
        const input = root.querySelector("[data-chat-input]");
        const sendBtn = root.querySelector("[data-send]");
        let n = 0;
        const bubble = (text, mine) => {
          const wrap = document.createElement("div");
          wrap.className = mine ? "justify-self-end" : "";
          wrap.style.maxWidth = "80%";
          const inner = document.createElement("div");
          inner.className = mine
            ? "rounded-lg rounded-tr-sm bg-info px-3 py-2 text-white"
            : "rounded-lg rounded-tl-sm bg-surface px-3 py-2 text-text";
          inner.textContent = text;
          wrap.appendChild(inner);
          if (mine) {
            const row = document.createElement("div");
            row.className = "justify-self-end";
            row.style.maxWidth = "80%";
            row.appendChild(inner);
            list.appendChild(row);
          } else {
            list.appendChild(wrap);
          }
          list.scrollTop = list.scrollHeight;
        };
        const send = () => {
          const text = input.value.trim();
          if (text === "") return;
          n += 1;
          bubble(text, true);
          input.value = "";
          const replies = [
            "Got it — let me look into that for you.",
            "Thanks for the detail! One moment while I check.",
            "That's on my list. Anything else I can help with?",
          ];
          const reply = replies[(n - 1) % replies.length];
          setTimeout(() => bubble(reply, false), 600);
        };
        sendBtn.addEventListener("click", send);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") send();
        });
      };
      wait();
    });`,
"floating-panel/media-player": `
    document.querySelectorAll("floating-panel-media-player").forEach((host) => {
      if (host.getAttribute("data-wired") === "true") return;
      host.setAttribute("data-wired", "true");
      let tries = 0;
      const wait = () => {
        if (host.querySelector("[data-play]") !== null) {
          wire(host);
          return;
        }
        if (tries < 120) {
          tries += 1;
          requestAnimationFrame(wait);
        }
      };
      const wire = (root) => {
        const play = root.querySelector("[data-play]");
        const icon = play.querySelector("span");
        const bar = root.querySelector("[data-progress]");
        const elapsed = root.querySelector("[data-elapsed]");
        const fav = root.querySelector("[data-fav]");
        let playing = false;
        let seconds = 72;
        let timer = 0;
        const fmt = (total) => {
          const mins = Math.floor(total / 60);
          const secs = total % 60;
          return mins + ":" + String(secs).padStart(2, "0");
        };
        const tick = () => {
          seconds = Math.min(228, seconds + 1);
          elapsed.textContent = fmt(seconds);
          bar.style.width = (seconds / 228) * 100 + "%";
          if (seconds >= 228) setPlaying(false);
        };
        const setPlaying = (next) => {
          playing = next;
          icon.className = next
            ? "i-lucide-pause text-md"
            : "i-lucide-play text-md";
          if (next) {
            timer = setInterval(tick, 1000);
          } else {
            clearInterval(timer);
          }
        };
        play.addEventListener("click", () => setPlaying(!playing));
        let liked = true;
        fav.addEventListener("click", () => {
          liked = !liked;
          fav.style.opacity = liked ? "1" : "0.4";
        });
      };
      wait();
    });`,
  "floating-panel/calculator": `
    document.querySelectorAll("floating-panel-calculator").forEach((host) => {
      if (host.getAttribute("data-wired") === "true") return;
      host.setAttribute("data-wired", "true");
      // The inner content renders on element upgrade, which races this
      // glue: poll until the display exists, then wire exactly once.
      let tries = 0;
      const wait = () => {
        if (host.querySelector("[data-display]") !== null) {
          wire(host);
          return;
        }
        if (tries < 120) {
          tries += 1;
          requestAnimationFrame(wait);
        }
      };
      const wire = (root) => {
        const display = root.querySelector("[data-display]");
        let shown = "0";
        let previous = null;
        let operation = null;
        let waiting = false;
        const render = () => {
          display.textContent = shown;
        };
        const inputNumber = (num) => {
          if (waiting) {
            shown = num;
            waiting = false;
          } else {
            shown = shown === "0" ? num : shown + num;
          }
          render();
        };
        const calculate = (first, second, op) => {
          switch (op) {
            case "+": return first + second;
            case "−": return first - second;
            case "×": return first * second;
            case "÷": return second === 0 ? NaN : first / second;
            case "=": return second;
            default: return second;
          }
        };
        const inputOperation = (next) => {
          const input = parseFloat(shown);
          if (Number.isNaN(input)) return;
          if (previous === null) {
            previous = input;
          } else if (operation !== null) {
            const value = calculate(previous, input, operation);
            shown = Number.isNaN(value) ? "Error" : String(value);
            previous = value;
            render();
          }
          waiting = true;
          operation = next;
        };
        root.querySelectorAll("[data-key]").forEach((key) => {
          key.addEventListener("click", () => {
            const label = key.getAttribute("data-key") ?? "";
            const act = key.getAttribute("data-act") ?? "";
            if (act === "clear") {
              shown = "0";
              previous = null;
              operation = null;
              waiting = false;
              render();
            } else if (act === "negate") {
              shown = shown.startsWith("-") ? shown.slice(1) : "-" + shown;
              render();
            } else if (act === "percent") {
              const value = parseFloat(shown);
              if (!Number.isNaN(value)) {
                shown = String(value / 100);
                render();
              }
            } else if (act === "digit") {
              if (label === "." && shown.includes(".") && !waiting) return;
              inputNumber(label);
            } else if (act === "op") {
              inputOperation(label);
            } else if (act === "eq") {
              if (previous !== null && operation !== null) {
                const value = calculate(previous, parseFloat(shown), operation);
                shown = Number.isNaN(value) ? "Error" : String(value);
                previous = null;
                operation = null;
                waiting = true;
                render();
              }
            }
          });
        });
      };
      wait();
    });`,
  "tree-view/loading": `
    document.querySelectorAll("tree-view-loading").forEach((tree) => {
      const t = tree;
      t.loadChildren = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (value === "packages") {
          return [
            { value: "packages/components", label: "components" },
            { value: "packages/runtime", label: "runtime" },
          ];
        }
        return [];
      };
    });
  `,
};


/** Purpose groups for the machines, the same shape as the primitives'
 * CATEGORIES: a reader looks for the thing it does, not its name. */
export const COMPONENT_GROUPS: readonly {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
}[] = [
  { id: "inputs", label: "Inputs", members: ["angle-slider", "color-picker", "date-input", "date-picker", "editable", "file-upload", "number-input", "pin-input", "rating-group", "slider", "tags-input", "toggle-group"] },
  { id: "selectors", label: "Selection", members: ["cascade-select", "combobox", "listbox", "menu", "navigation-menu", "select", "tree-view"] },
  { id: "display", label: "Display", members: ["async-list", "avatar", "carousel", "pagination", "steps", "tabs", "timer", "tour"] },
  { id: "overlays", label: "Overlays", members: ["floating-panel", "hover-card", "popover", "toast", "tooltip"] },
  { id: "layout", label: "Layout", members: ["splitter"] },
  { id: "media", label: "Media", members: ["image-cropper", "signature-pad"] },
];

/** One glyph per machine, beside the groups that list them. Controllers
 * (tabs, tooltip, popover, hover-card) share the mapping — the rail looks
 * up by machine id, not by tier. */
export const COMPONENT_ICONS: Readonly<Record<string, string>> = {
  "angle-slider": "i-lucide-compass",
  "async-list": "i-lucide-list-filter",
  avatar: "i-lucide-circle-user",
  carousel: "i-lucide-gallery-horizontal",
  "cascade-select": "i-lucide-list-tree",
  "color-picker": "i-lucide-palette",
  combobox: "i-lucide-chevrons-up-down",
  "date-input": "i-lucide-calendar-days",
  "date-picker": "i-lucide-calendar",
  editable: "i-lucide-pencil",
  "file-upload": "i-lucide-upload",
  "floating-panel": "i-lucide-panel-top",
  "hover-card": "i-lucide-square-mouse-pointer",
  "image-cropper": "i-lucide-crop",
  listbox: "i-lucide-listbox",
  menu: "i-lucide-menu",
  "navigation-menu": "i-lucide-navigation",
  "number-input": "i-lucide-hash",
  pagination: "i-lucide-chevrons-left-right",
  "pin-input": "i-lucide-key-round",
  popover: "i-lucide-message-circle",
  "rating-group": "i-lucide-star",
  select: "i-lucide-chevron-down",
  "signature-pad": "i-lucide-pen-line",
  slider: "i-lucide-sliders-horizontal",
  splitter: "i-lucide-columns-2",
  steps: "i-lucide-list-ordered",
  tabs: "i-lucide-layout-list",
  "tags-input": "i-lucide-tags",
  timer: "i-lucide-timer",
  toast: "i-lucide-bell",
  "toggle-group": "i-lucide-toggle-left",
  tooltip: "i-lucide-message-circle-off",
  tour: "i-lucide-route",
  "tree-view": "i-lucide-folder-tree",
};

/** Controllers: platform-backed glue, no machine. Everything else on the
 * rail runs a statechart and needs the runtime. */
const CONTROLLERS: readonly string[] = ["tabs", "tooltip", "popover", "hover-card"];

/** The dependency line the detail view shows: what a consumer must have
 * before the markup works. */
export const componentRequirement = (id: string): string => {
  const machine = id.startsWith("component-") ? id.slice("component-".length) : id;
  if ((CONTROLLERS as readonly string[]).includes(machine)) return "Needs the controller glue (@spin/runtime, no statechart).";
  return "Requires the runtime (@spin/runtime): markup drives a statechart.";
};

// A machine the groups and the icons both miss is a machine the rail
// cannot place — checked here, where all three are in view.
for (const entry of [...grouped.entries()].map(([id]) => id)) {
  if (!COMPONENT_GROUPS.some((g) => (g.members as readonly string[]).includes(entry))) {
    throw new Error(`COMPONENT_GROUPS: ${entry} is in no group`);
  }
  if (COMPONENT_ICONS[entry] === undefined) {
    throw new Error(`COMPONENT_ICONS: ${entry} has no icon`);
  }
}

export const COMPONENTS: readonly PrimitivePage[] = [...grouped.entries()]
  .map(([id, group]) => ({
    id: `component-${id}`,
    title: titleOf(id),
    kind: "machine",
    note: "",
    examples: [...group.examples].sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
      const key = `${id}/${e.name.split(" — ")[1]?.toLowerCase().replace(/ /g, "-") ?? ""}`;
      const onLoad = EXAMPLE_ONLOAD[key];
      return onLoad !== undefined ? { ...e, onLoad } : e;
    }),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));
