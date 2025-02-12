import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

esbuild
  .build({
    banner: {
      js: banner,
    },
    minify: prod,
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
      "obsidian",
      "electron",
      "codemirror",
      "@codemirror/closebrackets",
      "@codemirror/commands",
      "@codemirror/fold",
      "@codemirror/gutter",
      "@codemirror/history",
      "@codemirror/language",
      "@codemirror/rangeset",
      "@codemirror/rectangular-selection",
      "@codemirror/search",
      "@codemirror/state",
      "@codemirror/stream-parser",
      "@codemirror/text",
      "@codemirror/view",
      ...builtins,
    ],
    format: "cjs",
    watch: false,
    target: "es2016",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "dist/main.js",
  })
  .catch(() => process.exit(1));
