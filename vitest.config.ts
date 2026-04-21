import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@plugin": path.resolve(__dirname, "src/plugin"),
      "@ui": path.resolve(__dirname, "src/ui"),
      "@domain": path.resolve(__dirname, "src/domain"),
      "@orchestration": path.resolve(__dirname, "src/orchestration"),
      "@services": path.resolve(__dirname, "src/services"),
      "@runtime": path.resolve(__dirname, "src/runtime"),
      "@utils": path.resolve(__dirname, "src/utils")
    }
  },
  test: {
    include: ["tests/**/*.{test,spec}.?(c|m)[jt]s?(x)"]
  }
});
