const SEARCH_PAGE_PATH = "src/search-page/index.html";

function getSearchPageUrl() {
  return chrome.runtime.getURL(SEARCH_PAGE_PATH);
}

async function openSearchPage() {
  const url = getSearchPageUrl();
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(() => {
  openSearchPage().catch((error) => {
    console.error("Failed to open Better History page.", { error });
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "open-search-page") {
    return;
  }

  openSearchPage().catch((error) => {
    console.error("Failed to open Better History page from command.", { error, command });
  });
});
