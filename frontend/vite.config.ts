import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: parseInt(process.env.PORT ?? "5173"),
  },
  build: {
    outDir: "../src/riftcheck/viewer",
    emptyOutDir: true,
  },
});
