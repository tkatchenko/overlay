const ICONS = {
  active: {
    "16": "icons/icon16-active.png",
    "48": "icons/icon48-active.png",
    "128": "icons/icon128-active.png"
  },
  inactive: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
};

function consumeRuntimeError() {
  void chrome.runtime.lastError;
}

function setActionIcon(tabId, isActive) {
  if (!tabId) return;

  chrome.action.setIcon({
    path: isActive ? ICONS.active : ICONS.inactive,
    tabId
  }, consumeRuntimeError);
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, consumeRuntimeError);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LIVERELOAD_STATUS') {
    if (sender.tab) {
      setActionIcon(sender.tab.id, request.status);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    setActionIcon(tabId, false);
  }
});
