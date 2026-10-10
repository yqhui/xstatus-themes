import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { __THEME__: JSON.stringify(process.env.THEME || "sketchprobe") },
  build: { target: "es2022", outDir: `themes/${process.env.THEME || "sketchprobe"}/dist`, emptyOutDir: true },
});
