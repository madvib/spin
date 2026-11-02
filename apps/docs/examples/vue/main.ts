import { createApp, h } from "vue";
import { SUBJECT_HTML, type Subject } from "../shared.ts";

export function mount(root: HTMLElement, subject: Subject = "card"): () => void {
  const app = createApp({
    render: () => h("div", { innerHTML: SUBJECT_HTML[subject] }),
  });
  app.mount(root);
  return () => app.unmount();
}
