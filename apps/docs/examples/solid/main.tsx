import { render } from "solid-js/web";
import { SUBJECT_HTML, type Subject } from "../shared.ts";

export function mount(root: HTMLElement, subject: Subject = "card"): () => void {
  return render(() => <div innerHTML={SUBJECT_HTML[subject]} />, root);
}
