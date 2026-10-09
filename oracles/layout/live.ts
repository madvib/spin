/**
 * The live cross-check. The oracle's geometry comes from taffy; this module
 * asks a real browser for the same numbers so the model can be shown to
 * agree with the reference instead of merely asserting it.
 *
 * It drives Chromium over the DevTools protocol with the platform WebSocket
 * — no browser automation dependency. A browser that cannot be found, an app
 * that is not serving, or any protocol error makes the probe report
 * `null`; callers fall back to the recorded baseline and label every read
 * with the source it came from.
 */

export interface LiveReading {
  readonly theme: string;
  readonly docScrollWidth: number;
  readonly docClientWidth: number;
  readonly sticky: ReadonlyArray<{
    readonly scrollerHeight: number;
    readonly scrollHeight: number;
    readonly headerHeight: number;
    readonly rowHeights: readonly number[];
  }>;
  readonly joins: ReadonlyArray<{
    readonly gaps: readonly number[];
    readonly borderWidth: string;
  }>;
  readonly avatars: ReadonlyArray<
    {
      readonly width: number;
      readonly height: number;
      readonly classes: string;
    }
  >;
  readonly groups: ReadonlyArray<{ readonly steps: readonly number[] }>;
  readonly stripedOddBg: string | null;
  readonly stripedEvenBg: string | null;
}

export interface LiveReads {
  readonly origin: string;
  readonly measuredAt: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly byRoute: Record<string, Record<string, LiveReading>>;
}

const MEASURE = `(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) }; };
  const scrollers = [...document.querySelectorAll("div.overflow-auto")].filter((s) => s.querySelector("table"));
  const striped = document.querySelector("table.striped");
  const odd = striped?.querySelector("tbody tr:nth-of-type(odd) td") ?? null;
  const even = striped?.querySelector("tbody tr:nth-of-type(even) td") ?? null;
  return {
    theme: document.documentElement.dataset.theme,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    sticky: scrollers.map((s) => {
      const t = s.querySelector("table");
      const head = t.querySelector("thead tr");
      const rows = [...t.querySelectorAll("tbody tr")];
      return { scrollerHeight: r(s).h, scrollHeight: s.scrollHeight, headerHeight: r(head).h, rowHeights: rows.map((x) => r(x).h) };
    }),
    joins: [...document.querySelectorAll(".join")].map((j) => {
      const items = [...j.children].map(r);
      return { gaps: items.slice(1).map((k, i) => +(k.x - (items[i].x + items[i].w)).toFixed(2)), borderWidth: getComputedStyle(j.firstElementChild).borderTopWidth };
    }),
    avatars: [...document.querySelectorAll("img.avatar")].map((a) => ({ width: r(a).w, height: r(a).h, classes: a.className })),
    groups: [...document.querySelectorAll(".avatar-group")].map((g) => {
      const kids = [...g.children].map(r);
      return { steps: kids.slice(1).map((k, i) => +(k.x - kids[i].x).toFixed(2)) };
    }),
    stripedOddBg: odd ? getComputedStyle(odd).backgroundColor : null,
    stripedEvenBg: even ? getComputedStyle(even).backgroundColor : null,
  };
})()`;

interface Cdp {
  readonly send: <T>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ) => Promise<T>;
  readonly on: (
    method: string,
    listener: (params: Record<string, unknown>) => void,
  ) => void;
  readonly close: () => void;
}

class CdpClient implements Cdp {
  #socket: WebSocket;
  #nextId = 1;
  #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  #eventListeners = new Map<
    string,
    Array<(params: Record<string, unknown>) => void>
  >();

  constructor(url: string) {
    this.#socket = new WebSocket(url);
    this.#socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: unknown;
        error?: { message: string };
      };
      if (message.id !== undefined) {
        const entry = this.#pending.get(message.id);
        if (entry === undefined) return;
        this.#pending.delete(message.id);
        if (message.error !== undefined) {
          entry.reject(new Error(message.error.message));
        } else entry.resolve(message.result);
        return;
      }
      if (message.method !== undefined) {
        for (const listener of this.#eventListeners.get(message.method) ?? []) {
          listener(message.params ?? {});
        }
      }
    };
    this.#socket.onerror = () => {
      for (const entry of this.#pending.values()) {
        entry.reject(new Error("CDP socket error"));
      }
      this.#pending.clear();
    };
  }

  ready(): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    if (this.#socket.readyState === WebSocket.OPEN) resolve();
    else {
      this.#socket.addEventListener("open", () => resolve(), { once: true });
      this.#socket.addEventListener(
        "error",
        () => reject(new Error("CDP socket failed to open")),
        { once: true },
      );
    }
    return promise;
  }

  send<T>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> {
    const id = this.#nextId++;
    const payload: Record<string, unknown> = { id, method, params };
    if (sessionId !== undefined) payload.sessionId = sessionId;
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    this.#pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    this.#socket.send(JSON.stringify(payload));
    return promise;
  }

  on(
    method: string,
    listener: (params: Record<string, unknown>) => void,
  ): void {
    const listeners = this.#eventListeners.get(method) ?? [];
    listeners.push(listener);
    this.#eventListeners.set(method, listeners);
  }

  close(): void {
    this.#socket.close();
  }
}

