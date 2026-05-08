const ICON_BACKGROUNDS = ["#1d4ed8", "#7c3aed", "#0f766e", "#b45309", "#be123c"];
const faviconCache = new Map();
const failedFaviconCache = new Set();

function pickBackground(seedText) {
  const seed = Array.from(seedText).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return ICON_BACKGROUNDS[seed % ICON_BACKGROUNDS.length];
}

function buildFallbackSvg(label) {
  const initial = (label || "?").slice(0, 1).toUpperCase();
  const background = pickBackground(label || "fallback");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="4" fill="${background}" />
      <text x="8" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#ffffff">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildFallbackIconUrl(item) {
  const label = item.hostname || item.title || "?";
  return buildFallbackSvg(label);
}

function buildFaviconCacheKey(item) {
  return `${item.url || ""}::${getFaviconRequestSize()}`;
}

function getFaviconRequestSize() {
  const pixelRatio =
    typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
      ? window.devicePixelRatio
      : 1;

  return Math.min(32, Math.max(16, Math.round(16 * pixelRatio)));
}

export function buildFaviconUrl(item) {
  const cacheKey = buildFaviconCacheKey(item);

  if (!cacheKey || failedFaviconCache.has(cacheKey)) {
    return "";
  }

  const cachedIconUrl = faviconCache.get(cacheKey);
  if (cachedIconUrl) {
    return cachedIconUrl;
  }

  const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
  faviconUrl.searchParams.set("pageUrl", item.url);
  faviconUrl.searchParams.set("size", String(getFaviconRequestSize()));

  const faviconUrlString = faviconUrl.toString();
  faviconCache.set(cacheKey, faviconUrlString);
  return faviconUrlString;
}

export function markFaviconFailed(item) {
  const cacheKey = buildFaviconCacheKey(item);

  if (!cacheKey) {
    return;
  }

  failedFaviconCache.add(cacheKey);
  faviconCache.delete(cacheKey);
}
