import { assertEquals } from "@std/assert";
import { parseHTML } from "@spin/runtime/testing";
import { signal } from "@spin/runtime";
import { createAvatarFsmBridge } from "./avatar.bridge.ts";
import type { AvatarCommands } from "./avatar.bridge.ts";
import type { AvatarFsmApi } from "./avatar.connect.ts";

/** A live writable read, as the element's prop store exposes one. */
type WriteSignal = { (): unknown; (value: unknown): void };

const win = parseHTML("<!doctype html><html><body></body></html>") as unknown as Record<string, unknown>;
declare const globalThis: Record<string, unknown>;
globalThis.document = win.document;
globalThis.CustomEvent = win.CustomEvent;
globalThis.HTMLElement = win.HTMLElement;
globalThis.Element = win.Element;

/**
 * Prop bags hand back `Record<string, unknown>`, so a handler read out of one
 * is checked here and typed once, instead of an unchecked cast at every call
 * site.
 */
function handler<H>(bag: Record<string, unknown>, key: string): H {
  const value: unknown = bag[key];
  if (typeof value !== "function") throw new Error(`no handler at ${key}`);
  return value as H;
}

/** Read the `use:observe` params out of a bag, which are data. */
function observeParams(bag: Record<string, unknown>): Record<string, unknown> {
  const params: unknown = bag["use:observe"];
  if (typeof params !== "object" || params === null) throw new Error("no action param at use:observe");
  return params as Record<string, unknown>;
}

/** Stand the image element up under its real id, so the connect's reads and
 * writes resolve against the same node the browser would render. */
function mountImage(id: string): HTMLImageElement {
  const image = document.createElement("img");
  image.id = id;
  document.body.appendChild(image);
  return image;
}

/** Make a settled image out of a live one: a warm cache never fires load or
 * error again, so the status has to be read off the node. */
function settle(image: HTMLImageElement, readable: boolean): void {
  Object.defineProperty(image, "complete", { value: true, configurable: true });
  const box = readable ? 48 : 0;
  Object.defineProperty(image, "naturalWidth", { value: box, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: box, configurable: true });
}

interface Harness {
  readonly api: AvatarFsmApi & AvatarCommands;
  readonly statuses: readonly ("loaded" | "error")[];
  root(): Record<string, unknown>;
  image(): Record<string, unknown>;
  fallback(): Record<string, unknown>;
  write(name: string, value: unknown): void;
}

/** Props are signals, exactly as the element's prop store makes them, so a
 * host write reaches the props the connect reads live. Each mount takes its
 * own element id: the part ids are derived from it, and the document holds
 * one node per id. */
function mount(id: string, overrides: Readonly<Record<string, unknown>> = {}): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const statuses: ("loaded" | "error")[] = [];
  const values: Record<string, WriteSignal> = {};
  const write = (name: string, value: unknown): void => {
    const source = values[name];
    if (source === undefined) values[name] = signal<unknown>(value);
    else source(value);
  };
  for (const [name, value] of Object.entries(overrides)) write(name, value);
  write("onStatusChange", (change: { status: "loaded" | "error" }) => statuses.push(change.status));
  const bridge = createAvatarFsmBridge(
    () => {
      const record: Record<string, unknown> = {};
      for (const [name, source] of Object.entries(values)) record[name] = source();
      return record;
    },
    () => root,
    id,
  );
  return {
    api: bridge.api,
    statuses,
    root: () => bridge.api.getRootProps(),
    image: () => bridge.api.getImageProps(),
    fallback: () => bridge.api.getFallbackProps(),
    write,
  };
}

Deno.test("Given a fresh avatar / When nothing is authored / Then loading is the reachable start state", () => {
  const h = mount("fresh");
  assertEquals(h.api.loaded, false, "the api reports the image as not loaded");
  assertEquals(h.api.getRootProps()["data-state"], "loading", "the root reports the loading status");
  assertEquals(h.image()["data-state"], "hidden", "the image is hidden while loading");
  assertEquals(h.image()["aria-hidden"], true, "the hidden image is out of the accessibility tree");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback shows while loading");
  assertEquals(h.api.getFallbackText(), "", "no name leaves the fallback empty");
});

Deno.test("Given a name / When the fallback text is read / Then the initials are the first letters", () => {
  assertEquals(mount("n1", { name: "Ada Lovelace" }).api.getFallbackText(), "AL", "two words give two letters");
  assertEquals(mount("n2", { name: "  grace   hopper " }).api.getFallbackText(), "GH", "runs of space collapse");
  assertEquals(mount("n3", { name: "Cher" }).api.getFallbackText(), "C", "one word gives one letter");
});

Deno.test("Given a loading image / When the element's load event arrives / Then the loaded state is reached", () => {
  const h = mount("load");
  handler<() => void>(h.image(), "onLoad")();
  assertEquals(h.api.loaded, true, "the api reports the image as loaded");
  assertEquals(h.image()["data-state"], "visible", "the image is visible once loaded");
  assertEquals(h.image()["aria-hidden"], undefined, "the loaded image is in the accessibility tree");
  assertEquals(h.fallback()["data-state"], "hidden", "the fallback steps aside once loaded");
  assertEquals(h.statuses, ["loaded"], "status-change reports the settle");
});

