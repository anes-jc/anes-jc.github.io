import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articlesPath = path.join(repoRoot, "data", "articles.js");
const registryPath = path.join(repoRoot, "data", "sunday-articles.js");
const configPath = path.join(repoRoot, "data", "sunday-article.json");
const siteUrl = (process.env.SITE_URL || "https://anes-jc.github.io").replace(/\/$/, "");

function issueDateJst() {
  const value = process.env.ISSUE_DATE_JST || new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("ISSUE_DATE_JST must use YYYY-MM-DD format.");
  return value;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function issuePeriod(dateString) {
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return { start: addDays(dateString, -((day + 6) % 7)), end: dateString };
}

function loadArticles() {
  const context = { window: {}, Intl, Date };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(articlesPath, "utf8"), context, { filename: articlesPath });
  return context.window.ALL_ARTICLES || context.window.ARTICLES || [];
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function paperLink(paper) {
  if (paper.doi) return `https://doi.org/${encodeURIComponent(paper.doi)}`;
  if (paper.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  return `https://europepmc.org/article/${paper.source || "MED"}/${paper.id}`;
}

function scorePaper(paper, config) {
  const title = (paper.title || "").toLowerCase();
  const journal = (paper.journalTitle || "").toLowerCase();
  const type = (paper.pubType || "").toLowerCase();
  const terms = ["randomized", "randomised", "clinical trial", "systematic review", "meta-analysis",
    "guideline", "consensus", "multicenter", "multicentre", "prospective", "cohort"];
  let score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0), 0);
  score += config.preferredJournals.some((name) => journal.includes(name.toLowerCase())) ? 20 : 0;
  score += type.includes("editorial") || type.includes("letter") || title.includes("protocol") ? -30 : 0;
  return score + Math.min(Number(paper.citedByCount || 0), 10);
}

function classifyStudyDesign(paper) {
  const text = `${paper.title || ""} ${paper.pubType || ""}`.toLowerCase();
  if (text.includes("protocol")) return "研究プロトコル";
  if (text.includes("non-randomized") || text.includes("non-randomised")) return "非無作為化研究";
  const designs = [
    ["システマティックレビュー・メタ解析", ["systematic review", "meta-analysis", "meta analysis"]],
    ["無作為化比較試験", ["randomized", "randomised", "randomized controlled trial"]],
    ["ガイドライン・コンセンサス", ["guideline", "consensus", "recommendation"]],
    ["前向き研究", ["prospective"]],
    ["コホート研究", ["cohort"]],
    ["観察研究", ["observational", "cross-sectional", "case-control"]],
  ];
  return designs.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] || "原著・レビュー";
}

function deriveTheme(paper) {
  const text = `${paper.title || ""} ${paper.abstractText || ""}`.toLowerCase();
  const themes = [
    ["敗血症の治療・管理", ["sepsis", "septic shock"]],
    ["人工呼吸・ARDS管理", ["mechanical ventilation", "ventilator", "ards"]],
    ["気道管理・挿管", ["airway", "intubation", "laryngoscopy"]],
    ["術後合併症の予防", ["postoperative complication", "postoperative outcome"]],
    ["周術期の循環管理", ["hemodynamic", "haemodynamic", "hypotension", "blood pressure"]],
    ["周術期鎮痛・オピオイド", ["analgesia", "opioid", "postoperative pain"]],
    ["麻酔法・麻酔薬の選択", ["anesthesia", "anaesthesia", "anesthetic", "anaesthetic"]],
    ["ICUでの鎮静・せん妄", ["sedation", "delirium"]],
    ["集中治療の予後改善", ["critical care", "intensive care", "icu"]],
    ["周術期管理", ["perioperative", "postoperative", "surgery", "surgical"]],
  ];
  return themes.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] || "麻酔・集中治療の最新研究";
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "anes-jc-sunday-article/1.0" } });
      if (response.ok) return response;
      lastError = new Error(`Request returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw lastError;
}

async function fetchLatestPapers(period, config) {
  if (process.env.SKIP_LATEST_PAPERS === "true") return [];
  const query = `FIRST_PDATE:[${period.start} TO ${period.end}] AND ${config.europePmcQuery}`;
  const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "100" });
  const response = await fetchWithRetry(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`);
  const body = await response.json();
  const ranked = (body.resultList?.result || []).filter((paper) => {
    const text = `${paper.title || ""} ${paper.pubType || ""}`.toLowerCase();
    return paper.title && paper.abstractText
      && !text.includes("protocol")
      && !text.includes("editorial")
      && !text.includes("letter");
  })
    .map((paper) => ({ ...paper, selectionScore: scorePaper(paper, config) }))
    .sort((a, b) => b.selectionScore - a.selectionScore
      || String(b.firstPublicationDate || "").localeCompare(String(a.firstPublicationDate || "")));
  const selected = [];
  const usedThemes = new Set();
  for (const paper of ranked) {
    const theme = deriveTheme(paper);
    if (usedThemes.has(theme)) continue;
    selected.push(paper);
    usedThemes.add(theme);
    if (selected.length === config.latestPaperCount) return selected;
  }
  for (const paper of ranked) {
    if (!selected.includes(paper)) selected.push(paper);
    if (selected.length === config.latestPaperCount) break;
  }
  return selected;
}

