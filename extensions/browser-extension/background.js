/**
 * Spectyra Browser Extension - Background Service Worker
 * 
 * Handles:
 * - Settings storage and validation
 * - Session savings tracking
 * - Communication with content scripts
 * 
 * @version 1.0.0
 * @author Spectyra Team
 */

// Configuration
const CONFIG = {
  DEBUG: true, // Set to true for development - TODO: Set to false for production
  LOG_PREFIX: '[Spectyra Background]',
};

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

/**
 * Logging utility
 * @param {string} level - 'log', 'warn', 'error'
 * @param {...any} args - Arguments to log
 */
function log(level, ...args) {
  if (level === 'log' && !CONFIG.DEBUG) return;
  const method = console[level] || console.log;
  method(CONFIG.LOG_PREFIX, ...args);
}

/**
 * Validate and sanitize settings
 * @param {Object} settings - Settings object to validate
 * @returns {Object} Validated settings
 */
function validateSettings(settings) {
  const validated = { ...DEFAULT_SETTINGS, ...settings };
  
  // Validate and sanitize
  if (validated.spectyraApiUrl) {
    validated.spectyraApiUrl = validated.spectyraApiUrl.trim().replace(/\/+$/, '');
    if (!validated.spectyraApiUrl.startsWith('http://') && !validated.spectyraApiUrl.startsWith('https://')) {
      validated.spectyraApiUrl = DEFAULT_SETTINGS.spectyraApiUrl;
    }
  }
  
  if (validated.spectyraKey) {
    validated.spectyraKey = validated.spectyraKey.trim();
  }
  
  if (validated.providerKey) {
    validated.providerKey = validated.providerKey.trim();
  }
  
  if (typeof validated.optimizationLevel !== 'number' || validated.optimizationLevel < 0 || validated.optimizationLevel > 4) {
    validated.optimizationLevel = DEFAULT_SETTINGS.optimizationLevel;
  }
  
  if (validated.path !== 'talk' && validated.path !== 'code') {
    validated.path = DEFAULT_SETTINGS.path;
  }
  
  validated.enabled = Boolean(validated.enabled);
  
  return validated;
}

/**
 * Safely update session savings with validation
 * @param {number} tokensSaved - Tokens saved (must be >= 0)
 * @param {number} costSavedUsd - Cost saved in USD (must be >= 0)
 */
function updateSessionSavings(tokensSaved, costSavedUsd) {
  const tokens = Math.max(0, Number(tokensSaved) || 0);
  const cost = Math.max(0, Number(costSavedUsd) || 0);
  
  sessionSavings.tokensSaved += tokens;
  sessionSavings.costSavedUsd += cost;
  sessionSavings.callsOptimized += 1;
  
  // Prevent overflow
  if (sessionSavings.tokensSaved > Number.MAX_SAFE_INTEGER) {
    sessionSavings.tokensSaved = Number.MAX_SAFE_INTEGER;
  }
  if (sessionSavings.costSavedUsd > Number.MAX_SAFE_INTEGER) {
    sessionSavings.costSavedUsd = Number.MAX_SAFE_INTEGER;
  }
  
  // Store in local storage
  chrome.storage.local.set({ sessionSavings }).catch((error) => {
    log('error', 'Failed to save session savings:', error);
  });
  
  log('log', 'Session savings updated:', {
    tokensSaved: sessionSavings.tokensSaved,
    costSavedUsd: sessionSavings.costSavedUsd,
    callsOptimized: sessionSavings.callsOptimized,
  });
}

// Initialize storage
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    log('log', 'Extension installed/updated:', details.reason);
    
    const result = await chrome.storage.sync.get('settings');
    if (!result.settings) {
      await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
      log('log', 'Default settings initialized');
    } else {
      // Validate existing settings
      const validated = validateSettings(result.settings);
      if (JSON.stringify(validated) !== JSON.stringify(result.settings)) {
        await chrome.storage.sync.set({ settings: validated });
        log('log', 'Settings validated and updated');
      }
    }
    
    // Reset session on install (not on update)
    if (details.reason === 'install') {
      sessionSavings = {
        tokensSaved: 0,
        costSavedUsd: 0,
        callsOptimized: 0,
        startTime: Date.now(),
      };
      await chrome.storage.local.set({ sessionSavings });
      log('log', 'Session savings reset on install');
    }
  } catch (error) {
    log('error', 'Failed to initialize storage:', error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate message
  if (!message || typeof message !== 'object' || !message.type) {
    log('warn', 'Invalid message received:', message);
    sendResponse({ success: false, error: 'Invalid message' });
    return false;
  }

  try {
    if (message.type === 'SAVINGS_UPDATE') {
      // Validate and update session savings
      const tokensSaved = Math.max(0, Number(message.tokensSaved) || 0);
      const costSavedUsd = Math.max(0, Number(message.costSavedUsd) || 0);
      
      updateSessionSavings(tokensSaved, costSavedUsd);
      
      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          log('error', 'Failed to query tabs:', chrome.runtime.lastError);
          return;
        }
        
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SESSION_SAVINGS_UPDATE',
              savings: sessionSavings,
            }).catch((error) => {
              // Ignore errors (tab might not have content script)
              if (CONFIG.DEBUG) {
                log('log', 'Failed to send message to tab', tab.id, ':', error);
              }
            });
          }
        });
      });
      
      sendResponse({ success: true });
      return true; // Keep channel open for async response
      
    } else if (message.type === 'GET_SESSION_SAVINGS') {
      sendResponse({ savings: sessionSavings });
      return false; // Synchronous response
      
    } else if (message.type === 'RESET_SESSION') {
      sessionSavings = {
        tokensSaved: 0,
        costSavedUsd: 0,
        callsOptimized: 0,
        startTime: Date.now(),
      };
      
      chrome.storage.local.set({ sessionSavings }).then(() => {
        log('log', 'Session savings reset');
        sendResponse({ success: true });
      }).catch((error) => {
        log('error', 'Failed to reset session savings:', error);
        sendResponse({ success: false, error: error.message });
      });
      
      return true; // Keep channel open for async response
    } else {
      log('warn', 'Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
    }
  } catch (error) {
    log('error', 'Error handling message:', error, message);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// Load session savings on startup
chrome.storage.local.get('sessionSavings', (result) => {
  if (chrome.runtime.lastError) {
    log('error', 'Failed to load session savings:', chrome.runtime.lastError);
    return;
  }
  
  if (result.sessionSavings) {
    // Validate loaded savings
    const savings = result.sessionSavings;
    sessionSavings = {
      tokensSaved: Math.max(0, Number(savings.tokensSaved) || 0),
      costSavedUsd: Math.max(0, Number(savings.costSavedUsd) || 0),
      callsOptimized: Math.max(0, Number(savings.callsOptimized) || 0),
      startTime: Number(savings.startTime) || Date.now(),
    };
    log('log', 'Session savings loaded:', sessionSavings);
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  log('log', 'Extension startup');
  // Session savings persist across restarts, no need to reset
});
