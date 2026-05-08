export async function openHistoryResult(url) {
  if (!url) {
    return;
  }

  await chrome.tabs.create({ url });
}
