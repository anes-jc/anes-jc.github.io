import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function addStylesheet(relativePath, href) {
  const target = path.join(root, relativePath);
  const html = fs.readFileSync(target, "utf8");
  const baseHref = href.split("?", 1)[0];
  const escapedHref = baseHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existingHref = new RegExp(`href="${escapedHref}(?:\\?v=[^"]+)?"`);
  if (existingHref.test(html)) {
    const next = html.replace(existingHref, `href="${href}"`);
    if (next === html) return false;
    fs.writeFileSync(target, next, "utf8");
    return true;
  }
  const marker = "</style>";
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`${relativePath}: </style> がありません`);
  const next = `${html.slice(0, index + marker.length)}\n<link rel="stylesheet" href="${href}">${html.slice(index + marker.length)}`;
  fs.writeFileSync(target, next, "utf8");
  return true;
}

const articleDir = path.join(root, "articles");
const articleNames = fs.readdirSync(articleDir).filter((name) => name.endsWith(".html")).sort();
let changed = 0;

for (const name of articleNames) {
  const relativePath = `articles/${name}`;
  const html = fs.readFileSync(path.join(root, relativePath), "utf8");
  const href = html.includes("article-toc.css")
    ? "../assets/article-c-theme.css?v=20260711-2"
    : name.startsWith("latest-papers-")
      ? "../assets/weekly-c-theme.css"
      : null;
  if (href && addStylesheet(relativePath, href)) changed += 1;
}

for (const name of ["articles.html", "tags.html", "schedule.html"]) {
  if (addStylesheet(name, "assets/listing-c-theme.css")) changed += 1;
}

console.log(`Applied C-theme stylesheet links to ${changed} HTML file(s).`);
