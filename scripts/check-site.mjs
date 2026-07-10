import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://anes-jc.github.io";
const errors = [];
let checkCount = 0;

function check(condition, message) {
  checkCount += 1;
  if (!condition) errors.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function todayJst() {
  if (process.env.ISSUE_DATE_JST) return process.env.ISSUE_DATE_JST;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoDate(value) {
  return String(value || "").replaceAll(".", "-");
}

function localTarget(sourcePath, reference) {
  if (!reference || reference.includes("${") || reference.startsWith("#")) return null;
  if (/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(reference)) return null;
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean) return null;
  return clean.startsWith("/")
    ? path.join(repoRoot, clean.slice(1))
    : path.resolve(path.dirname(path.join(repoRoot, sourcePath)), clean);
}

const articleFiles = fs.readdirSync(path.join(repoRoot, "articles"))
  .filter((name) => name.endsWith(".html"))
  .sort()
  .map((name) => `articles/${name}`);
const mainPages = ["index.html", "articles.html", "tags.html", "schedule.html"];
const htmlFiles = [...mainPages, ...articleFiles];

for (const relativePath of htmlFiles) {
  const html = read(relativePath);
  check(/<html\b[^>]*\blang=["']ja["']/i.test(html), `${relativePath}: html lang=\"ja\" がありません`);
  check(/<title>[^<]+<\/title>/i.test(html), `${relativePath}: title がありません`);
  check(/<h1\b/i.test(html), `${relativePath}: h1 がありません`);

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(duplicateIds.length === 0, `${relativePath}: id が重複しています (${duplicateIds.join(", ")})`);

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    check(/\balt=["'][^"']*["']/i.test(match[1]), `${relativePath}: alt のない画像があります`);
  }
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    if (/\btarget=["']_blank["']/i.test(match[1])) {
      check(/\brel=["'][^"']*noopener/i.test(match[1]), `${relativePath}: target=_blank のリンクに noopener がありません`);
    }
  }
  for (const match of html.matchAll(/<(?:a|link|script|img)\b[^>]*(?:href|src)=["']([^"']+)["']/gi)) {
    const target = localTarget(relativePath, match[1]);
    if (target) check(fs.existsSync(target), `${relativePath}: 参照先がありません (${match[1]})`);
  }
}

for (const relativePath of mainPages) {
  const html = read(relativePath);
  check(html.includes('href="#main-content"'), `${relativePath}: 本文へのスキップリンクがありません`);
  check(/<main\b[^>]*\bid=["']main-content["']/i.test(html), `${relativePath}: main-content がありません`);
}

const context = { window: {}, Intl, Date };
vm.createContext(context);
vm.runInContext(read("data/sunday-articles.js"), context, { filename: "data/sunday-articles.js" });
vm.runInContext(read("data/articles.js"), context, { filename: "data/articles.js" });
const articles = context.window.ALL_ARTICLES || context.window.ARTICLES || [];
const registeredUrls = articles.map((article) => article.url).filter(Boolean);
const registeredSet = new Set(registeredUrls);
const duplicateUrls = [...new Set(registeredUrls.filter((url, index) => registeredUrls.indexOf(url) !== index))];
check(duplicateUrls.length === 0, `記事レジストリ: URL が重複しています (${duplicateUrls.join(", ")})`);

const expectedDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const currentDate = todayJst();
const sitemap = read("sitemap.xml");
const feed = read("feed.xml");

for (const article of articles) {
  const articlePath = String(article.url || "");
  const date = isoDate(article.date);
  check(/^articles\/[a-z0-9-]+\.html$/.test(articlePath), `記事レジストリ: URL 形式が不正です (${articlePath})`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(date), `${articlePath}: 日付形式が不正です (${article.date})`);
  check(fs.existsSync(path.join(repoRoot, articlePath)), `${articlePath}: 記事ファイルがありません`);

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const expectedDay = expectedDays[new Date(`${date}T12:00:00+09:00`).getUTCDay()];
    check(article.dow === expectedDay, `${articlePath}: 曜日が日付と一致しません (${article.dow} / ${expectedDay})`);
  }

  if (!fs.existsSync(path.join(repoRoot, articlePath))) continue;
  const html = read(articlePath);
  const expectedCanonical = `${siteUrl}/${articlePath}`;
  check(html.includes(`<link rel="canonical" href="${expectedCanonical}">`), `${articlePath}: canonical URL が一致しません`);
  check(/<meta name=["']description["'] content=["'][^"']+["']>/i.test(html), `${articlePath}: description がありません`);

  const ogImageReference = html.match(/<meta property=["']og:image["'] content=["']https:\/\/anes-jc\.github\.io\/([^"']+)["']>/i)?.[1];
  const ogImage = ogImageReference?.split(/[?#]/, 1)[0];
  check(Boolean(ogImage), `${articlePath}: og:image がありません`);
  if (ogImage) check(fs.existsSync(path.join(repoRoot, ogImage)), `${articlePath}: OGP画像がありません (${ogImage})`);

  const absoluteUrl = `${siteUrl}/${articlePath}`;
  if (date <= currentDate) {
    check(!html.includes("data-draft-only"), `${articlePath}: 公開日後も noindex 下書きゲートが残っています`);
    check(!html.includes("draft-gate.js"), `${articlePath}: 公開日後も下書きスクリプトが残っています`);
    check(!html.includes("data-draft-notice"), `${articlePath}: 公開日後も下書き表示が残っています`);
    check(sitemap.includes(absoluteUrl), `${articlePath}: sitemap.xml に公開記事がありません`);
    check(feed.includes(absoluteUrl), `${articlePath}: feed.xml に公開記事がありません`);
  } else if (article.dow !== "SUN") {
    check(html.includes("data-draft-only"), `${articlePath}: 公開予定記事に noindex 下書きゲートがありません`);
    check(html.includes(`data-publish-date="${date}"`), `${articlePath}: 下書きゲートの公開日が一致しません`);
    check(!sitemap.includes(absoluteUrl), `${articlePath}: 公開予定記事が sitemap.xml に含まれています`);
    check(!feed.includes(absoluteUrl), `${articlePath}: 公開予定記事が feed.xml に含まれています`);
  }
}

for (const articlePath of articleFiles) {
  check(registeredSet.has(articlePath), `${articlePath}: 記事レジストリに登録されていません`);
}

check(sitemap.includes(`${siteUrl}/articles.html`), "sitemap.xml: 記事一覧がありません");
check(sitemap.includes(`${siteUrl}/tags.html`), "sitemap.xml: テーマ一覧がありません");
check(!sitemap.includes(`${siteUrl}/schedule.html`), "sitemap.xml: noindex の管理ページが含まれています");
check(read("robots.txt").includes(`Sitemap: ${siteUrl}/sitemap.xml`), "robots.txt: Sitemap URL がありません");

if (errors.length > 0) {
  console.error(`Site check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site check passed: ${checkCount} checks, ${htmlFiles.length} HTML files, ${articles.length} registered articles.`);
