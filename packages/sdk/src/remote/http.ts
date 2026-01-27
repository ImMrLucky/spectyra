/**
 * Remote HTTP Client
 * 
 * Handles HTTP requests to Spectyra API with proper error handling
 */

import type { AgentOptionsResponse, AgentEventResponse } from "../types.js";

export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Make a POST request to Spectyra API
 */
export async function postJson<T>(
  url: string,
  apiKey: string,
  body: any
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SPECTYRA-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    let errorMessage = `API error: ${response.statusText}`;
    try {
      const errorData = await response.json() as ApiError;
      errorMessage = errorData.error || errorMessage;
      if (errorData.details) {
        errorMessage += ` - ${errorData.details}`;
      }
    } catch {
      // If JSON parsing fails, use status text
      const text = await response.text();
      if (text) {
        errorMessage = text.substring(0, 200);
      }
    }
    throw new Error(errorMessage);
  }
  
  return response.json() as Promise<T>;
}
