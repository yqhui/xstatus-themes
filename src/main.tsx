import { createRoot } from "react-dom/client";
import { App } from "./App";
declare const __THEME__: string;
// Only the chosen theme's original visual assets are loaded into the page.
if (__THEME__ === "win2000") await import("./styles/win2000-upstream.css");
else await import("./styles/sketchprobe-upstream.css");
await import("./styles/native.css");
createRoot(document.getElementById("root")!).render(<App />);
