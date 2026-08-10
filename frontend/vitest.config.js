import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: ["__tests__/**/*.test.jsx", "__tests__/**/*.test.js"],
  },
});
