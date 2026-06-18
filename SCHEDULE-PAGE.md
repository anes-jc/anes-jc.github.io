# Schedule Page

`schedule.html` is an internal, noindex page for checking every article URL in one place.

- Public URL: `https://anes-jc.github.io/schedule.html`
- Data source: `data/sunday-articles.js` and `data/articles.js`
- It reads `window.ALL_ARTICLES`, so it shows both published and upcoming articles.
- It does not change the normal public listing behavior. `index.html`, `articles.html`, and `tags.html` continue to use `window.ARTICLES`, which contains only date-reached published articles.
- It is intentionally not added to `sitemap.xml` and is not linked from the public navigation.

Article addition workflow is unchanged: add or update article metadata in `data/articles.js` or `data/sunday-articles.js`, and this page will update automatically.
