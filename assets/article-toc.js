(function () {
  var ready = function (callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  };

  var hasClass = function (node, className) {
    return node && node.classList && node.classList.contains(className);
  };

  var slug = function (value, fallback) {
    var normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || fallback;
  };

  ready(function () {
    var wrap = document.querySelector("body > .wrap");
    if (!wrap || wrap.querySelector(".article-shell")) return;

    var children = Array.prototype.slice.call(wrap.children);
    var ahead = null;
    children.forEach(function (node) {
      if (!ahead && hasClass(node, "ahead")) ahead = node;
    });
    if (!ahead) return;

    var contentNodes = [];
    var cursor = ahead.nextElementSibling;
    while (cursor) {
      var next = cursor.nextElementSibling;
      contentNodes.push(cursor);
      cursor = next;
    }

    var items = [];
    var summary = null;
    contentNodes.forEach(function (node) {
      if (!summary && hasClass(node, "summary")) summary = node;
    });
    if (summary) {
      summary.id = summary.id || "summary";
      var summaryLabel = summary.querySelector(".lbl");
      var labelText = summaryLabel ? summaryLabel.textContent.trim() : "30秒サマリー";
      var label = labelText || "30秒サマリー";
      items.push({ id: summary.id, label: label });
    }

    contentNodes.forEach(function (node, index) {
      if (!hasClass(node, "sec")) return;
      var heading = node.querySelector(".sechd h2, h2");
      if (!heading) return;
      if (!node.id) {
        var numberNode = node.querySelector(".sechd .no");
        var number = numberNode ? numberNode.textContent.trim() : "";
        var sectionNumber = index + 1 < 10 ? "0" + String(index + 1) : String(index + 1);
        var fallback = "section-" + sectionNumber;
        node.id = number ? "section-" + slug(number, fallback) : fallback;
      }
      items.push({ id: node.id, label: heading.textContent.trim() });
    });

    if (items.length < 2) return;

    var toc = document.createElement("nav");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", "記事内目次");

    var tocLabel = document.createElement("div");
    tocLabel.className = "label";
    tocLabel.textContent = "ON THIS PAGE";
    toc.appendChild(tocLabel);

    items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = "#" + item.id;
      link.textContent = item.label;
      toc.appendChild(link);
    });

    var content = document.createElement("div");
    content.className = "article-content";
    contentNodes.forEach(function (node) {
      content.appendChild(node);
    });

    var shell = document.createElement("div");
    shell.className = "article-shell";
    shell.appendChild(toc);
    shell.appendChild(content);

    ahead.insertAdjacentElement("afterend", shell);
    document.body.classList.add("article-toc-enabled");
  });
}());
