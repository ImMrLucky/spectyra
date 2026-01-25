/**
 * Spectyra Browser Extension - Background Service Worker
 * 
 * Handles:
 * - Settings storage
 * - Session savings tracking
 * - Communication with content scripts
 */

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  spectyraApiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: '',
  providerKey: '',
  optimizationLevel: 2,
  path: 'talk', // 'talk' or 'code'
};

// Session savings tracking
let sessionSavings = {
  tokensSaved: 0,
  costSavedUsd: 0,
  callsOptimized: 0,
  startTime: Date.now(),
};

// Initialize storage
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get('settings');
  if (!settings.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
  
  // Reset session on install
  await chrome.storage.local.set({ sessionSavings });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVINGS_UPDATE') {
    // Update session savings
    sessionSavings.tokensSaved += message.tokensSaved || 0;
    sessionSavings.costSavedUsd += message.costSavedUsd || 0;
    sessionSavings.callsOptimized += 1;
    
    // Store in local storage
    chrome.storage.local.set({ sessionSavings });
    
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SESSION_SAVINGS_UPDATE',
          savings: sessionSavings,
        }).catch(() => {
          // Ignore errors (tab might not have content script)
        });
      });
    });
    
    sendResponse({ success: true });
  } else if (message.type === 'GET_SESSION_SAVINGS') {
    sendResponse({ savings: sessionSavings });
  } else if (message.type === 'RESET_SESSION') {
    sessionSavings = {
      tokensSaved: 0,
      costSavedUsd: 0,
      callsOptimized: 0,
      startTime: Date.now(),
    };
    chrome.storage.local.set({ sessionSavings });
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async response
});

// Load session savings on startup
chrome.storage.local.get('sessionSavings', (result) => {
  if (result.sessionSavings) {
    sessionSavings = result.sessionSavings;
  }
});
