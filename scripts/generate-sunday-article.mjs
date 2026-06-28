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
  const value = process.env.ISSUE_DATE_JST || latestSundayJst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("ISSUE_DATE_JST must use YYYY-MM-DD format.");
  return value;
}

function currentDateJst(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function latestSundayJst(date = new Date()) {
  const dateString = currentDateJst(date);
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return addDays(dateString, -day);
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

function sourceIdentifier(paper) {
  if (paper.doi) return `DOI: ${paper.doi}`;
  if (paper.pmid) return `PMID: ${paper.pmid}`;
  return `Europe PMC: ${paper.source || "MED"}:${paper.id}`;
}

function normalizedTitle(paper) {
  return String(paper.title || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function isPreprint(paper) {
  const source = String(paper.source || "").toUpperCase();
  const doi = String(paper.doi || "").toLowerCase();
  const text = `${paper.title || ""} ${paper.abstractText || ""} ${paper.pubType || ""} ${paper.journalTitle || ""}`.toLowerCase();
  return source === "PPR"
    || text.includes("preprint")
    || text.includes("research square")
    || doi.startsWith("10.21203/rs.")
    || doi.includes("/rs.3.rs-");
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
  if (text.includes("network meta-analysis") || text.includes("network meta analysis")) {
    return "システマティックレビュー・ネットワークメタ解析";
  }
  if (text.includes("bayesian meta-analysis") || text.includes("bayesian meta analysis")) {
    return "ベイズ階層メタ解析";
  }
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
    ["小児心臓手術", ["pediatric", "heart surgery"]],
    ["小児心臓手術", ["paediatric", "heart surgery"]],
    ["形成外科手術の鎮痛", ["blepharoplasty", "analgesia"]],
    ["術後せん妄", ["postoperative delirium"]],
    ["区域麻酔", ["regional anesthesia"]],
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

function derivePaperHeading(paper) {
  return titleRuleFor(paper)?.heading || `${deriveTitleTheme(paper)}：${classifyStudyDesign(paper)}`;
}

function summarizeAbstractJa(paper) {
  return titleRuleFor(paper)?.summary
    || `英語タイトル上は「${deriveTitleTheme(paper)}」を扱う${classifyStudyDesign(paper)}です。下の英語タイトルと出典IDを確認して、抄録・原文で詳細を確認してください。`;
}

function titleRuleFor(paper) {
  const text = normalizedTitle(paper);
  const rules = [
    {
      terms: ["locoregional anesthesia", "cardiac surgery"],
      heading: "心臓手術で局所・区域麻酔テクニックは鎮痛を改善するか",
      summary: "心臓手術における局所・区域麻酔テクニックの鎮痛効果を、無作為化試験のシステマティックレビュー・ネットワークメタ解析で比較しています。",
    },
    {
      terms: ["postoperative hepatic dysfunction", "stanford type a aortic dissection"],
      heading: "Stanford A型大動脈解離修復術後の肝機能障害のリスク因子と予後",
      summary: "Stanford A型大動脈解離修復術後の肝機能障害について、リスク因子と予後をシステマティックレビュー・メタ解析で整理した論文です。",
    },
    {
      terms: ["balanced crystalloids versus saline", "mortality", "hospitalized patients"],
      heading: "入院患者で平衡晶質液と生理食塩水の死亡への影響を比較",
      summary: "入院患者における平衡晶質液と生理食塩水を、死亡をアウトカムとしてベイズ階層メタ解析で比較した論文です。",
    },
    {
      terms: ["oliceridine", "alfentanil", "blepharoplasty"],
      heading: "上眼瞼再手術の局所麻酔にオリセリジンとアルフェンタニルを併用する鎮痛戦略",
      summary: "上眼瞼形成の再手術で、局所麻酔にオリセリジンとアルフェンタニルを組み合わせる鎮痛法を多施設無作為化試験で評価した論文です。",
    },
    {
      terms: ["methylprednisolone", "heart surgery", "pediatric"],
      heading: "小児心臓手術でメチルプレドニゾロンは転帰を改善するか",
      summary: "小児心臓手術におけるメチルプレドニゾロンを、無作為化試験のメタ解析で評価した論文です。",
    },
    {
      terms: ["methylprednisolone", "heart surgery", "paediatric"],
      heading: "小児心臓手術でメチルプレドニゾロンは転帰を改善するか",
      summary: "小児心臓手術におけるメチルプレドニゾロンを、無作為化試験のメタ解析で評価した論文です。",
    },
    {
      terms: ["regional anesthesia", "distal radius fracture"],
      heading: "橈骨遠位端骨折手術で区域麻酔は周術期転帰と術後医療利用にどう影響するか",
      summary: "橈骨遠位端骨折修復術における区域麻酔と、周術期転帰・術後医療利用の関係を多施設後ろ向きコホートで評価した論文です。",
    },
    {
      terms: ["cyanotic congenital heart surgery", "normoxia", "hyperoxia"],
      heading: "チアノーゼ性先天性心疾患手術で正常酸素と高酸素を比較",
      summary: "チアノーゼ性先天性心疾患手術の周術期酸素管理について、正常酸素と高酸素を無作為化試験のメタ解析で比較した論文です。",
    },
    {
      terms: ["transnasal humidified rapid insufflation", "non-intubated anesthesia", "atelectasis"],
      heading: "非挿管麻酔の長時間手術でTHRIVEが術後無気肺を減らすか",
      summary: "長時間の非挿管麻酔を受ける患者で、THRIVEの使用が術後早期無気肺に与える影響を無作為化試験で検証した論文です。",
    },
    {
      terms: ["depth of anesthesia", "motor evoked potentials", "spinal surgery"],
      heading: "若年者の脊椎手術で麻酔深度が運動誘発電位に与える影響",
      summary: "若年者の脊椎手術で、麻酔深度が運動誘発電位モニタリングに与える影響を前向きに調べた論文です。",
    },
  ];
  return rules.find((rule) => includesAll(text, rule.terms));
}

function deriveTitleTheme(paper) {
  const text = normalizedTitle(paper);
  const themes = [
    ["心臓手術の区域麻酔・鎮痛", ["locoregional anesthesia", "cardiac surgery"]],
    ["大動脈解離術後の肝機能障害", ["hepatic dysfunction", "aortic dissection"]],
    ["輸液製剤と死亡アウトカム", ["balanced crystalloids", "saline"]],
    ["小児心臓手術", ["pediatric", "heart surgery"]],
    ["小児心臓手術", ["paediatric", "heart surgery"]],
    ["形成外科手術の鎮痛", ["blepharoplasty"]],
    ["橈骨遠位端骨折の区域麻酔", ["distal radius fracture"]],
    ["先天性心疾患手術の酸素管理", ["cyanotic congenital heart"]],
    ["非挿管麻酔と術後無気肺", ["non-intubated anesthesia", "atelectasis"]],
    ["脊椎手術の神経モニタリング", ["motor evoked potentials", "spinal surgery"]],
    ["人工呼吸・ARDS管理", ["mechanical ventilation", "ards"]],
    ["気道管理・挿管", ["airway", "intubation"]],
    ["周術期鎮痛", ["analgesia", "pain"]],
    ["集中治療", ["critical care", "intensive care", "icu"]],
    ["周術期管理", ["perioperative", "postoperative", "surgery", "surgical"]],
  ];
  return themes.find(([, terms]) => includesAll(text, terms))?.[0] || "麻酔・集中治療領域の最新論文";
}

function paperCardData(paper) {
  return {
    heading: derivePaperHeading(paper),
    design: classifyStudyDesign(paper),
    summary: summarizeAbstractJa(paper),
    title: String(paper.title || "").trim(),
    journal: String(paper.journalTitle || "").trim(),
    date: paper.firstPublicationDate || "",
    link: paperLink(paper),
    sourceId: sourceIdentifier(paper),
  };
}

function validatePaperCards(cards, papers) {
  if (cards.length !== papers.length) {
    throw new Error(`Rendered ${cards.length} paper cards for ${papers.length} source papers.`);
  }
  const links = new Set();
  const guardedClaims = [
    ["ICU患者", ["icu", "intensive care"]],
    ["小児心臓手術", ["pediatric", "paediatric", "heart surgery"]],
    ["上眼瞼", ["blepharoplasty"]],
    ["橈骨遠位端骨折", ["distal radius fracture"]],
    ["チアノーゼ性先天性心疾患", ["cyanotic congenital heart"]],
    ["A型大動脈解離", ["type a aortic dissection"]],
    ["平衡晶質液", ["balanced crystalloids"]],
  ];
  cards.forEach((card, index) => {
    const paper = papers[index];
    const title = String(paper.title || "").trim();
    const titleText = normalizedTitle(paper);
    if (!card.title || card.title !== title) {
      throw new Error(`Paper card ${index + 1} title does not match the source paper.`);
    }
    if (card.link !== paperLink(paper)) {
      throw new Error(`Paper card ${index + 1} link does not match the source paper.`);
    }
    if (!card.sourceId) {
      throw new Error(`Paper card ${index + 1} is missing a source identifier.`);
    }
    if (links.has(card.link)) {
      throw new Error(`Duplicate paper link generated: ${card.link}`);
    }
    links.add(card.link);
    for (const [claim, requiredTerms] of guardedClaims) {
      if ((card.heading.includes(claim) || card.summary.includes(claim)) && !includesAny(titleText, requiredTerms)) {
        throw new Error(`Paper card ${index + 1} claims "${claim}" but the English title does not support it.`);
      }
    }
  });
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
      && !isPreprint(paper)
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
  const pageTitle = "先週のまとめ｜最新論文3選";
  const pageDescription = `${period.start}から${period.end}の公開記事と最新論文3選をまとめる週次記事。選定論文と読みどころを短く確認できます。`;
  const pageUrl = `${siteUrl}/articles/latest-papers-${issueDate}.html`;
  const imageUrl = `${siteUrl}/assets/og/latest-papers-${issueDate}.png?v=${issueDate}`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline: pageTitle,
    description: pageDescription,
    image: [imageUrl],
    datePublished: `${issueDate}T00:00:00+09:00`,
    dateModified: `${issueDate}T00:00:00+09:00`,
    author: {
      "@type": "Organization",
      name: "anes-jc",
    },
    publisher: {
      "@type": "Organization",
      name: "anes-jc",
    },
    inLanguage: "ja",
  }, null, 2);
  const siteArticlesHtml = siteArticles.length ? siteArticles.map((article) => `
    <li><a href="../${escapeHtml(article.url)}">${escapeHtml(article.title)}</a><span>${escapeHtml(article.date)}</span></li>`).join("")
    : "<li>今週公開されたサイト記事はありません。</li>";
  const paperCards = papers.map(paperCardData);
  validatePaperCards(paperCards, papers);
  const papersHtml = paperCards.length ? paperCards.map((card) => {
    return `<article class="paper-card">
      <h2>${escapeHtml(card.heading)}</h2>
      <p class="design">${escapeHtml(card.design)}</p>
      <p class="summary"><span>日本語メモ</span>${escapeHtml(card.summary)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="meta">${escapeHtml(card.journal)}${card.date ? ` / ${escapeHtml(card.date)}` : ""}</p>
      <p class="source-id">${escapeHtml(card.sourceId)}</p>
      <a class="source" href="${card.link}">抄録・原文を見る →</a>
    </article>`;
  }).join("") : "<p>最新論文情報を取得できませんでした。</p>";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(pageDescription)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article"><meta property="og:site_name" content="anes-jc">
<meta property="og:title" content="${pageTitle} | anes-jc">
<meta property="og:description" content="${escapeHtml(pageDescription)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${imageUrl}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${pageTitle} | anes-jc">
<meta name="twitter:description" content="${escapeHtml(pageDescription)}">
<meta name="twitter:image" content="${imageUrl}">
<script type="application/ld+json">${structuredData}</script>
<title>${pageTitle} | anes-jc</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;600;700&display=swap" rel="stylesheet">
<style>:root{--paper:#f4f6f4;--paper-2:#fbfcfb;--ink:#15302d;--ink-soft:#2c4541;--teal:#0f766e;--teal-deep:#0b4f4a;--muted:#5c6b68;--line:#d9e0dc;--line-strong:#bcc8c3}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{background:var(--paper);color:var(--ink);font-family:"Noto Sans JP",sans-serif;line-height:1.9;-webkit-font-smoothing:antialiased}.wrap{max-width:760px;margin:0 auto;padding:0 24px}a{color:var(--teal-deep)}header.bar{border-bottom:1px solid var(--line);background:rgba(244,246,244,.86);backdrop-filter:blur(8px);position:sticky;top:0;z-index:50}.bar-in{max-width:760px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:56px}.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;color:var(--ink);text-decoration:none}.brand .dot{width:8px;height:8px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px rgba(15,118,110,.15)}.bar-actions{display:flex;align-items:center;gap:14px}.back{font-size:13px;color:var(--muted);text-decoration:none}.foot-x{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--teal-deep);text-decoration:none;border:1px solid var(--line-strong);background:var(--paper-2);border-radius:2px;padding:5px 10px;white-space:nowrap}.foot-x:hover{background:var(--teal);color:#fff;border-color:var(--teal)}.ahead{padding:48px 0 30px;border-bottom:1px solid var(--line)}.kicker{font-family:"JetBrains Mono",monospace;letter-spacing:.06em;color:var(--teal-deep);display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center}.pill{font-size:12px;font-weight:500;border:1px solid var(--line-strong);border-radius:3px;padding:5px 12px;text-decoration:none;color:var(--teal-deep)}.pill.cls{background:var(--ink);color:#fff;border-color:var(--ink)}h1{font-family:"Noto Serif JP",serif;font-weight:700;font-size:clamp(28px,5vw,40px);line-height:1.35;letter-spacing:.01em}.title-tail{white-space:nowrap}.cite{margin-top:22px;font-size:13px;color:var(--muted);font-family:"JetBrains Mono",monospace;line-height:1.7;border-left:2px solid var(--teal);padding-left:14px}.sec{padding:38px 0;border-bottom:1px solid var(--line)}.sechd{margin-bottom:18px}.sechd h2{font-family:"Noto Serif JP",serif;font-size:22px;font-weight:600;line-height:1.4}.site-list{padding:0;list-style:none}.site-list li{padding:12px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}.site-list span,.meta,.source-id{color:var(--muted);font-family:"JetBrains Mono",monospace;font-size:12px}.site-list span,.meta{white-space:nowrap}.source-id{overflow-wrap:anywhere;margin-top:2px}.paper-card{padding:26px 28px;border:1px solid var(--line);border-radius:4px;margin:18px 0;background:var(--paper-2)}.paper-card h2{font-family:"Noto Serif JP",serif;font-size:22px;line-height:1.4;margin:0 0 8px;color:var(--ink)}.paper-card h3{font-size:15px;line-height:1.7;margin:14px 0 5px;font-weight:500;color:var(--ink-soft)}.design{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:11px;border:1px solid var(--line-strong);border-radius:3px;padding:3px 9px;margin:4px 0 12px;color:var(--teal-deep)}.summary{font-size:14px;line-height:1.8;color:var(--ink-soft);background:#fff;border-left:2px solid var(--teal);padding:12px 14px;margin:4px 0 16px}.summary span{display:block;font-size:11px;font-family:"JetBrains Mono",monospace;font-weight:700;color:var(--teal-deep);margin-bottom:4px}.source{display:inline-block;margin-top:10px;font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:700;text-decoration:none;border:1px solid var(--line-strong);padding:6px 12px;border-radius:2px}.source:hover{background:var(--teal);color:#fff;border-color:var(--teal)}footer{border-top:1px solid var(--line);padding:36px 0 60px;margin-top:24px}.disc{font-size:12px;color:var(--muted);line-height:1.9}.foot-x{display:inline-block;margin-top:14px;padding:7px 12px}@media(max-width:560px){.bar-in{height:54px;padding:0 18px;gap:12px}.brand{min-width:0;gap:8px;font-size:12px;line-height:1.2;white-space:nowrap}.back{font-size:12px;white-space:nowrap}.wrap{padding:0 18px}h1 .title-part{display:block}.title-sep{display:none}.paper-card{padding:20px}.site-list li{display:block}.site-list span{display:block;margin-top:4px}}</style>
<script src="../assets/analytics-config.js"></script>
<script src="../assets/analytics.js" defer></script>
</head><body><header class="bar"><div class="bar-in"><a class="brand" href="../index.html"><span class="dot"></span>麻酔・集中治療 / 論文ジャーナルクラブ</a><div class="bar-actions"><a class="back" href="../articles.html">← 記事一覧</a></div></div></header><div class="wrap">
<div class="ahead"><div class="kicker"><a class="pill cls" href="../tags.html?tag=先週のまとめ">SUN · 先週のまとめ</a><a class="pill" href="../tags.html?tag=最新論文">最新論文</a></div>
<h1><span class="title-part">先週のまとめ</span><span class="title-sep">｜</span><span class="title-part title-tail">最新論文3選</span></h1><div class="cite">${issueDate} 公開<br>対象期間: ${period.start} - ${period.end}</div></div>
<section class="sec"><div class="sechd"><h2>先週の記事一覧</h2></div><ul class="site-list">${siteArticlesHtml}</ul></section>
<section class="sec"><div class="sechd"><h2>最新論文3選</h2></div>${papersHtml}</section>
<section class="sec"><div class="sechd"><h2>このページについて</h2></div><p>このページは、週次の定点観測として毎週日曜に自動生成・自動公開しています。</p></section>
</div><footer><div class="wrap"><p class="disc">${escapeHtml(config.disclaimer)}</p><a class="foot-x" href="https://x.com/anes_icu_jc" target="_blank" rel="noopener">Xで更新を見る</a></div></footer>
</body></html>`;
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
    desc: "対象期間の公開記事と最新論文3選をまとめる週次記事。選定論文と読みどころを短く確認できます。",
    dowTag: { kind: "weekday", label: "SUN · 先週のまとめ", tag: "先週のまとめ" },
    tags: [{ kind: "clinical", label: "最新論文", tag: "最新論文" }],
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