Deno.test("Given a loading image / When the element's error event arrives / Then the error state is reached", () => {
  const h = mount("err");
  handler<() => void>(h.image(), "onError")();
  assertEquals(h.api.loaded, false, "a failed image is not loaded");
  assertEquals(h.image()["data-state"], "hidden", "the failed image stays hidden");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback returns for a failed image");
  assertEquals(h.statuses, ["error"], "status-change reports the failure");
});

Deno.test("Given a loading image / When the setLoaded command runs / Then the loaded state is reached", () => {
  const h = mount("cmd-loaded");
  h.api.setLoaded();
  assertEquals(h.api.loaded, true, "the command settles the status");
  assertEquals(h.statuses, ["loaded"], "status-change reports the command's settle");
});

Deno.test("Given a loading image / When the setError command runs / Then the error state is reached", () => {
  const h = mount("cmd-error");
  h.api.setError();
  assertEquals(h.image()["data-state"], "hidden", "the failed image stays hidden");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback shows for the failure");
  assertEquals(h.statuses, ["error"], "status-change reports the command's failure");
});

Deno.test("Given a loaded image / When the setLoaded command runs again / Then the status is not re-reported", () => {
  const h = mount("repeat");
  h.api.setLoaded();
  h.api.setLoaded();
  assertEquals(h.statuses, ["loaded"], "an already-settled status is not re-reported");
  assertEquals(h.image()["data-state"], "visible", "the image stays visible");
});

Deno.test("Given an errored image / When it settles late / Then the loaded state replaces the error", () => {
  const h = mount("late");
  handler<() => void>(h.image(), "onError")();
  handler<() => void>(h.image(), "onLoad")();
  assertEquals(h.image()["data-state"], "visible", "a late settle shows the image");
  assertEquals(h.statuses, ["error", "loaded"], "both statuses report in order");
});

Deno.test("Given a loaded image / When a decode error arrives / Then the fallback returns", () => {
  const h = mount("decode");
  handler<() => void>(h.image(), "onLoad")();
  handler<() => void>(h.image(), "onError")();
  assertEquals(h.api.loaded, false, "the image is no longer loaded");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback returns for the decode error");
  assertEquals(h.statuses, ["loaded", "error"], "both statuses report in order");
});

Deno.test("Given a loading image / When the image node leaves the root / Then the error state is reached", () => {
  const h = mount("unmount");
  const onRemove = handler<(removed: Element) => void>(observeParams(h.root()), "onRemove");
  const removed = document.createElement("span");
  removed.id = String(h.image()["id"]);
  onRemove(removed);
  assertEquals(h.image()["data-state"], "hidden", "a removed image is hidden");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback returns when the image is removed");
  assertEquals(h.statuses, ["error"], "status-change reports the removal as a failure");
});

Deno.test("Given a loaded image / When the image node leaves the root / Then the fallback returns", () => {
  const h = mount("unmount-loaded");
  handler<() => void>(h.image(), "onLoad")();
  const onRemove = handler<(removed: Element) => void>(observeParams(h.root()), "onRemove");
  const removed = document.createElement("span");
  removed.id = String(h.image()["id"]);
  onRemove(removed);
  assertEquals(h.fallback()["data-state"], "visible", "the fallback returns when the image is removed");
  assertEquals(h.statuses, ["loaded", "error"], "both statuses report in order");
});

Deno.test("Given an image under observation / When a node that is not the image leaves / Then nothing changes", () => {
  const h = mount("unmount-other");
  const onRemove = handler<(removed: Element) => void>(observeParams(h.root()), "onRemove");
  const removed = document.createElement("span");
  removed.id = "not-the-image";
  onRemove(removed);
  assertEquals(h.image()["data-state"], "hidden", "the machine is still waiting for the image");
  assertEquals(h.statuses, [], "no status is reported for an unrelated removal");
});

Deno.test("Given a loaded image / When the source changes / Then the machine waits again", () => {
  const h = mount("src");
  handler<() => void>(h.image(), "onLoad")();
  handler<() => void>(observeParams(h.image()), "onAttributes")();
  assertEquals(h.api.getRootProps()["data-state"], "loading", "a new source restarts the wait");
  assertEquals(h.image()["data-state"], "hidden", "the image steps aside for the new source");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback shows while the new source loads");
  assertEquals(h.statuses, ["loaded"], "a restart is not a status report");
});

Deno.test("Given an errored image / When the source changes / Then the machine waits again", () => {
  const h = mount("src-error");
  handler<() => void>(h.image(), "onError")();
  handler<() => void>(observeParams(h.image()), "onAttributes")();
  assertEquals(h.api.getRootProps()["data-state"], "loading", "a new source restarts the wait from an error");
  assertEquals(h.statuses, ["error"], "a restart is not a status report");
});

