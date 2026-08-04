(function () {
  var script = document.currentScript;
  if (!script) return;

  var siteKey = script.getAttribute("data-site");
  if (!siteKey) {
    console.warn("[GeoArcher] Missing data-site on geo.js script tag.");
    return;
  }

  var src = script.getAttribute("src") || "";
  var apiOrigin = script.getAttribute("data-api");
  if (!apiOrigin && src) {
    try {
      apiOrigin = new URL(src, window.location.href).origin;
    } catch (e) {
      apiOrigin = "";
    }
  }
  if (!apiOrigin) apiOrigin = window.location.origin;

  var configUrl = apiOrigin + "/api/geo/" + encodeURIComponent(siteKey) + "/config";
  var telemetryUrl =
    apiOrigin + "/api/geo/" + encodeURIComponent(siteKey) + "/telemetry";

  function injectMeta(meta) {
    if (!meta || typeof meta !== "object") return;
    Object.keys(meta).forEach(function (name) {
      var value = meta[name];
      if (!value) return;
      var existing = document.querySelector('meta[name="' + name + '"]');
      if (existing) {
        existing.setAttribute("content", String(value));
        return;
      }
      var el = document.createElement("meta");
      el.setAttribute("name", name);
      el.setAttribute("content", String(value));
      document.head.appendChild(el);
    });
  }

  function injectJsonLd(blocks) {
    if (!Array.isArray(blocks)) return;
    blocks.forEach(function (block) {
      if (!block || typeof block !== "object") return;
      var el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-geoarcher", "1");
      el.text = JSON.stringify(block);
      document.head.appendChild(el);
    });
  }

  fetch(configUrl, { credentials: "omit", mode: "cors" })
    .then(function (r) {
      return r.json();
    })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      injectJsonLd(cfg.jsonLd);
      injectMeta(cfg.meta);
      fetch(telemetryUrl, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: window.location.href }),
      }).catch(function () {});
    })
    .catch(function () {});
})();
