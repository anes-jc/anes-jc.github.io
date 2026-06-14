# X投稿運用

正本は `.github/workflows/publish-x.yml` と `scripts/publish-x.mjs`。別名の旧・試作X投稿ファイルは使用・公開しない。

## 公開完了の定義

月・水・金・日の定期記事は、次のすべてが成功して初めて公開完了とする。

1. 記事URLが外部からHTTP 200で取得できる
2. `twitter:card=summary_large_image` が設定されている
3. `twitter:image` がHTTP 200、画像形式、10KB以上で取得できる
4. X投稿APIがツイートIDを返す
5. `data/x-posts.json` に記事URLとツイートIDが記録される

## 自動投稿

`.github/workflows/publish-x.yml` が30分ごとに実行される。
当日公開記事がなければ終了し、投稿済みなら台帳を確認して終了する。
失敗した記事は台帳へ記録されないため、次の30分実行で自動再試行する。
障害が公開日をまたいだ場合も、未投稿の公開済み記事を古い順に回収する。

- 月・水・金記事は公開日のActionが本文インフォグラフィックからカード画像を生成・公開する
- 月・水・金記事はカード生成時に記事HTMLの画像URLへ公開日番号を自動付与し、Xの画像キャッシュを避ける
- 投稿済み記事は `data/x-posts.json` で判定し、二重投稿しない
- カード検証に失敗した場合は投稿しない
- 投稿APIが失敗した場合は台帳へ記録せず、次回実行で再試行する
- 記事URLには日付のクエリ文字列を付け、Xの古いカードキャッシュを避ける

## 必須GitHub Actions Secrets

- `X_API_KEY`
- `X_API_KEY_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

いずれかが未設定の場合、Actionは明示的に失敗する。

## 通常記事のカード準備

通常記事は本文末尾のインフォグラフィックをカード画像として使用する。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/render-og-card.ps1 -Slug article-slug
```

出力された `assets/og/article-slug.png` を記事HTMLの `og:image` と `twitter:image` に絶対URLで指定する。
画像URLには記事公開日を使った更新番号を付ける。

```html
<meta property="og:image" content="https://anes-jc.github.io/assets/og/article-slug.png?v=YYYYMMDD">
<meta name="twitter:image" content="https://anes-jc.github.io/assets/og/article-slug.png?v=YYYYMMDD">
```

## 日曜記事

日曜記事は現在のXプロフィールヘッダー `assets/og/sunday-x-header.png` を使用する。
生成スクリプトが発行日を画像URLの更新番号として自動設定する。

## 手動確認

GitHub Actionsの `Publish scheduled article to X` が失敗した場合のみ対応する。
失敗ログにカード検証、Secrets不足、X APIエラーのいずれかが明記される。
