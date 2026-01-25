/**
 * Spectyra Browser Extension - Options Page Script
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  spectyraApiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: '',
  providerKey: '',
  optimizationLevel: 2,
  path: 'talk',
};

// Load settings
async function loadSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  const currentSettings = settings || DEFAULT_SETTINGS;
  
  document.getElementById('enabled').checked = currentSettings.enabled;
  document.getElementById('spectyra-api-url').value = currentSettings.spectyraApiUrl || DEFAULT_SETTINGS.spectyraApiUrl;
  document.getElementById('spectyra-key').value = currentSettings.spectyraKey || '';
  document.getElementById('provider-key').value = currentSettings.providerKey || '';
  document.getElementById('path').value = currentSettings.path || 'talk';
  document.getElementById('optimization-level').value = currentSettings.optimizationLevel || 2;
  updateLevelValue();
}

// Update level display
function updateLevelValue() {
  const level = document.getElementById('optimization-level').value;
  const labels = ['Minimal', 'Conservative', 'Balanced', 'Aggressive', 'Maximum'];
  document.getElementById('level-value').textContent = `${level} (${labels[level]})`;
}

// Save settings
async function saveSettings() {
  const settings = {
    enabled: document.getElementById('enabled').checked,
    spectyraApiUrl: document.getElementById('spectyra-api-url').value.trim(),
    spectyraKey: document.getElementById('spectyra-key').value.trim(),
    providerKey: document.getElementById('provider-key').value.trim(),
    optimizationLevel: parseInt(document.getElementById('optimization-level').value, 10),
    path: document.getElementById('path').value,
  };
  
  // Validate
  if (!settings.spectyraApiUrl) {
    showStatus('Please enter Spectyra API URL', 'error');
    return;
  }
  
  if (!settings.spectyraKey) {
    showStatus('Please enter Spectyra API key', 'error');
    return;
  }
  
  if (!settings.providerKey) {
    showStatus('Please enter Provider API key', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set({ settings });
    showStatus('Settings saved successfully!', 'success');
    
    // Notify content scripts to reload settings
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
        }).catch(() => {
          // Ignore errors
        });
      });
    });
  } catch (error) {
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

// Reset to defaults
function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      loadSettings();
      showStatus('Settings reset to defaults', 'success');
    });
  }
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveSettings();
});
document.getElementById('optimization-level').addEventListener('input', updateLevelValue);
document.getElementById('reset-btn').addEventListener('click', resetSettings);
