# anes-jc 運営README

麻酔・集中治療領域の英語論文を、臨床背景・研究デザイン・統計解析まで読み解くジャーナルクラブサイトです。

- 公開URL: https://anes-jc.github.io/
- 正本リポジトリ: `anes-jc/anes-jc.github.io`
- 公開ブランチ: `main`
- 公開方式: GitHub Pages

## サイト構成

```text
.
├── index.html                    # トップページ
├── articles.html                 # 全記事一覧
├── tags.html                     # タグ別記事一覧
├── articles/                     # 記事HTML
├── assets/og/                    # Xカード・OGP画像
├── data/
│   ├── articles.js               # 月・水・金の通常記事レジストリ
│   ├── sunday-articles.js        # 日曜まとめ記事レジストリ
│   ├── sunday-article.json       # 日曜まとめの検索条件・免責文
│   ├── history.json              # 採用済み論文の重複防止台帳
│   ├── paper-selection-policy.json
│   └── stat-themes.json
├── scripts/
│   ├── generate-sitemap.mjs
│   └── generate-sunday-article.mjs
└── .github/workflows/
    └── publish-sunday-article.yml
```

## 公開ルール

月・水・金の通常記事は、人間の採用判断、本文確認、公開許可を必須にします。記事案を作ったAIとは別のAIで独立校正し、最終的に人間が公開を許可してからGitHubへ反映します。

日曜の「先週のまとめ｜最新論文3選」は例外です。これは週次の定点観測記事として、GitHub Actionsが毎週日曜 18:00 JSTに自動生成・自動公開します。19:17 JSTに補完実行も行います。毎回の記事本文にも、この日曜まとめが自動生成・自動公開であることを明記します。

記事以外のサイトデザイン、UI、機能、設定、運用資料は、ユーザーから明示的な変更指示があれば、その指示を公開許可として扱い、確認後にコミット・プッシュします。

## 通常記事を追加する

詳しい手順は `HOW-TO-ADD-ARTICLE.md` を参照します。基本は次の流れです。

1. 記事HTMLを `articles/` に置く。
2. `data/articles.js` に記事情報を1ブロック追加する。
3. 必要に応じて `data/history.json` を更新する。
4. `node scripts/generate-sitemap.mjs` で sitemap を更新する。
5. 公開前に人間が本文と公開可否を確認する。

公開曜日は、月曜が新着RCT、水曜が統計・研究手法、金曜が古典論文です。`date`、`dow`、`dowTag`、`history.json` の枠は一致させます。

## 日曜まとめ

日曜まとめは `scripts/generate-sunday-article.mjs` が生成します。

```powershell
$env:ISSUE_DATE_JST = "2026-06-14"
node scripts/generate-sunday-article.mjs
node scripts/generate-sitemap.mjs
```

本番では `.github/workflows/publish-sunday-article.yml` が同じ処理を実行し、変更があれば自動コミットします。Europe PMCから十分な論文を取得できない場合は不完全な記事を公開せず、補完実行へ回します。

## 公開後チェック

公開後は最低限、次を確認します。

- トップページに最新記事が想定どおり表示される。
- `articles.html` と `tags.html` から記事へ移動できる。
- 最新記事のPC幅・スマホ幅で文字が崩れない。
- Xカード用の `og:*` と `twitter:*` が記事HTMLに入っている。
- `sitemap.xml` に公開済み記事URLが含まれる。
- 記事本文の引用、DOI、PMID、数値が原著と矛盾しない。

## 継続運営の方針

当面は広告や課金を急がず、質の高い更新を継続して読者の信頼を作ることを優先します。特に、麻酔・集中治療の臨床家が「論文選定」「研究デザイン」「統計の読み方」を短時間で確認できる状態を維持します。

収益化は段階的に進めます。まずはXなどからサイトへの導線を安定させ、読者の反応がある記事テーマを把握します。その後、支援リンク、スポンサー枠、有料まとめ、院内勉強会資料化など、専門性と相性がよい方法を小さく試します。医療情報サイトとして、記事内容の独立性と利益相反の明示を優先します。
