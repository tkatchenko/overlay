chrome.action.onClicked.addListener((tab) => {
  // Check if the overlay is already active.
  // If it is, content.js will remove it. So, reset the icon.
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('overlay-shadow-host'),
  }, (results) => {
    if (chrome.runtime.lastError) {
      // Ignore errors, e.g. on pages where scripts can't run.
    } else if (results && results[0] && results[0].result) {
      // Overlay is active, will be deactivated. Reset icon.
      chrome.action.setIcon({
        path: {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        },
        tabId: tab.id
      });
    }

    // Inject content.js to toggle the overlay.
    // If it's being activated, it will send a message to set the icon.
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
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
