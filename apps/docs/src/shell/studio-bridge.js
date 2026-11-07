/**
 * The studio's RPC bridge, injected into its index.html by the docs server.
 *
 * The studio is a static Spin app: it dials `/__spin/rpc` on its own origin.
 * In the docs playground that origin is this page, whose theme lives in the
 * Jibe workspace, not on disk. The bridge forwards those calls over a
 * MessagePort to the embed host, which answers them from the workspace client.
 *
 * The handshake is ready-first: the studio announces itself while its module
 * graph is still loading, so the port exists before the first procedure call.
 * Calls that arrive earlier wait on `portReady` instead of falling through to
 * the docs' own daemon.
 */
(() => {
  document.documentElement.dataset.bridge = "loaded";
  let port = null;
  const pending = new Map();
  let next = 0;
  let resolvePort;
  const portReady = new Promise((resolve) => {
    resolvePort = resolve;
  });

  window.addEventListener("message", (event) => {
    if (event.data?.type !== "spin-bridge-init") return;
    const channel = event.ports?.[0];
    if (!channel) return;
    port = channel;
    if (resolvePort) {
      resolvePort();
      resolvePort = undefined;
    }
    port.onmessage = (message) => {
      const { id, response } = message.data ?? {};
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve(response);
      }
    };
  });

  window.parent.postMessage({ type: "spin-bridge-ready" }, "*");

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let url;
    try {
      url = new URL(typeof input === "string" ? input : input.url, location.href);
    } catch {
      return realFetch(input, init);
    }
    if (!url.pathname.startsWith("/__spin/rpc/")) {
      return realFetch(input, init);
    }
    if (port === null) await portReady;
    const path = url.pathname.slice("/__spin/rpc/".length);
    let body = typeof init?.body === "string" ? init.body : "";
    if (body === "" && typeof input !== "string" && typeof input.clone === "function") {
      body = await input.clone().text();
    }
    const id = ++next;
    return new Promise((resolve) => {
      pending.set(id, (response) => {
        resolve(
          new Response(JSON.stringify(response), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      });
      port.postMessage({ id, path, body });
    });
  };
})();
