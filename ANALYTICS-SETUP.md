# Analytics setup

The site is prepared for Google Analytics 4 and Google Search Console.

## Current state

- `assets/analytics-config.js` exists, but `ga4MeasurementId` is empty.
- `assets/analytics.js` is loaded on the home page, list pages, article pages, and future Sunday auto-generated pages.
- No analytics data is sent until `ga4MeasurementId` is set to a real `G-...` value.

## GA4 enablement

1. Create a Google Analytics 4 property.
2. Create a Web data stream for `https://anes-jc.github.io/`.
3. Copy the Measurement ID, for example `G-XXXXXXXXXX`.
4. Replace the empty value in `assets/analytics-config.js`.

```js
window.ANES_JC_ANALYTICS = {
  ga4MeasurementId: "G-XXXXXXXXXX",
  enableClickEvents: true
};
```

The shared script sends normal GA4 page views and these custom click events:

- `article_click`: internal article links.
- `internal_link_click`: other internal links.
- `outbound_link_click`: external links, including DOI, PubMed, Europe PMC, and X.

GA4's enhanced measurement can also be enabled in the GA4 data stream settings for automatic scroll and outbound-click reports.

## Search Console enablement

1. Add a URL-prefix property for `https://anes-jc.github.io/`.
2. Use one of Google's verification methods.
3. Recommended for this GitHub Pages site: HTML file verification or HTML meta tag verification.

If Google provides an HTML verification file, place it at the repository root and publish it.
If Google provides a meta tag, add it inside the `<head>` of `index.html`.

## After setup

- Confirm GA4 Realtime shows your own visit.
- Confirm Search Console verification passes.
- Wait for Search Console performance data; it is not immediate.
