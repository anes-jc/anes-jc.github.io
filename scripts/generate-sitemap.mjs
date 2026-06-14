import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = (process.env.SITE_URL || "https://anes-jc.github.io").replace(/\/$/, "");
const sundayArticlesPath = path.join(repoRoot, "data", "sunday-articles.js");
const articlesPath = path.join(repoRoot, "data", "articles.js");
const outputPath = path.join(repoRoot, "sitemap.xml");

function todayJst() {
  if (process.env.ISSUE_DATE_JST) return process.env.ISSUE_DATE_JST;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function loadArticles() {
  const context = { window: {}, Intl, Date };
  vm.createContext(context);
  if (fs.existsSync(sundayArticlesPath)) {
    vm.runInContext(fs.readFileSync(sundayArticlesPath, "utf8"), context, { filename: sundayArticlesPath });
  }
  vm.runInContext(fs.readFileSync(articlesPath, "utf8"), context, { filename: articlesPath });
  return context.window.ALL_ARTICLES || context.window.ARTICLES || [];
}

function articleDate(article) {
  return String(article.date || "").replaceAll(".", "-");
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function addUrl(urls, loc, lastmod, priority) {
  urls.push({ loc, lastmod, priority });
}

const currentDate = todayJst();
const publishedArticles = loadArticles()
  .filter((article) => article.url && articleDate(article) <= currentDate)
  .sort((a, b) => articleDate(b).localeCompare(articleDate(a)));

const latestDate = publishedArticles[0] ? articleDate(publishedArticles[0]) : currentDate;
const tags = [...new Set(publishedArticles.flatMap((article) => [
  article.dowTag?.tag,
  ...(article.tags || []).map((tag) => tag.tag),
]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));

const urls = [];
addUrl(urls, `${siteUrl}/`, latestDate, "1.0");
addUrl(urls, `${siteUrl}/tags.html`, latestDate, "0.8");

for (const tag of tags) {
  addUrl(urls, `${siteUrl}/tags.html?tag=${encodeURIComponent(tag)}`, latestDate, "0.6");
}

for (const article of publishedArticles) {
  addUrl(urls, `${siteUrl}/${article.url}`, articleDate(article), article.dow === "SUN" ? "0.8" : "0.9");
}

const body = urls.map((url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
    <priority>${url.priority}</priority>
  </url>`).join("\n");

fs.writeFileSync(outputPath, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`, "utf8");

console.log(`Generated sitemap.xml with ${urls.length} URL(s).`);
