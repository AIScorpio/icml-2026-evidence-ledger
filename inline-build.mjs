import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const dist = path.join(root, "dist");
const output = path.join(root, "docs", "index.html");

let html = await fs.readFile(path.join(dist, "index.html"), "utf8");

const cssMatch = html.match(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/,
);
if (cssMatch) {
  const cssPath = path.join(dist, cssMatch[1].replace(/^\//, ""));
  const css = await fs.readFile(cssPath, "utf8");
  html = html.replace(cssMatch[0], () => `<style>${css}</style>`);
}

const scriptMatch = html.match(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/,
);
if (!scriptMatch) {
  throw new Error("Unable to locate Vite script in dist/index.html");
}
const scriptPath = path.join(dist, scriptMatch[1].replace(/^\//, ""));
const script = (await fs.readFile(scriptPath, "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
html = html.replace(
  scriptMatch[0],
  () => `<script type="module">${script}</script>`,
);

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, html, "utf8");
console.log(
  JSON.stringify(
    {
      output,
      bytes: Buffer.byteLength(html),
      verification:
        "Run verify_standalone.py against the generated HTML for parsed asset checks.",
    },
    null,
    2,
  ),
);
