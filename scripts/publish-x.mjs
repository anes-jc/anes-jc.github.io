import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const siteUrl = process.env.SITE_URL || "https://anes-jc.github.io";
const ledgerPath = path.join(root, "data", "x-posts.json");
const disallowedImageHashes = new Set([
  // Old blue placeholder image. Normal articles must use their own infographic.
  "2faff9722d3c9dc310107e9d7a8a08dda16160cdea72311a30a321809be35e0f"
]);

function jstDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

function loadArticles() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of ["data/sunday-articles.js", "data/articles.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return context.window.ALL_ARTICLES || context.window.ARTICLES || [];
}

function getMeta(html, key, attribute = "property") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escaped}["']`, "i"))?.[1];
}

async function fetchWithRetry(url, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Twitterbot/1.0" } });
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
  throw lastError;
}

async function validateCard(articleUrl) {
  const page = await fetchWithRetry(articleUrl);
  const html = await page.text();
  const card = getMeta(html, "twitter:card", "name");
  const imageUrl = getMeta(html, "twitter:image", "name") || getMeta(html, "og:image");
  if (card !== "summary_large_image") throw new Error(`twitter:card is missing or invalid: ${card}`);
  if (!imageUrl) throw new Error("twitter:image and og:image are missing");
  const image = await fetchWithRetry(imageUrl);
  const type = image.headers.get("content-type") || "";
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const bytes = imageBuffer.byteLength;
  const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
  if (!type.startsWith("image/") || bytes < 10000) {
    throw new Error(`Card image is invalid: type=${type}, bytes=${bytes}`);
  }
  if (disallowedImageHashes.has(hash)) throw new Error("Card image is the old placeholder image");
  return { imageUrl, bytes, hash };
}

function percentEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(method, url) {
  const required = ["X_API_KEY", "X_API_KEY_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"];
  for (const name of required) if (!process.env[name]) throw new Error(`Missing GitHub Actions secret: ${name}`);
  const params = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(24).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: "1.0"
  };
  const parameterString = Object.entries(params).sort().map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`).join("&");
  const base = [method, percentEncode(url), percentEncode(parameterString)].join("&");
  const key = `${percentEncode(process.env.X_API_KEY_SECRET)}&${percentEncode(process.env.X_ACCESS_TOKEN_SECRET)}`;
  params.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return `OAuth ${Object.entries(params).sort().map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`).join(", ")}`;
}

async function postTweet(text) {
  const url = "https://api.x.com/2/tweets";
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", url), "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  const body = await response.json();
  if (!response.ok || !body.data?.id) throw new Error(`X post failed (${response.status}): ${JSON.stringify(body)}`);
  return body.data.id;
}

const today = process.env.ISSUE_DATE_JST || jstDate();
const registryDate = today.replaceAll("-", ".");
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {};
const isPosted = (item) => Boolean(ledger[item.url]?.tweetId || ledger[item.url]?.status);
const article = loadArticles()
  .filter((item) => item.date <= registryDate && !isPosted(item))
  .sort((a, b) => a.date.localeCompare(b.date))[0];
if (!article) {
  console.log(`No unposted published article as of ${today}.`);
  process.exit(0);
}

const cacheKey = article.date.replaceAll(".", "");
const articleUrl = `${siteUrl}/${article.url}?x=${cacheKey}`;
const card = await validateCard(articleUrl);
const intro = article.dow === "SUN"
  ? "先週公開した記事と、麻酔・集中治療領域の注目論文3本をまとめました。"
  : "麻酔・集中治療領域の論文を、臨床・研究デザイン・統計の視点から読み解きます。";
const text = `${article.title}\n\n${intro}\n\n${articleUrl}\n\n#麻酔科 #集中治療 #論文抄読`;
if (process.env.X_DRY_RUN === "1") {
  console.log(JSON.stringify({ article, articleUrl, card, text }, null, 2));
  process.exit(0);
}
const tweetId = await postTweet(text);

ledger[article.url] = { status: "posted", date: article.date.replaceAll(".", "-"), tweetId, articleUrl, imageUrl: card.imageUrl, postedAt: new Date().toISOString() };
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`Posted https://x.com/anes_icu_jc/status/${tweetId}`);
