/**
 * Spectyra Browser Extension - Popup Script
 * 
 * Handles popup UI and displays session statistics
 * 
 * @version 1.0.0
 * @author Spectyra Team
 */

/**
 * Format number with locale-specific formatting
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return (num || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format currency with locale-specific formatting
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(4)}`;
}

/**
 * Update UI with session savings
 * @param {Object} savings - Savings object
 */
function updateSavingsDisplay(savings) {
  const callsEl = document.getElementById('calls-count');
  const tokensEl = document.getElementById('tokens-saved');
  const costEl = document.getElementById('cost-saved');
  
  if (callsEl) {
    callsEl.textContent = formatNumber(savings.callsOptimized || 0);
  }
  if (tokensEl) {
    tokensEl.textContent = formatNumber(savings.tokensSaved || 0);
  }
  if (costEl) {
    costEl.textContent = formatCurrency(savings.costSavedUsd || 0);
  }
}

/**
 * Update status display
 * @param {boolean} isEnabled - Whether extension is enabled
 * @param {boolean} hasKey - Whether API key is configured
 */
function updateStatus(isEnabled, hasKey) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  
  if (!statusEl || !statusText) return;
  
  if (isEnabled && hasKey) {
    statusEl.className = 'status enabled';
    statusText.textContent = 'Active';
  } else if (hasKey) {
    statusEl.className = 'status disabled';
    statusText.textContent = 'Disabled';
  } else {
    statusEl.className = 'status disabled';
    statusText.textContent = 'Not Configured';
  }
}

/**
 * Initialize popup
 */
async function initializePopup() {
  try {
    // Load settings
    const { settings } = await chrome.storage.sync.get('settings');
    const isEnabled = settings?.enabled && !!settings?.spectyraKey && !!settings?.providerKey;
    const hasKey = !!settings?.spectyraKey && !!settings?.providerKey;
    
    // Update status
    updateStatus(isEnabled, hasKey);
    
    // Load session savings
    const { sessionSavings } = await chrome.storage.local.get('sessionSavings');
    const savings = sessionSavings || {
      tokensSaved: 0,
      costSavedUsd: 0,
      callsOptimized: 0,
    };
    
    // Validate and sanitize savings
    const validatedSavings = {
      tokensSaved: Math.max(0, Number(savings.tokensSaved) || 0),
      costSavedUsd: Math.max(0, Number(savings.costSavedUsd) || 0),
      callsOptimized: Math.max(0, Number(savings.callsOptimized) || 0),
    };
    
    updateSavingsDisplay(validatedSavings);
    
    // Listen for updates
    const messageListener = (message) => {
      if (message && message.type === 'SESSION_SAVINGS_UPDATE' && message.savings) {
        const validated = {
          tokensSaved: Math.max(0, Number(message.savings.tokensSaved) || 0),
          costSavedUsd: Math.max(0, Number(message.savings.costSavedUsd) || 0),
          callsOptimized: Math.max(0, Number(message.savings.callsOptimized) || 0),
        };
        updateSavingsDisplay(validated);
        console.log('[Spectyra Popup] Savings updated:', validated);
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Also poll for updates periodically (in case message listener fails)
    const pollInterval = setInterval(async () => {
      try {
        const { sessionSavings } = await chrome.storage.local.get('sessionSavings');
        if (sessionSavings) {
          const validated = {
            tokensSaved: Math.max(0, Number(sessionSavings.tokensSaved) || 0),
            costSavedUsd: Math.max(0, Number(sessionSavings.costSavedUsd) || 0),
            callsOptimized: Math.max(0, Number(sessionSavings.callsOptimized) || 0),
          };
          updateSavingsDisplay(validated);
        }
      } catch (error) {
        console.error('[Spectyra Popup] Poll error:', error);
      }
    }, 2000); // Poll every 2 seconds
    
    // Clean up on unload
    window.addEventListener('beforeunload', () => {
      clearInterval(pollInterval);
      chrome.runtime.onMessage.removeListener(messageListener);
    });
    
    // Button handlers
    const openOptionsBtn = document.getElementById('open-options');
    if (openOptionsBtn) {
      openOptionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage().catch((error) => {
          console.error('[Spectyra Popup] Failed to open options:', error);
        });
      });
    }
    
    const resetBtn = document.getElementById('reset-session');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm('Reset session savings? This action cannot be undone.')) {
          try {
            await chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
            updateSavingsDisplay({
              tokensSaved: 0,
              costSavedUsd: 0,
              callsOptimized: 0,
            });
          } catch (error) {
            console.error('[Spectyra Popup] Failed to reset session:', error);
            alert('Failed to reset session savings. Please try again.');
          }
        }
      });
    }
  } catch (error) {
    console.error('[Spectyra Popup] Failed to initialize:', error);
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = 'Error Loading';
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}
