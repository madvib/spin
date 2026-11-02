/**
 * The prebuilt preview surface.
 *
 * One persistent iframe owns the framework module and the theme stylesheet.
 * The docs posts a selection; this shell unmounts the previous subject,
 * mounts the new one, and never reloads the document.
 *
 * Selection is a generation: a framework module arrives asynchronously, and a
 * later selection that lands first must not be overwritten by an earlier
 * import resolving late.
 */
const root = document.getElementById("root");
const theme = document.getElementById("spin-theme");
let unmount = null;
let generation = 0;

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin) return;
  const data = event.data;
  if (typeof data !== "object" || data === null || data.type !== "spin-preview") {
    return;
  }
  const mine = ++generation;
  if (theme !== null && typeof data.themeCss === "string") {
    theme.textContent = data.themeCss;
  }
  if (typeof data.mode === "string") {
    document.documentElement.dataset.mode = data.mode;
  }
  if (typeof unmount === "function") {
    unmount();
    unmount = null;
  }
  if (root === null) return;
  root.replaceChildren();
  if (data.kind === "markup") {
    root.innerHTML = typeof data.html === "string" ? data.html : "";
    return;
  }
  if (data.kind !== "module" || typeof data.url !== "string") return;
  void import(data.url)
    .then((module) => {
      if (mine !== generation) return;
      if (typeof module.mount !== "function") {
        throw new Error("prebuilt example has no mount export");
      }
      unmount = module.mount(root, data.subject);
    })
    .catch((error) => {
      if (mine !== generation) return;
      root.textContent = error instanceof Error ? error.message : String(error);
    });
});

parent.postMessage({ type: "spin-shell-ready" }, location.origin);
