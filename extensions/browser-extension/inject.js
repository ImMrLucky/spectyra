// This script is injected into the page context (not isolated world)
// It intercepts fetch calls and communicates with the content script
// Must be a separate file to avoid CSP violations

(function() {
  'use strict';
  
  if (window.__spectyraInjected) {
    console.log('[Spectyra Page] Already injected');
    return;
  }
  window.__spectyraInjected = true;
  console.log('[Spectyra Page] Fetch interceptor injected');
  
  const originalFetch = window.fetch;
  let interceptCount = 0;
  
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    const urlString = typeof url === 'string' ? url : (url?.url || url?.toString() || '');
    
    // Log all fetch calls for debugging (only for LLM-related URLs)
    if (urlString.includes('openai') || urlString.includes('anthropic') || urlString.includes('googleapis') || urlString.includes('x.ai')) {
      console.log('[Spectyra Page] Fetch called:', {
        url: urlString,
        method: options.method || 'GET',
        hasBody: !!options.body
      });
    }
    
    // Check if this is an LLM provider request
    // ChatGPT may use different endpoints, so check for various patterns
    const isLLMProvider = 
      urlString.includes('api.openai.com') ||
      urlString.includes('api.anthropic.com') ||
      urlString.includes('generativelanguage.googleapis.com') ||
      urlString.includes('api.x.ai') ||
      urlString.includes('/v1/chat/completions') ||
      urlString.includes('/v1/messages') ||
      (urlString.includes('openai') && urlString.includes('/chat'));
    
    if (isLLMProvider && options.method === 'POST') {
      interceptCount++;
      const requestId = Date.now() + '-' + Math.random();
      console.log('[Spectyra Page] Intercepting LLM request #' + interceptCount, {
        url: urlString,
        requestId: requestId
      });
      
      // Notify content script
      window.postMessage({
        type: 'SPECTYRA_INTERCEPT',
        requestId: requestId,
        url: urlString,
        method: options.method,
        body: options.body
      }, '*');
      
      // Wait for response from content script
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
          console.warn('[Spectyra Page] Timeout waiting for content script response, using original fetch');
          originalFetch(...args).then(resolve).catch(reject);
        }, 15000); // 15 second timeout
        
        const listener = (event) => {
          if (event.data && 
              event.data.type === 'SPECTYRA_RESPONSE' && 
              event.data.requestId === requestId) {
            const elapsed = Date.now() - startTime;
            clearTimeout(timeout);
            window.removeEventListener('message', listener);
            
            console.log('[Spectyra Page] Received response from content script', {
              hasResponse: !!event.data.response,
              elapsed: elapsed + 'ms'
            });
            
            if (event.data.response) {
              // Return intercepted response
              resolve(new Response(JSON.stringify(event.data.response), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }));
            } else {
              // Content script said to use original
              console.log('[Spectyra Page] Content script said to use original fetch');
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
  
  // Expose test function in page context
  window.__spectyraPageTest = function() {
    return {
      injected: true,
      interceptCount: interceptCount,
      fetchOverridden: window.fetch !== originalFetch
    };
  };
  
  console.log('[Spectyra Page] Injection complete, fetch override active');
  
  // Listen for ping from content script to verify communication
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SPECTYRA_PING') {
      console.log('[Spectyra Page] Received ping from content script, responding...');
      window.postMessage({
        type: 'SPECTYRA_PONG',
        timestamp: event.data.timestamp,
        injected: true,
        interceptCount: interceptCount
      }, '*');
    }
  });
  
  // Send ready message
  window.postMessage({
    type: 'SPECTYRA_READY',
    injected: true
  }, '*');
})();
