export function formatDisplayUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const pathname = parsedUrl.pathname === "/" ? "" : parsedUrl.pathname;
    return `${parsedUrl.hostname}${pathname}${parsedUrl.search}`;
  } catch {
    return rawUrl;
  }
}

export function formatVisitMetadata(item) {
  const visitText = `访问 ${item.visitCount ?? 0} 次`;

  if (!item.lastVisitTime) {
    return visitText;
  }

  const visitTime = new Date(item.lastVisitTime).toLocaleString("zh-CN", {
    hour12: false
  });

  return `${visitTime} · ${visitText}`;
}
