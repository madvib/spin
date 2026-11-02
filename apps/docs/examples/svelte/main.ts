import { mount as mountComponent, unmount } from "svelte";
import type { Subject } from "../shared.ts";
import Card from "./Card.svelte";

export function mount(root: HTMLElement, subject: Subject = "card"): () => void {
  const app = mountComponent(Card, { target: root, props: { subject } });
  return () => {
    void unmount(app);
  };
}
