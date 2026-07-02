// 公開予定日を過ぎた記事から下書きゲート3点（noindexメタ・draft-gate.js・draft-notice）を
// リポジトリ側で除去する。draft-gate.jsはブラウザ上でしかタグを外せず、検索エンジンは
// 生HTMLのnoindexを見て索引化をスキップするため、公開日にはこの除去が必須。
// Refresh derived feeds ワークフロー（毎日00:10 JST）から実行される。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articlesDir = path.join(repoRoot, "articles");

function todayJst() {
  if (process.env.ISSUE_DATE_JST) return process.env.ISSUE_DATE_JST;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const currentDate = todayJst();
let changed = 0;

for (const name of fs.readdirSync(articlesDir).filter((f) => f.endsWith(".html")).sort()) {
  const filePath = path.join(articlesDir, name);
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("data-draft-only")) continue;

  const dateMatch = original.match(/draft-gate\.js"\s+data-publish-date="(\d{4}-\d{2}-\d{2})"/)
    || original.match(/data-draft-notice\s+data-publish-date="(\d{4}-\d{2}-\d{2})"/);
  if (!dateMatch) {
    console.error(`${name}: has data-draft-only but no data-publish-date; skipping (needs manual check).`);
    process.exitCode = 1;
    continue;
  }
  const publishDate = dateMatch[1];
  if (publishDate > currentDate) {
    console.log(`${name}: gated until ${publishDate} (kept).`);
    continue;
  }

  let updated = original
    .replace(/[ \t]*<meta name="robots"[^>]*data-draft-only[^>]*>\r?\n/, "")
    .replace(/[ \t]*<script src="\.\.\/assets\/draft-gate\.js"[^>]*><\/script>\r?\n/, "")
    .replace(/[ \t]*<div class="draft-notice" data-draft-notice[^>]*>[\s\S]*?<\/div>\r?\n/, "")
    .replace(/^[ \t]*\.draft-notice[^\r\n]*\r?\n/gm, "")
    .replace(/^[ \t]*\.published \.draft-notice[^\r\n]*\r?\n/gm, "");

  const leftovers = ["data-draft-only", "draft-gate.js", "data-draft-notice"]
    .filter((marker) => updated.includes(marker));
  if (leftovers.length > 0 || !updated.includes("</html>")) {
    console.error(`${name}: gate removal incomplete (${leftovers.join(", ") || "broken html"}); file left untouched.`);
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(filePath, updated, "utf8");
  changed += 1;
  console.log(`${name}: draft gate removed (published ${publishDate}).`);
}

console.log(`Removed draft gates from ${changed} article(s) as of ${currentDate} JST.`);
