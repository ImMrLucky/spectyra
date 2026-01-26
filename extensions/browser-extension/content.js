/**
 * Spectyra Browser Extension - Content Script
 * 
 * Intercepts fetch requests to LLM providers and routes through Spectyra.
 * Production-ready with comprehensive error handling, validation, and security.
 * 
 * @version 1.0.0
 * @author Spectyra Team
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_TIMEOUT_MS: 30000, // 30 seconds
    MAX_RETRIES: 2,
    RETRY_DELAY_MS: 1000,
    WIDGET_DISPLAY_DURATION_MS: 5000,
    LOG_PREFIX: '[Spectyra]',
    DEBUG: false, // Set to false for production (stealth mode) - true for debugging
  };

  // CRITICAL: Inject script into page context to intercept fetch
  // Content scripts run in isolated world, so we need to inject into page context
  // Must use external script file to avoid CSP violations (ChatGPT blocks inline scripts)
  function injectPageScript() {
    if (window.__spectyraInjected) {
      log('log', 'Page script already injected');
      return;
    }
    
    try {
      const script = document.createElement('script');
      // Use chrome.runtime.getURL to get the extension URL for the inject script
      // This avoids CSP violations since it's an external file
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = function() {
        log('log', 'inject.js script element loaded');
        // Don't remove immediately - let it execute first
        setTimeout(() => {
          this.remove();
          log('log', 'Page script should be injected now');
          
          // Set stealth/debug mode before injection completes
          // Inject script will check these before logging
          try {
            // Set debug mode based on CONFIG.DEBUG
            window.__spectyraDebug = CONFIG.DEBUG;
            // Stealth mode is default (can be disabled if needed)
            window.__spectyraStealth = true;
          } catch (e) {
            // If we can't set these, that's okay
          }
          
          // Try to verify by sending a test message (use stealth type if not debug)
          const pingType = CONFIG.DEBUG ? 'SPECTYRA_PING' : '__sp_png';
          window.postMessage({
            type: pingType,
            timestamp: Date.now()
          }, '*');
        }, 100);
      };
      script.onerror = function() {
        log('error', 'Failed to load inject.js file. Make sure it exists and is in web_accessible_resources.');
        this.remove();
      };
      
      (document.head || document.documentElement).appendChild(script);
      log('log', 'Attempting to inject page script from inject.js');
    } catch (error) {
      log('error', 'Failed to inject page script:', error);
    }
  }

  // Inject immediately if DOM is ready, otherwise wait
  if (document.head || document.documentElement) {
    injectPageScript();
  } else {
    const observer = new MutationObserver(() => {
      if (document.head || document.documentElement) {
        injectPageScript();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  // Settings cache
  let settings = null;
  let isEnabled = true;

  /**
   * Logging utility with debug mode support
   * @param {string} level - 'log', 'warn', 'error'
   * @param {...any} args - Arguments to log
   */
  function log(level, ...args) {
    try {
      if (level === 'log' && !CONFIG.DEBUG) return;
      const method = console[level] || console.log;
      if (method && typeof method === 'function') {
        method(CONFIG.LOG_PREFIX, ...args);
      } else {
        console.log(CONFIG.LOG_PREFIX, ...args);
      }
    } catch (error) {
      // Fallback if logging fails
      console.error('[Spectyra] Logging error:', error);
    }
  }

  /**
   * Load settings from chrome.storage.sync
   * @returns {Promise<Object>} Settings object
   */
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      const defaultSettings = {
        enabled: true,
        spectyraApiUrl: 'https://spectyra.up.railway.app/v1',
        spectyraKey: '',
        providerKey: '',
        optimizationLevel: 2,
        path: 'talk',
      };
      
      settings = result.settings || defaultSettings;
      
      // Validate and sanitize settings
      if (settings.spectyraApiUrl) {
        settings.spectyraApiUrl = settings.spectyraApiUrl.trim().replace(/\/+$/, '');
      }
      if (settings.spectyraKey) {
        settings.spectyraKey = settings.spectyraKey.trim();
      }
      if (settings.providerKey) {
        settings.providerKey = settings.providerKey.trim();
      }
      if (typeof settings.optimizationLevel !== 'number' || settings.optimizationLevel < 0 || settings.optimizationLevel > 4) {
        settings.optimizationLevel = 2;
      }
      if (settings.path !== 'talk' && settings.path !== 'code') {
        settings.path = 'talk';
      }
      
      isEnabled = settings.enabled && !!settings.spectyraKey && !!settings.providerKey;
      return settings;
    } catch (error) {
      log('error', 'Failed to load settings:', error);
      return null;
    }
  }

  // Initialize - wait for settings before intercepting
  let settingsReady = false;
  
  // Listen for messages from page script
  window.addEventListener('message', async (event) => {
    // Only process messages from same window
    if (event.source !== window) return;
    
    if (!event.data) return;
    
    // Handle ready/pong messages for verification (support both stealth and debug modes)
    const readyTypes = ['SPECTYRA_READY', '__sp_rdy'];
    const pongTypes = ['SPECTYRA_PONG', '__sp_png_r'];
    if (readyTypes.includes(event.data.type) || pongTypes.includes(event.data.type)) {
      log('log', 'Page script is active and communicating:', event.data);
      return;
    }
    
    // Handle intercept requests (support both stealth and debug modes)
    const interceptTypes = ['SPECTYRA_INTERCEPT', '__sp_int'];
    if (!interceptTypes.includes(event.data.type)) {
      return;
    }
    
    log('log', 'Received intercept request from page script:', {
      requestId: event.data.requestId,
      url: event.data.url,
      method: event.data.method,
      hasBody: !!event.data.body,
      bodyType: typeof event.data.body
    });
    
    console.log('%c[Spectyra] 🎯 INTERCEPTION TRIGGERED!', 'color: #10a37f; font-weight: bold; font-size: 16px;');
    
    // Wait for settings
    if (!settingsReady) {
      await loadSettings();
      settingsReady = true;
    }
    
    if (!isEnabled || !settings) {
      log('log', 'Extension not enabled or settings missing, not intercepting');
      const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
      window.postMessage({
        type: responseType,
        requestId: event.data.requestId,
        response: null
      }, '*');
      return;
    }
    
    // Handle the interception
    try {
      const { url, body, requestId } = event.data;
      const provider = detectProvider(url);
      
      if (!provider) {
        log('warn', 'Unknown provider for URL:', url);
        const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
        window.postMessage({
          type: responseType,
          requestId: requestId,
          response: null
        }, '*');
        return;
      }
      
      log('log', 'Parsing request for provider:', { provider, url: url.substring(0, 100) });
      
      // Log body for debugging ChatGPT format
      if (url.includes('chatgpt.com') && body) {
        try {
          const bodyPreview = typeof body === 'string' ? JSON.parse(body) : body;
          log('log', 'ChatGPT request body structure:', {
            keys: Object.keys(bodyPreview),
            hasMessages: !!bodyPreview.messages,
            hasInput: !!bodyPreview.input,
            hasPrompt: !!bodyPreview.prompt,
            hasText: !!bodyPreview.text,
            hasQuery: !!bodyPreview.query,
            hasConversationId: !!bodyPreview.conversation_id,
            hasModel: !!bodyPreview.model,
            bodyType: typeof body,
            bodyLength: typeof body === 'string' ? body.length : 'N/A'
          });
        } catch (e) {
          log('warn', 'Could not parse ChatGPT body for preview:', e);
        }
      }
      
      let parsedRequest;
      try {
        parsedRequest = await parseProviderRequest(url, body, provider);
      } catch (error) {
        log('error', 'Failed to parse provider request:', error);
        const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
        window.postMessage({
          type: responseType,
          requestId: requestId,
          response: null
        }, '*');
        return;
      }
      
      if (!parsedRequest || !parsedRequest.messages || parsedRequest.messages.length === 0) {
        log('warn', 'Not a chat request or could not parse messages', {
          hasParsedRequest: !!parsedRequest,
          messageCount: parsedRequest?.messages?.length || 0,
          url: url.substring(0, 100),
          parsedKeys: parsedRequest ? Object.keys(parsedRequest) : [],
          bodyType: typeof body,
          bodyLength: typeof body === 'string' ? body.length : 'N/A'
        });
        const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
        window.postMessage({
          type: responseType,
          requestId: requestId,
          response: null
        }, '*');
        return;
      }
      
      // Log message structure before conversion
      log('log', 'Messages before conversion:', {
        count: parsedRequest.messages.length,
        firstMessage: parsedRequest.messages[0],
        firstMessageKeys: parsedRequest.messages[0] ? Object.keys(parsedRequest.messages[0]) : [],
        firstMessageType: typeof parsedRequest.messages[0],
        provider: provider
      });
      
      const messages = convertMessages(parsedRequest.messages, provider);
      
      // Log after conversion
      log('log', 'Messages after conversion:', {
        count: messages.length,
        firstMessage: messages[0],
        provider: provider
      });
      
      if (!messages || messages.length === 0) {
        log('warn', 'No valid messages after conversion', {
          originalCount: parsedRequest.messages.length,
          originalFirstMessage: parsedRequest.messages[0],
          provider: provider
        });
        window.postMessage({
          type: 'SPECTYRA_RESPONSE',
          requestId: requestId,
          response: null
        }, '*');
        return;
      }
      
      // Determine path based on content (coding vs talk)
      const allContent = messages.map(m => m.content || '').join(' ').toLowerCase();
      const isCodePath = allContent.includes('```') || 
                        allContent.includes('function') || 
                        allContent.includes('class ') ||
                        allContent.includes('def ') ||
                        allContent.includes('import ') ||
                        allContent.includes('const ') ||
                        allContent.includes('let ') ||
                        allContent.includes('var ') ||
                        allContent.includes('bug') ||
                        allContent.includes('fix') ||
                        allContent.includes('refactor') ||
                        allContent.includes('implement');
      
      // Use user's path setting, but auto-detect code if obvious
      const path = (isCodePath && (settings?.path === 'code' || !settings?.path)) ? 'code' : (settings?.path || 'talk');
      
      log('log', 'Intercepting request from page script:', { 
        provider, 
        model: parsedRequest.model,
        messageCount: messages.length,
        requestId: requestId,
        path: path,
        isCodePath: isCodePath,
        isWebUI: url.includes('chatgpt.com') || url.includes('claude.ai') || url.includes('gemini') || url.includes('x.ai')
      });
      
      const spectyraResponse = await callSpectyra(provider, parsedRequest.model, messages, path);
      
      if (spectyraResponse && spectyraResponse.response_text) {
        // Pass original URL to detect web UI format
        const providerResponse = transformToProviderResponse(spectyraResponse, provider, parsedRequest, url);
        
        if (providerResponse) {
      // Send response back to page script (use stealth type if in stealth mode)
      const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
      window.postMessage({
        type: responseType,
        requestId: requestId,
        response: providerResponse
      }, '*');
          
          // Handle savings
          if (spectyraResponse.savings) {
            const tokensSaved = spectyraResponse.savings.tokens_saved || 0;
            const costSavedUsd = spectyraResponse.savings.cost_saved_usd || 0;
            
            chrome.runtime.sendMessage({
              type: 'SAVINGS_UPDATE',
              tokensSaved: tokensSaved,
              costSavedUsd: costSavedUsd,
            }).catch(err => log('error', 'Failed to send savings update:', err));
            
            showSavingsWidget(spectyraResponse.savings);
          }
          
          return;
        }
      }
      
      // Failed to intercept, tell page script to use original
      const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
      window.postMessage({
        type: responseType,
        requestId: requestId,
        response: null
      }, '*');
    } catch (error) {
      log('error', 'Error handling intercept request:', error);
      const responseType = CONFIG.DEBUG ? 'SPECTYRA_RESPONSE' : '__sp_res';
      window.postMessage({
        type: responseType,
        requestId: event.data?.requestId,
        response: null
      }, '*');
    }
  });
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      loadSettings().then(() => {
        settingsReady = true;
        log('log', 'Settings reloaded');
      }).catch((error) => {
        log('error', 'Failed to reload settings:', error);
      });
    }
  });

  /**
   * Detect LLM provider from URL
   * @param {string} url - Request URL
   * @returns {string|null} Provider name or null
   */
  function detectProvider(url) {
    if (!url || typeof url !== 'string') return null;
    
    const urlLower = url.toLowerCase();
    
    // Direct API calls (highest priority - most reliable)
    if (urlLower.includes('api.openai.com')) return 'openai';
    if (urlLower.includes('api.anthropic.com')) return 'anthropic';
    if (urlLower.includes('generativelanguage.googleapis.com')) return 'gemini';
    if (urlLower.includes('api.x.ai')) return 'grok';
    
    // Web UI backend APIs (map to their providers)
    // ChatGPT backend API (routes to OpenAI)
    if ((urlLower.includes('chatgpt.com') || urlLower.includes('chat.openai.com')) && 
        urlLower.includes('/backend-api/')) return 'openai';
    
    // Claude web UI (routes to Anthropic)
    if (urlLower.includes('claude.ai') && 
        (urlLower.includes('/api/') || urlLower.includes('/v1/'))) return 'anthropic';
    
    // Gemini web UI (routes to Gemini)
    if ((urlLower.includes('gemini.google.com') || urlLower.includes('gemini.app')) && 
        (urlLower.includes('/api/') || urlLower.includes('/v1/'))) return 'gemini';
    
    // Grok web UI (routes to Grok)
    if (urlLower.includes('x.ai') && !urlLower.includes('api.x.ai') && 
        (urlLower.includes('/api/') || urlLower.includes('/v1/'))) return 'grok';
    
    return null;
  }

  /**
   * Parse provider request body into standardized format
   * @param {string} url - Request URL
   * @param {any} body - Request body (string, object, FormData, or ReadableStream)
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>} Parsed request with model and messages, or null on error
   */
  async function parseProviderRequest(url, body, provider) {
    try {
      if (!body) {
        log('warn', 'Empty request body');
        return null;
      }

      let parsed;
      
      // Handle different body types
      if (typeof body === 'string') {
        if (!body.trim()) {
          log('warn', 'Empty string body');
          return null;
        }
        parsed = JSON.parse(body);
      } else if (body instanceof ReadableStream) {
        // Read stream (unlikely but possible)
        const reader = body.getReader();
        const chunks = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const text = new TextDecoder().decode(new Uint8Array(chunks.flat()));
          if (!text.trim()) {
            log('warn', 'Empty stream body');
            return null;
          }
          parsed = JSON.parse(text);
        } finally {
          reader.releaseLock();
        }
      } else if (body instanceof FormData) {
        // FormData - extract JSON field
        const jsonField = body.get('json') || body.get('data');
        if (!jsonField) {
          log('warn', 'No JSON field in FormData');
          return null;
        }
        parsed = typeof jsonField === 'string' ? JSON.parse(jsonField) : jsonField;
      } else if (typeof body === 'object' && body !== null) {
        parsed = body;
      } else {
        log('warn', 'Unsupported body type:', typeof body);
        return null;
      }
      
      // Validate parsed object
      if (!parsed || typeof parsed !== 'object') {
        log('warn', 'Invalid parsed body');
        return null;
      }
      
      // Extract model and messages based on provider
      let model, messages;
      
      // Check if this is a web UI backend API format
      const isChatGPTBackend = url.includes('chatgpt.com/backend-api') || url.includes('chat.openai.com/backend-api');
      const isClaudeBackend = url.includes('claude.ai');
      const isGeminiBackend = url.includes('gemini.google.com') || url.includes('gemini.app');
      const isGrokBackend = url.includes('x.ai') && !url.includes('api.x.ai');
      
      if (isChatGPTBackend) {
        // ChatGPT backend API format
        // ChatGPT uses various formats - try to extract messages
        model = parsed.model || parsed.model_name || parsed.model_slug || 'gpt-4';
        
        // Check if this is just a resume/fetch request (only has conversation_id and offset)
        // These don't contain messages, so we should skip them
        const hasOnlyMetadata = parsed.conversation_id && 
                                (parsed.offset !== undefined || parsed.limit !== undefined) &&
                                !parsed.messages && 
                                !parsed.message && 
                                !parsed.input && 
                                !parsed.prompt && 
                                !parsed.text &&
                                !parsed.query &&
                                !parsed.action;
        
        if (hasOnlyMetadata) {
          log('log', 'ChatGPT backend API - skipping resume/fetch request (no messages):', {
            conversation_id: parsed.conversation_id,
            offset: parsed.offset,
            limit: parsed.limit
          });
          return null; // Skip this request - it's not a chat completion
        }
        
        // Log full structure for debugging
        log('log', 'ChatGPT backend API - parsing request:', {
          keys: Object.keys(parsed),
          hasMessages: !!parsed.messages,
          hasInput: !!parsed.input,
          hasPrompt: !!parsed.prompt,
          hasText: !!parsed.text,
          hasQuery: !!parsed.query,
          hasMessage: !!parsed.message,
          hasAction: !!parsed.action,
          hasConversationId: !!parsed.conversation_id,
          model: model
        });
        
        // Try different message extraction patterns
        if (parsed.messages && Array.isArray(parsed.messages)) {
          messages = parsed.messages;
          log('log', 'Found messages in parsed.messages');
        } else if (parsed.message) {
          messages = [{ role: 'user', content: parsed.message }];
          log('log', 'Found message in parsed.message');
        } else if (parsed.input) {
          messages = typeof parsed.input === 'string' 
            ? [{ role: 'user', content: parsed.input }]
            : parsed.input;
          log('log', 'Found input in parsed.input');
        } else if (parsed.prompt) {
          messages = [{ role: 'user', content: parsed.prompt }];
          log('log', 'Found prompt in parsed.prompt');
        } else if (parsed.text) {
          messages = [{ role: 'user', content: parsed.text }];
          log('log', 'Found text in parsed.text');
        } else if (parsed.query) {
          messages = [{ role: 'user', content: parsed.query }];
          log('log', 'Found query in parsed.query');
        } else if (parsed.action && parsed.action === 'next' && parsed.messages) {
          // ChatGPT streaming format - messages might be nested
          messages = parsed.messages;
          log('log', 'Found messages in action.next format');
        } else if (parsed.action && parsed.action === 'next') {
          // ChatGPT might send messages in a different structure
          // Check for message arrays in other fields
          for (const key of Object.keys(parsed)) {
            if (key !== 'action' && key !== 'conversation_id' && Array.isArray(parsed[key]) && parsed[key].length > 0) {
              const first = parsed[key][0];
              if (first && (typeof first === 'object') && (first.content || first.text || first.message || first.role)) {
                messages = parsed[key];
                log('log', 'Found messages in action.next format, field:', key);
                break;
              }
            }
          }
        } else {
          // Try to find any array that looks like messages
          log('warn', 'ChatGPT backend API - trying to extract messages from:', Object.keys(parsed));
          for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
              const first = parsed[key][0];
              if (first && (typeof first === 'object') && (first.content || first.text || first.message || first.role)) {
                messages = parsed[key];
                log('log', 'Found messages in field:', key);
                break;
              }
            }
          }
        }
        
        // If still no messages, log the full structure for debugging
        if (!messages || messages.length === 0) {
          log('warn', 'ChatGPT backend API - could not extract messages. Full request (first 1000 chars):', JSON.stringify(parsed).substring(0, 1000));
        } else {
          log('log', 'Successfully extracted messages:', { count: messages.length, firstMessage: messages[0] });
        }
      } else if (isClaudeBackend) {
        // Claude web UI format
        model = parsed.model || parsed.model_name || 'claude-3-5-sonnet-20241022';
        
        if (parsed.messages && Array.isArray(parsed.messages)) {
          messages = parsed.messages;
        } else if (parsed.input) {
          messages = typeof parsed.input === 'string' 
            ? [{ role: 'user', content: parsed.input }]
            : parsed.input;
        } else if (parsed.prompt) {
          messages = [{ role: 'user', content: parsed.prompt }];
        } else {
          log('warn', 'Claude backend API - unknown format:', Object.keys(parsed));
        }
      } else if (isGeminiBackend) {
        // Gemini web UI format
        model = parsed.model || parsed.modelName || 'gemini-pro';
        
        if (parsed.contents && Array.isArray(parsed.contents)) {
          messages = parsed.contents;
        } else if (parsed.messages && Array.isArray(parsed.messages)) {
          messages = parsed.messages;
        } else if (parsed.input) {
          messages = typeof parsed.input === 'string' 
            ? [{ role: 'user', content: parsed.input }]
            : parsed.input;
        } else {
          log('warn', 'Gemini backend API - unknown format:', Object.keys(parsed));
        }
      } else if (isGrokBackend) {
        // Grok web UI format
        model = parsed.model || parsed.model_name || 'grok-2';
        
        if (parsed.messages && Array.isArray(parsed.messages)) {
          messages = parsed.messages;
        } else if (parsed.input) {
          messages = typeof parsed.input === 'string' 
            ? [{ role: 'user', content: parsed.input }]
            : parsed.input;
        } else {
          log('warn', 'Grok backend API - unknown format:', Object.keys(parsed));
        }
      } else if (provider === 'openai' || provider === 'grok') {
        model = parsed.model;
        messages = parsed.messages || [];
      } else if (provider === 'anthropic') {
        model = parsed.model;
        messages = parsed.messages || [];
      } else if (provider === 'gemini') {
        model = parsed.model || parsed.modelName || 'gemini-pro';
        messages = parsed.contents || parsed.messages || [];
      } else {
        log('warn', 'Unknown provider:', provider);
        return null;
      }
      
      // Validate extracted data
      if (!model || typeof model !== 'string') {
        log('warn', 'Missing or invalid model:', model);
        return null;
      }
      
      if (!Array.isArray(messages) || messages.length === 0) {
        log('warn', 'Missing or empty messages array');
        return null;
      }
      
      return { model, messages };
    } catch (error) {
      log('error', 'Failed to parse request:', error, { bodyType: typeof body, provider });
      return null;
    }
  }

  /**
   * Convert provider-specific message format to Spectyra standard format
   * @param {Array} providerMessages - Provider-specific messages array
   * @param {string} provider - Provider name
   * @returns {Array} Standardized messages array
   */
  function convertMessages(providerMessages, provider) {
    if (!Array.isArray(providerMessages)) {
      log('warn', 'Invalid messages array:', providerMessages);
      return [];
    }

    try {
      if (provider === 'gemini') {
        // Gemini uses different format (contents array with parts)
        return providerMessages
          .filter(m => m && typeof m === 'object')
          .map(m => {
            let role = m.role;
            if (role === 'model') role = 'assistant';
            if (role !== 'user' && role !== 'assistant' && role !== 'system') {
              role = 'user'; // Default fallback
            }
            
            let content = '';
            if (Array.isArray(m.parts) && m.parts.length > 0) {
              content = m.parts[0]?.text || '';
            } else if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content) && m.content.length > 0) {
              content = m.content[0]?.text || '';
            }
            
            return { role, content: String(content || '') };
          })
          .filter(m => m.content); // Remove empty messages
      }
      
      // OpenAI, Anthropic, Grok use similar format
      // But ChatGPT backend API might have different structures
      return providerMessages
        .filter(m => m && typeof m === 'object')
        .map(m => {
          let role = m.role;
          
          // Handle ChatGPT's role format (might be 'user', 'assistant', 'system', or other)
          if (role === 'model') role = 'assistant';
          if (role !== 'user' && role !== 'assistant' && role !== 'system') {
            // Try to infer from other fields
            if (m.author && m.author.role) {
              role = m.author.role === 'assistant' ? 'assistant' : 'user';
            } else {
              role = 'user'; // Default fallback
            }
          }
          
          let content = '';
          
          // Try multiple content extraction patterns
          if (typeof m.content === 'string') {
            content = m.content;
          } else if (m.content && typeof m.content === 'object') {
            // ChatGPT might use content.content or content.parts
            if (typeof m.content.content === 'string') {
              content = m.content.content;
            } else if (Array.isArray(m.content.parts) && m.content.parts.length > 0) {
              content = m.content.parts[0] || '';
            } else if (Array.isArray(m.content) && m.content.length > 0) {
              // Handle array content (e.g., Anthropic)
              const textPart = m.content.find(part => part.type === 'text' || typeof part === 'string');
              content = textPart?.text || textPart || '';
            }
          } else if (Array.isArray(m.content) && m.content.length > 0) {
            // Handle array content (e.g., Anthropic)
            const textPart = m.content.find(part => part.type === 'text');
            content = textPart?.text || '';
          } else if (m.text) {
            content = m.text;
          } else if (m.message) {
            content = m.message;
          } else if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
            // ChatGPT might use parts array
            content = m.parts[0] || '';
          }
          
          const result = { role, content: String(content || '') };
          
          // Log if we couldn't extract content
          if (!content && DEBUG) {
            log('warn', 'Could not extract content from message:', {
              messageKeys: Object.keys(m),
              message: m
            });
          }
          
          return result;
        })
        .filter(m => m.content); // Remove empty messages
    } catch (error) {
      log('error', 'Failed to convert messages:', error, {
        providerMessages: providerMessages,
        provider: provider
      });
      return [];
    }
  }

  /**
   * Call Spectyra API with retry logic and timeout
   * @param {string} provider - Provider name
   * @param {string} model - Model name
   * @param {Array} messages - Messages array
   * @param {string} path - 'talk' or 'code' (optional, uses settings if not provided)
   * @param {number} retryCount - Current retry attempt (internal)
   * @returns {Promise<Object|null>} Spectyra response or null on error
   */
  async function callSpectyra(provider, model, messages, path = null, retryCount = 0) {
    // Validate inputs
    if (!settings || !isEnabled) {
      log('warn', 'Cannot call API:', { hasSettings: !!settings, isEnabled });
      return null;
    }

    if (!settings.spectyraKey || !settings.spectyraKey.trim()) {
      log('error', 'Missing Spectyra API key');
      return null;
    }

    if (!settings.providerKey || !settings.providerKey.trim()) {
      log('error', 'Missing provider API key');
      return null;
    }

    if (!provider || !model || !Array.isArray(messages) || messages.length === 0) {
      log('warn', 'Invalid API call parameters:', { provider, model, messageCount: messages?.length });
      return null;
    }

    try {
      // Ensure API URL ends with /v1
      let apiUrl = settings.spectyraApiUrl || 'https://spectyra.up.railway.app/v1';
      apiUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
      if (!apiUrl.endsWith('/v1')) {
        apiUrl = apiUrl.endsWith('/v1/') ? apiUrl.slice(0, -1) : `${apiUrl}/v1`;
      }
      const url = `${apiUrl}/chat`;
      
      // Use provided path or fall back to settings
      const finalPath = path || settings.path || 'talk';
      
      const requestBody = {
        path: finalPath,
        provider,
        model,
        messages,
        mode: 'optimized',
        optimization_level: Math.max(0, Math.min(4, settings.optimizationLevel || 2)),
      };
      
      if (finalPath === 'code') {
        log('log', 'Using code path optimization');
      }
      
      log('log', 'Calling API:', { url, provider, model, messageCount: messages.length, retryCount });
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SPECTYRA-KEY': settings.spectyraKey.trim(),
            'X-PROVIDER-KEY': settings.providerKey.trim(),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          log('error', 'API error:', response.status, response.statusText, errorText);
          
          // Retry on 5xx errors or network issues
          if ((response.status >= 500 || response.status === 429) && retryCount < CONFIG.MAX_RETRIES) {
            log('log', `Retrying after ${CONFIG.RETRY_DELAY_MS}ms (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS * (retryCount + 1)));
            return callSpectyra(provider, model, messages, path, retryCount + 1);
          }
          
          throw new Error(`Spectyra API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format');
        }
        
        log('log', 'API response received:', { 
          hasResponse: !!data.response_text,
          hasSavings: !!data.savings,
          usage: data.usage 
        });
        
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Retry on network errors
        if (fetchError.name !== 'AbortError' && retryCount < CONFIG.MAX_RETRIES) {
          log('log', `Retrying after network error (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS * (retryCount + 1)));
          return callSpectyra(provider, model, messages, path, retryCount + 1);
        }
        
        throw fetchError;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        log('error', 'API call timed out after', CONFIG.API_TIMEOUT_MS, 'ms');
      } else {
        log('error', 'API call failed:', error);
      }
      return null;
    }
  }

  /**
   * Transform Spectyra response to provider-specific format
   * @param {Object} spectyraResponse - Spectyra API response
   * @param {string} provider - Provider name
   * @param {Object} originalRequest - Original provider request
   * @param {string} originalUrl - Original request URL (to detect web UI format)
   * @returns {Object|null} Provider-formatted response or null on error
   */
  function transformToProviderResponse(spectyraResponse, provider, originalRequest, originalUrl = '') {
    try {
      // Validate inputs
      if (!spectyraResponse || typeof spectyraResponse !== 'object') {
        log('error', 'Invalid spectyraResponse:', spectyraResponse);
        return null;
      }
      
      if (!originalRequest || typeof originalRequest !== 'object') {
        log('error', 'Invalid originalRequest:', originalRequest);
        return null;
      }

      const responseText = spectyraResponse.response_text || '';
      const usage = spectyraResponse.usage || {};
      const model = originalRequest.model || 'unknown';
      const timestamp = Math.floor(Date.now() / 1000);
      const id = `${provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Extract token counts safely
      const inputTokens = Math.max(0, parseInt(usage.input_tokens, 10) || 0);
      const outputTokens = Math.max(0, parseInt(usage.output_tokens, 10) || 0);
      const totalTokens = Math.max(0, parseInt(usage.total_tokens, 10) || (inputTokens + outputTokens));

      // Check if this is a web UI backend API format
      const isChatGPTBackend = originalUrl.includes('chatgpt.com/backend-api') || originalUrl.includes('chat.openai.com/backend-api');
      const isClaudeBackend = originalUrl.includes('claude.ai');
      const isGeminiBackend = originalUrl.includes('gemini.google.com') || originalUrl.includes('gemini.app');
      const isGrokBackend = originalUrl.includes('x.ai') && !originalUrl.includes('api.x.ai');

      // ChatGPT backend API format
      if (isChatGPTBackend) {
        // ChatGPT backend API format - they use a specific structure
        // Note: ChatGPT often uses streaming, but we return complete response
        // The exact format may vary, so we try to match common patterns
        return {
          message: {
            id: id,
            role: 'assistant',
            author: {
              role: 'assistant'
            },
            content: {
              content_type: 'text',
              parts: [responseText]
            },
            create_time: timestamp,
            status: 'finished_successfully'
          },
          conversation_id: originalRequest.conversation_id || id,
          error: null,
          // Include usage if available
          ...(usage && {
            _spectyra_usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: totalTokens
            }
          })
        };
      }

      // Claude web UI format
      if (isClaudeBackend) {
        return {
          content: [{
            type: 'text',
            text: responseText
          }],
          model: model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens
          }
        };
      }

      // Gemini web UI format
      if (isGeminiBackend) {
        return {
          candidates: [{
            content: {
              parts: [{
                text: responseText
              }],
              role: 'model'
            },
            finishReason: 'STOP'
          }],
          usageMetadata: {
            promptTokenCount: inputTokens,
            candidatesTokenCount: outputTokens,
            totalTokenCount: totalTokens
          }
        };
      }

      // Grok web UI format
      if (isGrokBackend) {
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: responseText
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens
          }
        };
      }

      // Direct API formats (standard provider APIs)
      if (provider === 'openai' || provider === 'grok') {
        return {
          id: `chatcmpl-${id}`,
          object: 'chat.completion',
          created: timestamp,
          model: model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: responseText,
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens,
          },
        };
      } else if (provider === 'anthropic') {
        return {
          id: `msg-${id}`,
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: responseText,
          }],
          model: model,
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
        };
      } else if (provider === 'gemini') {
        return {
          candidates: [{
            content: {
              parts: [{
                text: responseText,
              }],
              role: 'model',
            },
            finishReason: 'STOP',
            safetyRatings: [],
          }],
          usageMetadata: {
            promptTokenCount: inputTokens,
            candidatesTokenCount: outputTokens,
            totalTokenCount: totalTokens,
          },
        };
      }
      
      // Fallback: return a basic structure
      log('warn', 'Unknown provider, using fallback format:', provider);
      return {
        response_text: responseText,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      };
    } catch (error) {
      log('error', 'Error in transformToProviderResponse:', error);
      return null;
    }
  }
  
  // Initialize settings loading
  loadSettings().then(() => {
    settingsReady = true;
    log('log', 'Content script initialized', { 
      isEnabled, 
      hasSpectyraKey: !!settings?.spectyraKey,
      hasProviderKey: !!settings?.providerKey,
      optimizationLevel: settings?.optimizationLevel,
      path: settings?.path,
      apiUrl: settings?.spectyraApiUrl
    });
    
    // Log a visible message in console for debugging
    if (CONFIG.DEBUG) {
      console.log('%c[Spectyra] Extension loaded and ready', 'color: #007bff; font-weight: bold;');
      console.log('[Spectyra] Settings:', {
        enabled: isEnabled,
        hasKeys: !!(settings?.spectyraKey && settings?.providerKey),
        optimizationLevel: settings?.optimizationLevel,
        path: settings?.path
      });
    }
  }).catch((error) => {
    log('error', 'Failed to initialize:', error);
  });

  // Debug logging for common LLM sites (only in debug mode)
  if (CONFIG.DEBUG) {
    const hostname = window.location.hostname;
    const isLLMSite = hostname.includes('openai.com') || 
                     hostname.includes('chatgpt.com') || 
                     hostname.includes('anthropic.com') || 
                     hostname.includes('claude.ai') ||
                     hostname.includes('gemini.google.com') ||
                     hostname.includes('x.ai');
    
    if (isLLMSite) {
      log('log', 'Content script loaded on LLM site', { 
        hostname,
        isEnabled, 
        hasSettings: !!settings,
        hasSpectyraKey: !!settings?.spectyraKey,
        hasProviderKey: !!settings?.providerKey,
        settingsReady 
      });
      
      // Special message for ChatGPT users
      if (hostname.includes('openai.com') || hostname.includes('chatgpt.com')) {
        console.log('%c[Spectyra] ChatGPT detected! Extension is ready.', 'color: #10a37f; font-weight: bold; font-size: 14px;');
        console.log('[Spectyra] Make sure you have:');
        console.log('  1. Extension enabled in settings');
        console.log('  2. Spectyra API Key configured');
        console.log('  3. Provider API Key (your OpenAI key) configured');
        console.log('[Spectyra] Type window.__spectyraTest() to check status');
      }
    }
  }
  
  // Expose a test function for debugging (only in debug mode)
  if (CONFIG.DEBUG) {
    window.__spectyraTest = async function() {
      // Ensure settings are loaded
      if (!settingsReady) {
        console.log('[Spectyra Test] Loading settings...');
        await loadSettings();
        settingsReady = true;
      }
      
      const status = {
        settingsReady,
        isEnabled,
        hasSettings: !!settings,
        settings: settings ? {
          enabled: settings.enabled,
          hasSpectyraKey: !!settings.spectyraKey,
          hasProviderKey: !!settings.providerKey,
          spectyraKeyLength: settings.spectyraKey?.length || 0,
          providerKeyLength: settings.providerKey?.length || 0,
          optimizationLevel: settings.optimizationLevel,
          path: settings.path,
          apiUrl: settings.spectyraApiUrl
        } : null,
        pageScriptInjected: window.__spectyraInjected || false,
        fetchOverridden: typeof window.fetch === 'function' && window.fetch.toString().includes('SPECTYRA')
      };
      
      console.log('%c[Spectyra Test] Extension Status:', 'color: #007bff; font-weight: bold; font-size: 14px;', status);
      
      // Additional diagnostics
      console.log('[Spectyra Test] Diagnostics:');
      console.log('  - Settings ready:', settingsReady ? '✅' : '❌');
      console.log('  - Extension enabled:', isEnabled ? '✅' : '❌');
      console.log('  - Has Spectyra key:', settings?.spectyraKey ? '✅' : '❌');
      console.log('  - Has Provider key:', settings?.providerKey ? '✅' : '❌');
      console.log('  - Page script injected:', window.__spectyraInjected ? '✅' : '❌');
      const fetchOverridden = typeof window.fetch === 'function' && window.fetch.toString().includes('SPECTYRA');
      console.log('  - Fetch overridden in page:', fetchOverridden ? '✅' : '❌');
      
      // Try to check page context
      try {
        const pageTest = window.__spectyraPageTest;
        if (pageTest) {
          const pageStatus = pageTest();
          console.log('  - Page context status:', pageStatus);
        } else {
          console.log('  - Page context test: Not available (script may not be injected)');
        }
      } catch (e) {
        console.log('  - Page context test: Cannot access (expected - different context)');
      }
      
      if (!isEnabled) {
        console.warn('[Spectyra Test] ⚠️ Extension is not enabled. Check settings.');
      }
      if (!settings?.spectyraKey || !settings?.providerKey) {
        console.warn('[Spectyra Test] ⚠️ API keys missing. Configure in extension settings.');
      }
      if (!window.__spectyraInjected) {
        console.warn('[Spectyra Test] ⚠️ Page script not injected. Requests may not be intercepted.');
        console.warn('[Spectyra Test] Try: Reload the page after configuring settings.');
      }
      
      // Check if we can see fetch calls
      console.log('[Spectyra Test] Next steps:');
      console.log('  1. Send a message in ChatGPT');
      console.log('  2. Watch for "[Spectyra Page] Intercepting LLM request" in console');
      console.log('  3. Watch for "[Spectyra] Received intercept request" in console');
      console.log('');
      console.log('[Spectyra Test] Debugging:');
      console.log('  - Check Network tab to see what URLs ChatGPT is calling');
      console.log('  - Look for requests to api.openai.com or similar');
      console.log('  - If you see fetch calls but no interception, the page script may not be active');
      console.log('  - Try: Check if window.__spectyraPageTest exists in page context (use page console, not extension console)');
      
      return status;
    };
    console.log('[Spectyra] Test function available: window.__spectyraTest()');
    console.log('[Spectyra] Note: The function is async, so use: await window.__spectyraTest()');
  }

  /**
   * Show savings widget overlay on the page
   * @param {Object} savings - Savings object with pct_saved and cost_saved_usd
   */
  function showSavingsWidget(savings) {
    if (!savings || typeof savings !== 'object') {
      log('warn', 'Invalid savings object for widget');
      return;
    }

    // Wait for body to be available
    const appendWidget = () => {
      try {
        // Double-check body exists and is ready
        if (!document || !document.body) {
          setTimeout(appendWidget, 10);
          return;
        }

        // Remove existing widget if present
        const existingWidget = document.getElementById('spectyra-widget');
        if (existingWidget) {
          existingWidget.remove();
        }

        // Create new widget
        const widget = document.createElement('div');
        widget.id = 'spectyra-widget';
        widget.setAttribute('role', 'status');
        widget.setAttribute('aria-live', 'polite');
        widget.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          padding: 14px 18px;
          border-radius: 10px;
          box-shadow: 0 6px 20px rgba(0,123,255,0.3);
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          max-width: 320px;
          min-width: 250px;
          animation: spectyraSlideIn 0.3s ease-out;
          pointer-events: auto;
          cursor: default;
        `;
        
        // Calculate savings values safely
        const pctSaved = savings.pct_saved != null ? Number(savings.pct_saved) : 0;
        const costSaved = savings.cost_saved_usd != null ? Number(savings.cost_saved_usd) : 0;
        const tokensSaved = savings.tokens_saved != null ? Number(savings.tokens_saved) : 0;

        widget.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 20px; margin-right: 8px;">💰</span>
            <div style="font-weight: 600; font-size: 15px;">Spectyra Savings</div>
          </div>
          <div style="font-size: 13px; opacity: 0.95; line-height: 1.5;">
            <div style="margin-bottom: 4px;">
              <strong>${pctSaved.toFixed(1)}%</strong> tokens saved
            </div>
            <div style="margin-bottom: 4px;">
              <strong>$${costSaved.toFixed(4)}</strong> cost saved
            </div>
            ${tokensSaved > 0 ? `<div style="font-size: 11px; opacity: 0.85;">${tokensSaved.toLocaleString()} tokens</div>` : ''}
          </div>
        `;

        // Safely append to body
        try {
          document.body.appendChild(widget);
        } catch (error) {
          log('error', 'Cannot append widget:', error);
          return;
        }

        // Auto-hide after configured duration
        const hideTimeout = setTimeout(() => {
          if (widget && widget.parentNode) {
            widget.style.animation = 'spectyraSlideOut 0.3s ease-out';
            setTimeout(() => {
              if (widget && widget.parentNode) {
                widget.remove();
              }
            }, 300);
          }
        }, CONFIG.WIDGET_DISPLAY_DURATION_MS);

        // Allow manual dismissal on click
        widget.addEventListener('click', () => {
          clearTimeout(hideTimeout);
          if (widget && widget.parentNode) {
            widget.style.animation = 'spectyraSlideOut 0.3s ease-out';
            setTimeout(() => {
              if (widget && widget.parentNode) {
                widget.remove();
              }
            }, 300);
          }
        });
      } catch (error) {
        log('error', 'Error in showSavingsWidget:', error);
      }
    };
    
    appendWidget();
  }

  /**
   * Add CSS animations for widget - wait for head to be available
   */
  const addStyles = () => {
    if (!document.head) {
      setTimeout(addStyles, 10);
      return;
    }

    // Check if style already exists
    if (document.getElementById('spectyra-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'spectyra-styles';
    style.textContent = `
      @keyframes spectyraSlideIn {
        from {
          transform: translateX(calc(100% + 20px));
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes spectyraSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(calc(100% + 20px));
          opacity: 0;
        }
      }
      #spectyra-widget {
        user-select: none;
        -webkit-user-select: none;
      }
      #spectyra-widget:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,123,255,0.4);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
    `;
    
    try {
      document.head.appendChild(style);
    } catch (error) {
      log('error', 'Failed to add styles:', error);
    }
  };
  
  // Try to add styles immediately, or wait for DOM
  if (document.head) {
    addStyles();
  } else {
    // Wait for DOMContentLoaded or use polling
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addStyles);
    } else {
      setTimeout(addStyles, 10);
    }
  }

  // Listen for session savings updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SESSION_SAVINGS_UPDATE') {
      // Could update a persistent widget if needed
    }
  });
})();
