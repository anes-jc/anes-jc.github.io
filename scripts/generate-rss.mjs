import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = (process.env.SITE_URL || "https://anes-jc.github.io").replace(/\/$/, "");
const sundayArticlesPath = path.join(repoRoot, "data", "sunday-articles.js");
const articlesPath = path.join(repoRoot, "data", "articles.js");
const outputPath = path.join(repoRoot, "feed.xml");

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

function articleDateTime(article) {
  const date = articleDate(article);
  return new Date(`${date}T09:00:00+09:00`);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(url) {
  return `${siteUrl}/${String(url || "").replace(/^\/+/, "")}`;
}

function itemCategories(article) {
  return [
    article.dowTag?.tag,
    ...(article.tags || []).map((tag) => tag.tag),
  ].filter(Boolean);
}

const currentDate = todayJst();
const publishedArticles = loadArticles()
  .filter((article) => article.url && articleDate(article) <= currentDate)
  .sort((a, b) => articleDate(b).localeCompare(articleDate(a))
    || String(a.url || "").localeCompare(String(b.url || "")));

const lastBuildDate = publishedArticles[0] ? articleDateTime(publishedArticles[0]) : new Date();

const items = publishedArticles.map((article) => {
  const link = absoluteUrl(article.url);
  const categories = itemCategories(article)
    .map((category) => `      <category>${escapeXml(category)}</category>`)
    .join("\n");
  return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(article.desc)}</description>
      <pubDate>${articleDateTime(article).toUTCString()}</pubDate>${categories ? `\n${categories}` : ""}
    </item>`;
}).join("\n");

fs.writeFileSync(outputPath, `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>anes-jc | 麻酔・集中治療 論文ジャーナルクラブ</title>
    <link>${escapeXml(siteUrl)}/</link>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>麻酔・集中治療領域の論文解説と週次まとめの更新情報です。</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`, "utf8");

console.log(`Generated feed.xml with ${publishedArticles.length} item(s).`);
