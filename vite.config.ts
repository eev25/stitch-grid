/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import postcssCustomMedia from "postcss-custom-media";

// https://vite.dev/config/
export default defineConfig({
  base: "/stitch-grid/",
  plugins: [react()],
  css: {
    // Breakpoints like `@media (--mobile)` are defined in src/styles/media.css.
    postcss: { plugins: [postcssCustomMedia()] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
