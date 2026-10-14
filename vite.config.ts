import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS
    ? "/invoicelite/"
    : "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
