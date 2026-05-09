async function updateCurrentTab(url) {
  const currentTab = await chrome.tabs.getCurrent();

  if (currentTab?.id) {
    return chrome.tabs.update(currentTab.id, { url });
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab?.id) {
    return chrome.tabs.update(activeTab.id, { url });
  }

  return chrome.tabs.create({ url });
}

export async function openHistoryResult(url, options = {}) {
  if (!url) {
    return;
  }

  if (options.openInNewTab) {
    await chrome.tabs.create({ url });
    return;
  }

  await updateCurrentTab(url);
}
