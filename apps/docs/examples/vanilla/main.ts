import { SUBJECT_HTML, type Subject } from "../shared.ts";

export function mount(root: HTMLElement, subject: Subject = "card"): () => void {
  root.innerHTML = SUBJECT_HTML[subject];
  return () => {
    root.innerHTML = "";
  };
}
