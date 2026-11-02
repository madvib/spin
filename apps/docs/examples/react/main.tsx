import { createRoot } from "react-dom/client";
import { SUBJECT_HTML, type Subject } from "../shared.ts";

export function mount(root: HTMLElement, subject: Subject = "card"): () => void {
  const app = createRoot(root);
  app.render(<div dangerouslySetInnerHTML={{ __html: SUBJECT_HTML[subject] }} />);
  return () => app.unmount();
}
