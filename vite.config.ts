import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { __THEME__: JSON.stringify(process.env.THEME || "sketchprobe"), __THEME_VERSION__: JSON.stringify(version) },
  build: { target: "es2022", outDir: `themes/${process.env.THEME || "sketchprobe"}/dist`, emptyOutDir: true },
});
