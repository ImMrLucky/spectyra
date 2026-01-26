// This script is injected into the page context (not isolated world)
// It intercepts fetch calls and communicates with the content script
// Must be a separate file to avoid CSP violations

(function() {
  'use strict';
  
  // Stealth mode: minimize detection
  // Check if we should be stealthy (can be set by content script)
  const STEALTH_MODE = window.__spectyraStealth !== false; // Default to stealth
  const DEBUG = window.__spectyraDebug === true; // Only debug if explicitly enabled
  
  // Use less obvious property name in production
  const INJECTED_PROP = STEALTH_MODE ? '__sp_inj' : '__spectyraInjected';
  
  if (window[INJECTED_PROP]) {
    if (DEBUG) console.log('[Spectyra Page] Already injected');
    return;
  }
  window[INJECTED_PROP] = true;
  if (DEBUG) console.log('[Spectyra Page] Fetch interceptor injected');
  
  const originalFetch = window.fetch;
  let interceptCount = 0;
  
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    const urlString = typeof url === 'string' ? url : (url?.url || url?.toString() || '');
    
    // Log fetch calls that might be LLM-related
    const isChatGPTBackend = urlString.includes('chatgpt.com') || urlString.includes('chat.openai.com');
    const isClaudeWeb = urlString.includes('claude.ai');
    const isGeminiWeb = urlString.includes('gemini.google.com') || urlString.includes('gemini.app');
    const isGrokWeb = urlString.includes('x.ai') && !urlString.includes('api.x.ai');
    const isLLMWebUI = isChatGPTBackend || isClaudeWeb || isGeminiWeb || isGrokWeb;
    
    const method = options.method || 'GET';
    const isPost = method === 'POST' || method === 'PUT' || method === 'PATCH';
    const isGet = method === 'GET';
    
    // Enhanced logging for POST requests to web UIs (only in debug mode)
    // Only log if it's actually a POST (not GET)
    if (isLLMWebUI && isPost && !isGet && DEBUG) {
      console.log('%c[Spectyra Page] 🔍 POTENTIAL LLM POST REQUEST', 'color: #ff6b6b; font-weight: bold; font-size: 14px;', {
        url: urlString,
        method: method,
        hasBody: !!options.body,
        bodyLength: options.body ? (typeof options.body === 'string' ? options.body.length : 'Object') : 0,
        bodyPreview: options.body ? (typeof options.body === 'string' ? options.body.substring(0, 300) : '[Object]') : null,
        endpoint: urlString.split('/').slice(-3).join('/'), // Show last 3 path segments
        isChatGPTBackend,
        isClaudeWeb,
        isGeminiWeb,
        isGrokWeb
      });
      
      // Try to parse body if it's a string (only in debug mode)
      if (options.body && typeof options.body === 'string' && DEBUG) {
        try {
          const bodyPreview = JSON.parse(options.body);
          console.log('[Spectyra Page] Request body structure:', {
            keys: Object.keys(bodyPreview),
            hasMessages: !!bodyPreview.messages,
            hasInput: !!bodyPreview.input,
            hasPrompt: !!bodyPreview.prompt,
            hasText: !!bodyPreview.text,
            hasQuery: !!bodyPreview.query,
            model: bodyPreview.model || bodyPreview.model_name || bodyPreview.model_slug
          });
        } catch (e) {
          // Not JSON, that's okay
        }
      }
    } else if (DEBUG && (isLLMWebUI || urlString.includes('api.openai.com') || urlString.includes('api.anthropic.com') || urlString.includes('generativelanguage.googleapis.com') || urlString.includes('api.x.ai'))) {
      // Log all LLM-related requests (including GET) - only in debug mode
      console.log('[Spectyra Page] Fetch called:', {
        url: urlString.substring(0, 200),
        method: method,
        hasBody: !!options.body,
        isChatGPTBackend,
        isClaudeWeb,
        isGeminiWeb,
        isGrokWeb,
        isBackendAPI: urlString.includes('/backend-api/') || urlString.includes('/api/'),
        endpoint: urlString.split('/').slice(-2).join('/')
      });
    }
    
    // Check if this is an LLM provider request
    // ChatGPT uses its own backend API, so we need to intercept that
    // The actual chat completion is usually POST to /backend-api/conversation or similar
    const isDirectAPI = 
      urlString.includes('api.openai.com') ||
      urlString.includes('api.anthropic.com') ||
      urlString.includes('generativelanguage.googleapis.com') ||
      urlString.includes('api.x.ai') ||
      urlString.includes('/v1/chat/completions') ||
      urlString.includes('/v1/messages') ||
      urlString.includes('/v1/chat');
    
      // ChatGPT backend API - intercept conversation/completion endpoints
      // Note: We need to exclude status/polling endpoints and resume/fetch requests
      // The actual chat endpoint should have messages in the body
      // Main endpoint: /backend-api/f/conversation (POST with messages)
      const isChatGPTBackendAPI = 
        (urlString.includes('chatgpt.com') || urlString.includes('chat.openai.com')) &&
        urlString.includes('/backend-api/') &&
        // Exclude status/polling endpoints (GET requests, no messages)
        !urlString.includes('/stream_status') &&
        !urlString.includes('/status') &&
        !urlString.includes('/resume') &&
        !urlString.includes('/sentinel/') &&
        !urlString.includes('/aip/') &&
        !urlString.includes('/lat/') &&
        !urlString.includes('/ces/') &&
        // Only intercept POST requests to actual chat endpoints
        // Main endpoint: /backend-api/f/conversation (without any suffix)
        (urlString.includes('/f/conversation') && !urlString.match(/\/f\/conversation\/[^\/]+/)) || // /f/conversation but not /f/conversation/{id}/
        // Also catch /conversation (without f/) if it's a POST with body
        (urlString.includes('/conversation') && !urlString.match(/\/conversation\/[^\/]+\//)); // /conversation but not /conversation/{id}/
    
    // Claude web UI backend API
    const isClaudeBackendAPI = 
      urlString.includes('claude.ai') &&
      (urlString.includes('/api/') || urlString.includes('/v1/')) &&
      (urlString.includes('/messages') || urlString.includes('/chat') || urlString.includes('/complete'));
    
    // Gemini web UI backend API
    const isGeminiBackendAPI = 
      (urlString.includes('gemini.google.com') || urlString.includes('gemini.app')) &&
      (urlString.includes('/api/') || urlString.includes('/v1/') || urlString.includes('/generate'));
    
    // Grok web UI backend API
    const isGrokBackendAPI = 
      urlString.includes('x.ai') &&
      !urlString.includes('api.x.ai') && // Exclude direct API
      (urlString.includes('/api/') || urlString.includes('/v1/') || urlString.includes('/chat'));
    
    // Only consider it an LLM provider if it's a POST request (GET requests are status checks)
    const isLLMProvider = isPost && !isGet && (isDirectAPI || isChatGPTBackendAPI || isClaudeBackendAPI || isGeminiBackendAPI || isGrokBackendAPI);
    
    // Check method - Only intercept POST/PUT/PATCH (not GET)
    const isPostRequest = isPost && !isGet;
    
    // Enhanced logging for interception decisions (only in debug mode)
    if (isLLMProvider && DEBUG) {
      console.log('%c[Spectyra Page] 🎯 INTERCEPTION CHECK', 'color: #10a37f; font-weight: bold;', {
        isDirectAPI,
        isChatGPTBackendAPI,
        isClaudeBackendAPI,
        isGeminiBackendAPI,
        isGrokBackendAPI,
        isLLMProvider,
        isPostRequest,
        method: options.method || 'GET',
        url: urlString,
        willIntercept: isLLMProvider && isPostRequest
      });
    }
    
    if (isLLMProvider && isPostRequest) {
      // For ChatGPT, check if this is a resume/fetch request (skip those)
      if (isChatGPTBackendAPI) {
        // Skip if no body (status checks, etc.)
        if (!options.body) {
          if (DEBUG) {
            console.log('[Spectyra Page] Skipping ChatGPT request (no body)');
          }
          return originalFetch.apply(this, args);
        }
        
        try {
          const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
          if (!bodyStr || bodyStr.trim() === '') {
            if (DEBUG) {
              console.log('[Spectyra Page] Skipping ChatGPT request (empty body)');
            }
            return originalFetch.apply(this, args);
          }
          
          const bodyPreview = JSON.parse(bodyStr);
          // Skip if it only has conversation_id and offset (resume/fetch request)
          const hasOnlyMetadata = bodyPreview.conversation_id && 
                                  (bodyPreview.offset !== undefined || bodyPreview.limit !== undefined) &&
                                  !bodyPreview.messages && 
                                  !bodyPreview.message && 
                                  !bodyPreview.input && 
                                  !bodyPreview.prompt &&
                                  !bodyPreview.text &&
                                  !bodyPreview.query &&
                                  !bodyPreview.action;
          
          if (hasOnlyMetadata) {
            if (DEBUG) {
              console.log('[Spectyra Page] Skipping ChatGPT resume/fetch request (no messages):', {
                conversation_id: bodyPreview.conversation_id,
                offset: bodyPreview.offset
              });
            }
            return originalFetch.apply(this, args);
          }
        } catch (e) {
          // If we can't parse, continue with interception (might be a new message format)
          if (DEBUG) {
            console.log('[Spectyra Page] Could not parse ChatGPT body, continuing interception:', e);
          }
        }
      }
      
      interceptCount++;
      const requestId = Date.now() + '-' + Math.random();
      
      // Store request info for debugging
      const requestInfo = {
        url: urlString,
        method: options.method || 'POST',
        requestId: requestId,
        timestamp: new Date().toISOString(),
        hasBody: !!options.body,
        bodyType: typeof options.body
      };
      interceptedRequests.push(requestInfo);
      if (interceptedRequests.length > 50) {
        interceptedRequests.shift(); // Keep only last 50
      }
      
      if (DEBUG) {
        console.log('%c[Spectyra Page] 🎯 INTERCEPTING LLM REQUEST #' + interceptCount, 'color: #10a37f; font-weight: bold; font-size: 14px;', requestInfo);
        
        // Log full body for debugging ChatGPT
        if (isChatGPTBackendAPI && options.body) {
          try {
            const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            const bodyPreview = JSON.parse(bodyStr);
            console.log('%c[Spectyra Page] 📦 FULL REQUEST BODY:', 'color: #ff9800; font-weight: bold;', {
              url: urlString,
              bodyKeys: Object.keys(bodyPreview),
              bodyPreview: bodyPreview,
              bodyLength: bodyStr.length
            });
          } catch (e) {
            console.log('[Spectyra Page] Body is not JSON:', typeof options.body);
          }
        }
      }
      
      // Notify content script (use less obvious type in stealth mode)
      const interceptType = STEALTH_MODE ? '__sp_int' : 'SPECTYRA_INTERCEPT';
      window.postMessage({
        type: interceptType,
        requestId: requestId,
        url: urlString,
        method: options.method,
        body: options.body
      }, '*');
      
      // Wait for response from content script
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
          if (DEBUG) console.warn('[Spectyra Page] Timeout waiting for content script response, using original fetch');
          originalFetch(...args).then(resolve).catch(reject);
        }, 15000); // 15 second timeout
        
        const responseType = STEALTH_MODE ? '__sp_res' : 'SPECTYRA_RESPONSE';
        const listener = (event) => {
          if (event.data && 
              event.data.type === responseType && 
              event.data.requestId === requestId) {
            const elapsed = Date.now() - startTime;
            clearTimeout(timeout);
            window.removeEventListener('message', listener);
            
            if (DEBUG) {
              console.log('[Spectyra Page] Received response from content script', {
                hasResponse: !!event.data.response,
                elapsed: elapsed + 'ms'
              });
            }
            
            if (event.data.response) {
              // Return intercepted response
              resolve(new Response(JSON.stringify(event.data.response), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            } else {
              // Content script said to use original
              if (DEBUG) console.log('[Spectyra Page] Content script said to use original fetch');
              originalFetch(...args).then(resolve).catch(reject);
            }
          }
        };
        
        window.addEventListener('message', listener);
      });
    }
    
    // Not an LLM request, use original fetch
    return originalFetch.apply(this, args);
  };
  
  // Store intercepted requests for debugging
  const interceptedRequests = [];
  
  // Expose test functions only in debug mode (stealth)
  if (DEBUG) {
    window.__spectyraPageTest = function() {
      return {
        injected: true,
        interceptCount: interceptCount,
        fetchOverridden: window.fetch !== originalFetch,
        interceptedRequests: interceptedRequests.slice(-10) // Last 10 requests
      };
    };
    
    // Expose function to get all POST requests to ChatGPT backend
    window.__spectyraGetChatGPTPosts = function() {
      return interceptedRequests.filter(r => 
        r.url.includes('chatgpt.com') || r.url.includes('chat.openai.com')
      );
    };
  }
  
  if (DEBUG) console.log('[Spectyra Page] Injection complete, fetch override active');
  
  // Also intercept XMLHttpRequest (ChatGPT might use this instead of fetch)
  const originalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function(...args) {
    const xhr = new originalXHR(...args);
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method, url, ...rest) {
      const urlString = typeof url === 'string' ? url : url.toString();
      if (DEBUG) {
        console.log('[Spectyra Page] XHR.open called:', {
          method: method,
          url: urlString.substring(0, 100),
          isOpenAI: urlString.includes('openai'),
          isAnthropic: urlString.includes('anthropic')
        });
      }
      
      // Check if this is an LLM provider request
      const isLLMProvider = 
        urlString.includes('api.openai.com') ||
        urlString.includes('api.anthropic.com') ||
        urlString.includes('generativelanguage.googleapis.com') ||
        urlString.includes('api.x.ai') ||
        urlString.includes('/v1/chat/completions') ||
        urlString.includes('/v1/messages');
      
      if (isLLMProvider && (method === 'POST' || method === 'PUT' || method === 'PATCH') && DEBUG) {
        console.log('%c[Spectyra Page] 🎯 XHR LLM REQUEST DETECTED', 'color: #ff6b6b; font-weight: bold;');
        console.warn('[Spectyra Page] XHR interception not fully implemented - ChatGPT may be using XHR instead of fetch');
      }
      
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    return xhr;
  };
  
  // Listen for ping from content script to verify communication
  const pingType = STEALTH_MODE ? '__sp_png' : 'SPECTYRA_PING';
  const pongType = STEALTH_MODE ? '__sp_png_r' : 'SPECTYRA_PONG';
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === pingType) {
      if (DEBUG) console.log('[Spectyra Page] Received ping from content script, responding...');
      window.postMessage({
        type: pongType,
        timestamp: event.data.timestamp,
        injected: true,
        interceptCount: interceptCount
      }, '*');
    }
  });
  
      // Send ready message (silently in stealth mode)
      // Use less obvious message type in stealth mode
      const readyType = STEALTH_MODE ? '__sp_rdy' : 'SPECTYRA_READY';
      window.postMessage({
        type: readyType,
        injected: true
      }, '*');
  
  if (DEBUG) console.log('[Spectyra Page] XHR interceptor also installed');
  
  // In stealth mode, try to make fetch override less detectable
  if (STEALTH_MODE && !DEBUG) {
    // Try to preserve original fetch signature to make it less obvious
    try {
      Object.defineProperty(window.fetch, 'name', { value: 'fetch', configurable: true });
      Object.defineProperty(window.fetch, 'length', { value: 2, configurable: true });
      // Try to make toString() look more like original (partial mitigation)
      const originalToString = originalFetch.toString.bind(originalFetch);
      try {
        Object.defineProperty(window.fetch, 'toString', {
          value: function() { return originalToString(); },
          configurable: true
        });
      } catch (e) {
        // Can't override toString in some browsers
      }
    } catch (e) {
      // Ignore if we can't modify
    }
  }
})();