Deno.test("Given an image that settled before observation started / When the attach report runs / Then the settled status is read", () => {
  const h = mount("ssr");
  const image = mountImage(String(h.image()["id"]));
  settle(image, true);
  handler<() => void>(observeParams(h.image()), "onAttach")();
  assertEquals(h.api.loaded, true, "a readable settled image reports loaded");
  assertEquals(h.statuses, ["loaded"], "status-change reports the settled image");
});

Deno.test("Given an image that failed before observation started / When the attach report runs / Then the failure is read", () => {
  const h = mount("ssr-error");
  const image = mountImage(String(h.image()["id"]));
  settle(image, false);
  handler<() => void>(observeParams(h.image()), "onAttach")();
  assertEquals(h.image()["data-state"], "hidden", "the broken settled image stays hidden");
  assertEquals(h.fallback()["data-state"], "visible", "the fallback shows for a broken settled image");
  assertEquals(h.statuses, ["error"], "status-change reports the zero-dimension image");
});

Deno.test("Given a source that changed to an already-settled image / When the change is observed / Then the new status is read", () => {
  const h = mount("src-settled");
  const image = mountImage(String(h.image()["id"]));
  handler<() => void>(observeParams(h.image()), "onAttributes")();
  assertEquals(h.api.getRootProps()["data-state"], "loading", "an unsettled new source leaves the machine waiting");
  settle(image, true);
  handler<() => void>(observeParams(h.image()), "onAttributes")();
  assertEquals(h.api.loaded, true, "the settled new source is read on the next report");
  assertEquals(h.statuses, ["loaded"], "status-change reports the settle");
});

Deno.test("Given an authored source / When the image bag is read / Then the source and its companions pass through", () => {
  const h = mount("passthrough", {
    src: "/ada.png",
    srcset: "/ada.png 1x, /ada@2x.png 2x",
    sizes: "40px",
    crossOrigin: "anonymous",
    referrerPolicy: "no-referrer",
    alt: "Ada Lovelace",
  });
  const bag = h.image();
  assertEquals(bag["src"], "/ada.png", "the source passes through");
  assertEquals(bag["srcset"], "/ada.png 1x, /ada@2x.png 2x", "the source set passes through");
  assertEquals(bag["sizes"], "40px", "the sizes hint passes through");
  assertEquals(bag["crossorigin"], "anonymous", "the crossOrigin policy passes through");
  assertEquals(bag["referrerpolicy"], "no-referrer", "the referrer policy passes through");
  assertEquals(bag["alt"], "Ada Lovelace", "the alt text passes through");
});

Deno.test("Given no authored source / When the image bag is read / Then no empty source attribute is written", () => {
  const h = mount("empty");
  const bag = h.image();
  assertEquals(bag["src"], undefined, "an unwritten source is absent, so nothing is requested");
  assertEquals(bag["srcset"], undefined, "an unwritten source set is absent");
  assertEquals(bag["alt"], undefined, "an unwritten alt text is absent");
});

Deno.test("Given an image under its machine id / When the setSrc command runs / Then the node carries the new source", () => {
  const h = mount("setsrc");
  const image = mountImage(String(h.image()["id"]));
  h.api.setSrc("/grace.png");
  assertEquals(image.getAttribute("src"), "/grace.png", "the command writes the source onto the image node");
});

Deno.test("Given a default avatar / When the bags are read / Then the three parts carry their machine ids", () => {
  const h = mount("default");
  assertEquals(h.api.getRootProps()["id"], "avatar:default", "the root's id namespaces by element id");
  assertEquals(h.image()["id"], "avatar:default:image", "the image's id namespaces under the root");
  assertEquals(h.fallback()["id"], "avatar:default:fallback", "the fallback's id namespaces under the root");
});

Deno.test("Given an ids prop / When the bags are read / Then the authored ids win", () => {
  const h = mount("ids", { ids: JSON.stringify({ root: "me", image: "me-img", fallback: "me-alt" }) });
  assertEquals(h.api.getRootProps()["id"], "me", "the root carries the authored id");
  assertEquals(h.image()["id"], "me-img", "the image carries the authored id");
  assertEquals(h.fallback()["id"], "me-alt", "the fallback carries the authored id");
});

Deno.test("Given a malformed ids prop / When the bags are read / Then the default ids stand", () => {
  const h = mount("bad-ids", { ids: "{not json" });
  assertEquals(h.api.getRootProps()["id"], "avatar:bad-ids", "malformed JSON falls back to the default ids");
  assertEquals(h.image()["id"], "avatar:bad-ids:image", "the image keeps the default id");
});

Deno.test("Given an rtl direction / When the bags are read / Then every part states its direction", () => {
  const h = mount("rtl", { dir: "rtl" });
  assertEquals(h.api.getRootProps()["dir"], "rtl", "the root states the direction");
  assertEquals(h.image()["dir"], "rtl", "the image states the direction");
  assertEquals(h.fallback()["dir"], "rtl", "the fallback states the direction");
});
