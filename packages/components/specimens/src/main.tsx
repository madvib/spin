import "virtual:uno.css";
import "./elements.ts";
import { render } from "solid-js/web";
import { App } from "./app.tsx";

render(() => <App />, document.getElementById("root")!);
