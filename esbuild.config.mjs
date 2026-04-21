import esbuild from "esbuild";
import process from "node:process";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2021",
  outfile: "main.js",
  sourcemap: isProduction ? false : "inline",
  minify: isProduction,
  logLevel: "info",
  external: ["obsidian", "electron", "@codemirror/*"]
});

if (isWatch) {
  await context.watch();
  console.log("[esbuild] watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
