(function () {
  "use strict";

  var config = window.ANES_JC_ANALYTICS || {};
  var measurementId = String(config.ga4MeasurementId || "").trim();
  var enabled = /^G-[A-Z0-9]+$/.test(measurementId);

  function loadGa4(id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id, {
      send_page_view: true
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function safeText(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 120);
  }

  function linkCategory(url) {
    var host = url.hostname.replace(/^www\./, "");
    if (host === "doi.org") return "doi";
    if (host === "pubmed.ncbi.nlm.nih.gov") return "pubmed";
    if (host === "pmc.ncbi.nlm.nih.gov" || host === "europepmc.org") return "pmc";
    if (host === "x.com" || host === "twitter.com") return "x";
    return url.origin === window.location.origin ? "internal" : "external";
  }

  function sendEvent(name, params) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, Object.assign({
      page_path: window.location.pathname,
      transport_type: "beacon"
    }, params || {}));
  }

  function trackClick(target) {
    var href = target.getAttribute("href") || target.getAttribute("data-href");
    if (!href) return;

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (_) {
      return;
    }

    var category = linkCategory(url);
    var isArticle = url.origin === window.location.origin && /\/articles\/.+\.html$/.test(url.pathname);
    var eventName = isArticle ? "article_click" : (category === "internal" ? "internal_link_click" : "outbound_link_click");

    sendEvent(eventName, {
      link_url: url.href.slice(0, 500),
      link_domain: url.hostname,
      link_category: category,
      link_text: safeText(target.textContent || target.getAttribute("aria-label") || target.getAttribute("title"), 120)
    });
  }

  if (enabled) {
    loadGa4(measurementId);
  }

  window.anesJcTrack = sendEvent;

  if (config.enableClickEvents !== false) {
    document.addEventListener("click", function (event) {
      if (!event.target || typeof event.target.closest !== "function") return;
      var target = event.target.closest("a[href]") || event.target.closest("[data-href]");
      if (target) trackClick(target);
    }, true);
  }
}());