function renderPage({ config, issueDate, period, siteArticles, papers }) {
  const siteArticlesHtml = siteArticles.length ? siteArticles.map((article) => `
    <li><a href="../${escapeHtml(article.url)}">${escapeHtml(article.title)}</a><span>${escapeHtml(article.date)}</span></li>`).join("")
    : "<li>今週公開されたサイト記事はありません。</li>";
  const papersHtml = papers.length ? papers.map((paper, index) => {
    const theme = deriveTheme(paper);
    return `<article class="paper-card">
      <div class="number">PAPER ${index + 1}</div>
      <h2>${escapeHtml(theme)}</h2>
      <p class="design">${escapeHtml(classifyStudyDesign(paper))}</p>
      <h3>${escapeHtml(paper.title)}</h3>
      <p class="meta">${escapeHtml(paper.journalTitle || "")}${paper.firstPublicationDate ? ` / ${escapeHtml(paper.firstPublicationDate)}` : ""}</p>
      <a class="source" href="${paperLink(paper)}">抄録・原文を見る →</a>
    </article>`;
  }).join("") : "<p>最新論文情報を取得できませんでした。</p>";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>先週のまとめ｜最新論文3選 | anes-jc</title>
<style>body{margin:0;background:#f4f6f4;color:#15302d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.75}main{max-width:820px;margin:auto;background:#fff;padding:36px}a{color:#0f766e}header{border-bottom:3px solid #0f766e;padding-bottom:18px}.eyebrow,.number{font-size:11px;letter-spacing:.12em;color:#0f766e;font-weight:700}.lead{color:#2c4541}.site-list{padding:0;list-style:none}.site-list li{padding:8px 0;border-bottom:1px solid #d9e0dc;display:flex;justify-content:space-between;gap:12px}.site-list span,.meta{color:#5c6b68;font-size:12px;white-space:nowrap}.paper-card{padding:24px;border:1px solid #bcc8c3;border-radius:5px;margin:18px 0;background:#fbfcfb}.paper-card h2{font-size:24px;line-height:1.4;margin:5px 0;color:#0b4f4a}.paper-card h3{font-size:15px;line-height:1.6;margin:14px 0 5px;font-weight:500}.design{display:inline-block;font-size:11px;border:1px solid #bcc8c3;border-radius:3px;padding:2px 8px;margin:4px 0}.source{display:inline-block;margin-top:10px;font-weight:700}footer{margin-top:32px;color:#5c6b68;font-size:12px}@media(max-width:600px){main{padding:20px}.paper-card{padding:17px}.paper-card h2{font-size:21px}.site-list li{display:block}.site-list span{display:block}}</style>
</head><body><main>
<header><p><a href="../index.html">anes-jc</a></p><div class="eyebrow">SUNDAY · LATEST PAPERS</div>
<h1>先週のまとめ｜最新論文3選</h1><p class="lead">${issueDate}公開。先週の記事と、注目テーマがひと目でわかる最新論文3選です。</p></header>
<section><h2>先週公開した記事</h2><ul class="site-list">${siteArticlesHtml}</ul></section>
<section><h2>最新論文3選</h2>${papersHtml}</section>
<footer><p>対象期間: ${period.start} - ${period.end}</p><p>${escapeHtml(config.disclaimer)}</p></footer>
</main></body></html>`;
}

function writeRegistry(issueDate, slug) {
  const existing = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : "window.SUNDAY_ARTICLES = [];\n";
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(existing, context);
  const articles = context.window.SUNDAY_ARTICLES || [];
  const url = `articles/${slug}.html`;
  const next = [{
    date: issueDate.replaceAll("-", "."), dow: "SUN", status: "公開中", live: true,
    title: "先週のまとめ｜最新論文3選",
    url,
    desc: "先週公開した記事と、麻酔・集中治療領域の注目テーマがわかる最新論文3選。",
    dowTag: { label: "SUN · 先週のまとめ", tag: "先週のまとめ" },
    tags: [{ label: "最新論文", tag: "最新論文" }],
  }, ...articles.filter((article) => article.url !== url)];
  fs.writeFileSync(registryPath, `window.SUNDAY_ARTICLES = ${JSON.stringify(next, null, 2)};\n`, "utf8");
}

const issueDate = issueDateJst();
const period = issuePeriod(issueDate);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const siteArticles = loadArticles().filter((article) => {
  const date = article.date.replaceAll(".", "-");
  return article.dow !== "SUN" && date >= period.start && date <= period.end && date <= issueDate;
}).sort((a, b) => b.date.localeCompare(a.date));
let papers = [];
try {
  papers = await fetchLatestPapers(period, config);
} catch (error) {
  throw new Error(`Latest paper lookup failed after retries: ${error.message}`);
}
if (papers.length < config.latestPaperCount) {
  throw new Error(`Expected ${config.latestPaperCount} latest papers, but found ${papers.length}.`);
}
const slug = `latest-papers-${issueDate}`;
fs.writeFileSync(path.join(repoRoot, "articles", `${slug}.html`),
  renderPage({ config, issueDate, period, siteArticles, papers }), "utf8");
writeRegistry(issueDate, slug);
console.log(`Generated Sunday article ${slug}: ${siteArticles.length} site article(s), ${papers.length} paper(s).`);
