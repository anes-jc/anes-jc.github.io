import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");

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

const today = process.env.ISSUE_DATE_JST || jstDate();
const registryDate = today.replaceAll("-", ".");
const ledgerPath = path.join(root, "data", "x-posts.json");
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {};
const isPosted = (item) => Boolean(ledger[item.url]?.tweetId || ledger[item.url]?.status);
const article = loadArticles()
  .filter((item) => item.date <= registryDate && !isPosted(item))
  .sort((a, b) => a.date.localeCompare(b.date))[0];
if (!article || article.dow === "SUN") {
  console.log(article ? "Next unposted article is Sunday and uses the shared X header." : `No unposted published article as of ${today}.`);
  process.exit(0);
}

const slug = path.basename(article.url, ".html");
const articlePath = path.join(root, article.url);
const outputPath = path.join(root, "assets", "og", `${slug}.png`);
let html = fs.readFileSync(articlePath, "utf8");
const svgs = html.match(/<svg[\s\S]*?<\/svg>/gi);
if (!svgs?.length) throw new Error(`No infographic SVG found in ${article.url}`);

const svg = svgs.at(-1)
  .replace(/<svg\b/, '<svg width="855" height="630"')
  .replace(/font-family="'Noto Sans JP',sans-serif/g, 'font-family="Noto Sans CJK JP,sans-serif')
  .replace(/font-family="'Noto Serif JP',serif/g, 'font-family="Noto Serif CJK JP,serif');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg))
  .resize(855, 630, { fit: "contain", background: "#F4F6F4" })
  .extend({ left: 172, right: 173, top: 0, bottom: 0, background: "#F4F6F4" })
  .png()
  .toFile(outputPath);

const imageUrl = `https://anes-jc.github.io/assets/og/${slug}.png?v=${article.date.replaceAll(".", "")}`;
html = html
  .replace(/(<meta property=["']og:image["'] content=["'])[^"']+(["'])/i, `$1${imageUrl}$2`)
  .replace(/(<meta name=["']twitter:image["'] content=["'])[^"']+(["'])/i, `$1${imageUrl}$2`);
fs.writeFileSync(articlePath, html);
console.log(`Prepared ${path.relative(root, outputPath)}`);
