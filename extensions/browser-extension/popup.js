/**
 * Spectyra Browser Extension - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const { settings } = await chrome.storage.sync.get('settings');
  const isEnabled = settings?.enabled && !!settings?.spectyraKey;
  
  // Update status
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  
  if (isEnabled) {
    statusEl.className = 'status enabled';
    statusText.textContent = 'Active';
  } else {
    statusEl.className = 'status disabled';
    statusText.textContent = settings?.spectyraKey ? 'Disabled' : 'Not Configured';
  }
  
  // Load session savings
  const { sessionSavings } = await chrome.storage.local.get('sessionSavings');
  const savings = sessionSavings || {
    tokensSaved: 0,
    costSavedUsd: 0,
    callsOptimized: 0,
  };
  
  document.getElementById('calls-count').textContent = savings.callsOptimized || 0;
  document.getElementById('tokens-saved').textContent = (savings.tokensSaved || 0).toLocaleString();
  document.getElementById('cost-saved').textContent = `$${(savings.costSavedUsd || 0).toFixed(4)}`;
  
  // Listen for updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SESSION_SAVINGS_UPDATE') {
      document.getElementById('calls-count').textContent = message.savings.callsOptimized || 0;
      document.getElementById('tokens-saved').textContent = (message.savings.tokensSaved || 0).toLocaleString();
      document.getElementById('cost-saved').textContent = `$${(message.savings.costSavedUsd || 0).toFixed(4)}`;
    }
  });
  
  // Buttons
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('reset-session').addEventListener('click', async () => {
    if (confirm('Reset session savings?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
      document.getElementById('calls-count').textContent = '0';
      document.getElementById('tokens-saved').textContent = '0';
      document.getElementById('cost-saved').textContent = '$0.00';
    }
  });
});
