/**
 * Spectyra Browser Extension - Options Page Script
 * 
 * Handles settings page UI and validation
 * 
 * @version 1.0.0
 * @author Spectyra Team
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  spectyraApiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: '',
  providerKey: '',
  optimizationLevel: 2,
  path: 'talk',
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate API key format (basic check)
 * @param {string} key - API key to validate
 * @returns {boolean} True if appears valid
 */
function isValidApiKey(key) {
  return key && key.trim().length >= 10; // Basic length check
}

/**
 * Load settings from storage and populate form
 */
async function loadSettings() {
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    const currentSettings = settings || DEFAULT_SETTINGS;
    
    document.getElementById('enabled').checked = Boolean(currentSettings.enabled);
    document.getElementById('spectyra-api-url').value = currentSettings.spectyraApiUrl || DEFAULT_SETTINGS.spectyraApiUrl;
    document.getElementById('spectyra-key').value = currentSettings.spectyraKey || '';
    document.getElementById('provider-key').value = currentSettings.providerKey || '';
    document.getElementById('path').value = currentSettings.path === 'code' ? 'code' : 'talk';
    
    const level = Math.max(0, Math.min(4, currentSettings.optimizationLevel || 2));
    document.getElementById('optimization-level').value = level;
    updateLevelValue();
  } catch (error) {
    console.error('[Spectyra Options] Failed to load settings:', error);
    showStatus('Failed to load settings: ' + error.message, 'error');
  }
}

/**
 * Update optimization level display
 */
function updateLevelValue() {
  const level = parseInt(document.getElementById('optimization-level').value, 10);
  const labels = ['Minimal', 'Conservative', 'Balanced', 'Aggressive', 'Maximum'];
  const descriptions = [
    'No compaction, minimal optimization',
    'Light compaction, conservative savings',
    'Moderate optimization (recommended)',
    'Heavy compaction, aggressive savings',
    'Maximum optimization, highest savings',
  ];
  
  const levelValueEl = document.getElementById('level-value');
  levelValueEl.textContent = `${level} - ${labels[level]}`;
  
  // Update description if element exists
  const descEl = document.getElementById('level-description');
  if (descEl) {
    descEl.textContent = descriptions[level];
  }
}

/**
 * Validate and save settings
 */
async function saveSettings() {
  try {
    const spectyraApiUrl = document.getElementById('spectyra-api-url').value.trim();
    const spectyraKey = document.getElementById('spectyra-key').value.trim();
    const providerKey = document.getElementById('provider-key').value.trim();
    const optimizationLevel = parseInt(document.getElementById('optimization-level').value, 10);
    const path = document.getElementById('path').value;
    const enabled = document.getElementById('enabled').checked;
    
    // Validate URL
    if (!spectyraApiUrl) {
      showStatus('Please enter Spectyra API URL', 'error');
      document.getElementById('spectyra-api-url').focus();
      return;
    }
    
    if (!isValidUrl(spectyraApiUrl)) {
      showStatus('Please enter a valid URL (must start with http:// or https://)', 'error');
      document.getElementById('spectyra-api-url').focus();
      return;
    }
    
    // Validate API keys
    if (!spectyraKey) {
      showStatus('Please enter Spectyra API key', 'error');
      document.getElementById('spectyra-key').focus();
      return;
    }
    
    if (!isValidApiKey(spectyraKey)) {
      showStatus('Spectyra API key appears invalid (too short)', 'error');
      document.getElementById('spectyra-key').focus();
      return;
    }
    
    if (!providerKey) {
      showStatus('Please enter Provider API key', 'error');
      document.getElementById('provider-key').focus();
      return;
    }
    
    if (!isValidApiKey(providerKey)) {
      showStatus('Provider API key appears invalid (too short)', 'error');
      document.getElementById('provider-key').focus();
      return;
    }
    
    // Validate optimization level
    if (isNaN(optimizationLevel) || optimizationLevel < 0 || optimizationLevel > 4) {
      showStatus('Invalid optimization level', 'error');
      return;
    }
    
    // Validate path
    if (path !== 'talk' && path !== 'code') {
      showStatus('Invalid path selection', 'error');
      return;
    }
    
    // Sanitize URL (remove trailing slashes)
    const sanitizedUrl = spectyraApiUrl.replace(/\/+$/, '');
    
    const settings = {
      enabled: enabled,
      spectyraApiUrl: sanitizedUrl,
      spectyraKey: spectyraKey,
      providerKey: providerKey,
      optimizationLevel: optimizationLevel,
      path: path,
    };
    
    await chrome.storage.sync.set({ settings });
    showStatus('Settings saved successfully!', 'success');
    
    // Notify content scripts to reload settings
    try {
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
          }).catch(() => {
            // Ignore errors (tab might not have content script)
          });
        }
      });
    } catch (error) {
      console.warn('[Spectyra Options] Failed to notify tabs:', error);
    }
  } catch (error) {
    console.error('[Spectyra Options] Failed to save settings:', error);
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
  if (confirm('Reset all settings to defaults? This will clear your API keys.')) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Failed to reset settings: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      loadSettings();
      showStatus('Settings reset to defaults', 'success');
    });
  }
}

/**
 * Show status message to user
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusEl.className = 'status';
    statusEl.style.display = 'none';
  }, 5000);
  
  // Scroll to status if needed
  statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettings();
    });
  }
  
  const levelSlider = document.getElementById('optimization-level');
  if (levelSlider) {
    levelSlider.addEventListener('input', updateLevelValue);
  }
  
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetSettings);
  }
  
  // Add real-time validation
  const spectyraUrlInput = document.getElementById('spectyra-api-url');
  if (spectyraUrlInput) {
    spectyraUrlInput.addEventListener('blur', () => {
      const url = spectyraUrlInput.value.trim();
      if (url && !isValidUrl(url)) {
        spectyraUrlInput.style.borderColor = '#dc3545';
      } else {
        spectyraUrlInput.style.borderColor = '';
      }
    });
  }
  
  const spectyraKeyInput = document.getElementById('spectyra-key');
  if (spectyraKeyInput) {
    spectyraKeyInput.addEventListener('blur', () => {
      const key = spectyraKeyInput.value.trim();
      if (key && !isValidApiKey(key)) {
        spectyraKeyInput.style.borderColor = '#dc3545';
      } else {
        spectyraKeyInput.style.borderColor = '';
      }
    });
  }
  
  const providerKeyInput = document.getElementById('provider-key');
  if (providerKeyInput) {
    providerKeyInput.addEventListener('blur', () => {
      const key = providerKeyInput.value.trim();
      if (key && !isValidApiKey(key)) {
        providerKeyInput.style.borderColor = '#dc3545';
      } else {
        providerKeyInput.style.borderColor = '';
      }
    });
  }
});
