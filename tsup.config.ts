import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/start-all.ts"],
  format: ["cjs"],
  target: "es2020",
  noExternal: [],
  external: [/^[^./]/],
});
