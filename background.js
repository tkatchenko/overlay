chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LIVERELOAD_STATUS') {
    const iconPaths = request.status
      ? {
          "16": "icons/icon16-active.png",
          "48": "icons/icon48-active.png",
          "128": "icons/icon128-active.png"
        }
      : {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        };
    
    if (sender.tab) {
      chrome.action.setIcon({
        path: iconPaths,
        tabId: sender.tab.id
      });
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setIcon({
      path: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      },
      tabId: tabId
    });
  }
});