async function findChromium(): Promise<string | null> {
  const fromEnv = Deno.env.get("CHROMIUM_PATH") ?? Deno.env.get("CHROME_PATH");
  if (fromEnv !== undefined) return fromEnv;
  for (
    const name of [
      "chromium",
      "chromium-browser",
      "google-chrome",
      "google-chrome-stable",
    ]
  ) {
    try {
      const found = await new Deno.Command(name, {
        args: ["--version"],
        stdout: "null",
        stderr: "null",
      }).output();
      if (found.success) return name;
    } catch {
      // not on PATH
    }
  }
  const home = Deno.env.get("HOME") ?? "/root";
  const candidates: string[] = [];
  try {
    for await (const entry of Deno.readDir(`${home}/.cache/ms-playwright`)) {
      if (!entry.isDirectory || !entry.name.startsWith("chromium")) continue;
      const dir = `${home}/.cache/ms-playwright/${entry.name}`;
      candidates.push(
        `${dir}/chrome-linux64/chrome`,
        `${dir}/chrome-linux/chrome`,
        `${dir}/chrome-headless-shell-linux64/chrome-headless-shell`,
        `${dir}/chrome-linux64/headless_shell`,
      );
    }
  } catch {
    // no playwright cache
  }
  for (const candidate of candidates.reverse()) {
    try {
      await Deno.stat(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

/** Waits for Chromium's stderr to announce its debugging websocket. */
function readDevToolsUrl(process: Deno.ChildProcess): Promise<string | null> {
  const { promise, resolve } = Promise.withResolvers<string | null>();
  const reader = process.stderr.getReader();
  const decoder = new TextDecoder();
  const read = (): void => {
    reader.read().then(({ done, value }) => {
      if (done) {
        resolve(null);
        return;
      }
      const text = decoder.decode(value, { stream: true });
      const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        reader.cancel();
        resolve(match[1]);
        return;
      }
      read();
    }).catch(() => resolve(null));
  };
  read();
  return promise;
}

async function launchChromium(): Promise<
  { process: Deno.ChildProcess; cdp: Cdp } | null
> {
  const binary = await findChromium();
  if (binary === null) return null;
  const command = new Deno.Command(binary, {
    args: [
      "--headless=new",
      "--remote-debugging-port=0",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--window-size=1024,800",
      "about:blank",
    ],
    stdout: "null",
    stderr: "piped",
  });
  const process = command.spawn();
  const wsUrl = await readDevToolsUrl(process);
  if (wsUrl === null) {
    try {
      process.kill("SIGKILL");
    } catch {
      // already gone
    }
    return null;
  }
  const cdp = new CdpClient(wsUrl);
  await cdp.ready();
  return { process, cdp };
}

async function measureRoute(
  cdp: Cdp,
  sessionId: string,
  origin: string,
  route: string,
  theme: string,
): Promise<LiveReading> {
  const url = `${origin}/#/components/${route}`;
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  const loadOnce = async (): Promise<void> => {
    const { promise, resolve } = Promise.withResolvers<void>();
    cdp.on("Page.loadEventFired", () => resolve());
    await cdp.send("Page.navigate", { url }, sessionId);
    await Promise.race([promise, delay(8000)]);
    await delay(250);
  };
  await loadOnce();
  await cdp.send("Runtime.evaluate", {
    expression: `localStorage.setItem("spin-theme", ${
      JSON.stringify(theme)
    }); localStorage.setItem("spin-mode", "base");`,
  }, sessionId);
  await loadOnce();
  await cdp.send("Runtime.evaluate", {
    expression:
      `(() => { const chips = [...document.querySelectorAll("nav button")]; const chip = chips.find((b) => b.textContent.trim() === ${
        JSON.stringify(theme)
      }); if (chip) chip.click(); return chip !== undefined; })()`,
  }, sessionId);
  await delay(120);
  const result = await cdp.send<{ result: { value: LiveReading } }>(
    "Runtime.evaluate",
    { expression: MEASURE, returnByValue: true },
    sessionId,
  );
  return result.result.value;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/**
 * Measures every route under every theme against a live reference app.
 * Returns null when no browser could be driven or the app did not answer.
 */
export async function probeLive(
  origin: string,
  routes: readonly string[],
  themes: readonly string[],
  viewport: { width: number; height: number },
): Promise<LiveReads | null> {
  const launched = await launchChromium();
  if (launched === null) return null;
  const { process, cdp } = launched;
  try {
    const { targetId } = await cdp.send<{ targetId: string }>(
      "Target.createTarget",
      { url: "about:blank" },
    );
    const { sessionId } = await cdp.send<{ sessionId: string }>(
      "Target.attachToTarget",
      {
        targetId,
        flatten: true,
      },
    );
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);
    const byRoute: Record<string, Record<string, LiveReading>> = {};
    for (const route of routes) {
      byRoute[route] = {};
      for (const theme of themes) {
        byRoute[route][theme] = await measureRoute(
          cdp,
          sessionId,
          origin,
          route,
          theme,
        );
      }
    }
    return { origin, measuredAt: new Date().toISOString(), viewport, byRoute };
  } catch {
    return null;
  } finally {
    cdp.close();
    try {
      process.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

/** Reads a recorded baseline from disk; the fallback when no app is live. */
export async function readRecordedBaseline(
  path: string,
): Promise<LiveReads | null> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text) as LiveReads;
  } catch {
    return null;
  }
}
