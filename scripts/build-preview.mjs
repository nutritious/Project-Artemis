// Bundles the real frontend + the in-memory demo backend into ONE html file (for the Claude artifact).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const out = process.argv[2] ?? "preview/artemis-preview.html";
const r = await build({ stdin: { contents: 'import "./scripts/demo.js"; import "./public/js/app.js";', resolveDir: process.cwd() }, bundle: true, minify: true, format: "esm", write: false, target: "es2020" });
let js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
let css = fs.readFileSync("public/css/app.css", "utf8").replace(/@font-face\s*{[^}]*}/g, "");
const html = fs.readFileSync("public/index.html", "utf8");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[^>]*><\/script>/, "");
const page = `<title>Project Artemis</title>
<meta name="description" content="Preview of Project Artemis">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Unbounded:wght@600;800&display=swap">
<style>${css}</style>
${body}
<script type="module">${js}</script>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + " KB");
