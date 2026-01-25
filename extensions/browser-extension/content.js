/**
 * Spectyra Browser Extension - Content Script
 * 
 * Intercepts fetch requests to LLM providers and routes through Spectyra.
 */

(function() {
  'use strict';

  // Settings cache
  let settings = null;
  let isEnabled = true;

  // Load settings
  async function loadSettings() {
    const result = await chrome.storage.sync.get('settings');
    settings = result.settings || {
      enabled: true,
      spectyraApiUrl: 'https://spectyra.up.railway.app/v1',
      spectyraKey: '',
      providerKey: '',
      optimizationLevel: 2,
      path: 'talk',
    };
    isEnabled = settings.enabled && !!settings.spectyraKey;
    return settings;
  }

  // Initialize
  loadSettings();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      loadSettings();
    }
  });

  // Detect provider from URL
  function detectProvider(url) {
    if (url.includes('api.openai.com')) return 'openai';
    if (url.includes('api.anthropic.com')) return 'anthropic';
    if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
    if (url.includes('api.x.ai')) return 'grok';
    return null;
  }

  // Parse provider request
  function parseProviderRequest(url, body, provider) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      
      if (provider === 'openai') {
        return {
          model: parsed.model,
          messages: parsed.messages || [],
        };
      } else if (provider === 'anthropic') {
        return {
          model: parsed.model,
          messages: parsed.messages || [],
        };
      } else if (provider === 'gemini') {
        // Gemini format may vary
        return {
          model: parsed.model || 'gemini-pro',
          messages: parsed.contents || parsed.messages || [],
        };
      } else if (provider === 'grok') {
        return {
          model: parsed.model,
          messages: parsed.messages || [],
        };
      }
    } catch (e) {
      console.error('[Spectyra] Failed to parse request:', e);
    }
    return null;
  }

  // Convert provider messages to Spectyra format
  function convertMessages(providerMessages, provider) {
    if (provider === 'gemini') {
      // Gemini uses different format
      return providerMessages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: typeof m.parts === 'object' ? m.parts[0]?.text || '' : m.content || '',
      }));
    }
    
    return providerMessages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text || '',
    }));
  }

  // Call Spectyra API
  async function callSpectyra(provider, model, messages) {
    if (!settings || !isEnabled) {
      return null;
    }

    try {
      const response = await fetch(`${settings.spectyraApiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SPECTYRA-KEY': settings.spectyraKey,
          'X-PROVIDER-KEY': settings.providerKey,
        },
        body: JSON.stringify({
          path: settings.path || 'talk',
          provider,
          model,
          messages,
          mode: 'optimized',
          optimization_level: settings.optimizationLevel || 2,
        }),
      });

      if (!response.ok) {
        throw new Error(`Spectyra API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Spectyra] API call failed:', error);
      return null;
    }
  }

  // Transform Spectyra response to provider format
  function transformToProviderResponse(spectyraResponse, provider, originalRequest) {
    if (provider === 'openai' || provider === 'grok') {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: originalRequest.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: spectyraResponse.response_text || '',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: spectyraResponse.usage?.input_tokens || 0,
          completion_tokens: spectyraResponse.usage?.output_tokens || 0,
          total_tokens: spectyraResponse.usage?.total_tokens || 0,
        },
      };
    } else if (provider === 'anthropic') {
      return {
        id: `msg-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: spectyraResponse.response_text || '',
        }],
        model: originalRequest.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: spectyraResponse.usage?.input_tokens || 0,
          output_tokens: spectyraResponse.usage?.output_tokens || 0,
        },
      };
    } else if (provider === 'gemini') {
      return {
        candidates: [{
          content: {
            parts: [{
              text: spectyraResponse.response_text || '',
            }],
            role: 'model',
          },
          finishReason: 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: spectyraResponse.usage?.input_tokens || 0,
          candidatesTokenCount: spectyraResponse.usage?.output_tokens || 0,
          totalTokenCount: spectyraResponse.usage?.total_tokens || 0,
        },
      };
    }
    
    return spectyraResponse;
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    const urlString = typeof url === 'string' ? url : url.url || url.toString();
    
    // Check if this is an LLM provider request
    const provider = detectProvider(urlString);
    
    if (!provider || !isEnabled || !settings) {
      return originalFetch.apply(this, args);
    }

    // Only intercept POST requests (chat completions)
    if (options.method !== 'POST') {
      return originalFetch.apply(this, args);
    }

    try {
      // Parse request
      const body = options.body;
      const parsedRequest = parseProviderRequest(urlString, body, provider);
      
      if (!parsedRequest || !parsedRequest.messages || parsedRequest.messages.length === 0) {
        // Not a chat request, pass through
        return originalFetch.apply(this, args);
      }

      // Convert messages
      const messages = convertMessages(parsedRequest.messages, provider);
      
      // Call Spectyra
      const spectyraResponse = await callSpectyra(provider, parsedRequest.model, messages);
      
      if (!spectyraResponse) {
        // Spectyra failed, fallback to original request
        console.warn('[Spectyra] Falling back to original provider');
        return originalFetch.apply(this, args);
      }

      // Transform response
      const providerResponse = transformToProviderResponse(spectyraResponse, provider, parsedRequest);
      
      // Calculate savings (if available)
      if (spectyraResponse.savings) {
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'SAVINGS_UPDATE',
          tokensSaved: spectyraResponse.savings.tokens_saved || 0,
          costSavedUsd: spectyraResponse.savings.cost_saved_usd || 0,
        });

        // Show widget
        showSavingsWidget(spectyraResponse.savings);
      }

      // Return provider-shaped response
      return new Response(JSON.stringify(providerResponse), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('[Spectyra] Interception error:', error);
      // Fallback to original request
      return originalFetch.apply(this, args);
    }
  };

  // Show savings widget
  function showSavingsWidget(savings) {
    // Create or update widget
    let widget = document.getElementById('spectyra-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'spectyra-widget';
      widget.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007bff;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(widget);
    }

    widget.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">💰 Spectyra Savings</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Saved ${savings.pct_saved?.toFixed(1) || 0}% tokens
        <br>
        $${(savings.cost_saved_usd || 0).toFixed(4)} saved
      </div>
    `;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (widget) {
        widget.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => widget?.remove(), 300);
      }
    }, 5000);
  }

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Listen for session savings updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SESSION_SAVINGS_UPDATE') {
      // Could update a persistent widget if needed
    }
  });
})();
