(function () {
  const script = document.currentScript;
  const publishDate = script?.dataset.publishDate
    || document.querySelector("[data-publish-date]")?.dataset.publishDate;
  if (!publishDate) return;

  const todayJst = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  if (todayJst >= publishDate) {
    document.documentElement.classList.add("published");
    document.querySelector('meta[name="robots"][data-draft-only]')?.remove();
    document.querySelectorAll("[data-draft-notice]").forEach((node) => node.remove());
  } else {
    document.documentElement.classList.add("draft");
  }
}());
