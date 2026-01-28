import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";
import type { ChatProvider } from "./types.js";
import type { Message, Usage } from "@spectyra/shared";
import { estimateUsage } from "./tokenEstimate.js";

export class GeminiProvider implements ChatProvider {
  name = "gemini";
  models = [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro",
  ];
  supportsUsage = false; // Gemini doesn't reliably return usage in all models
  
  private client: GoogleGenerativeAI;
  
  constructor() {
    this.client = new GoogleGenerativeAI(config.providers.gemini.apiKey);
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{ text: string; usage?: Usage }> {
    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");
    
    // Pass systemInstruction and generationConfig to getGenerativeModel
    const genModel = this.client.getGenerativeModel({ 
      model,
      ...(systemMessage?.content ? { systemInstruction: systemMessage.content } : {}),
      ...(maxOutputTokens ? { generationConfig: { maxOutputTokens } } : {}),
    });
    
    const chat = genModel.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    });
    
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    
    // sendMessage accepts only the message text (generationConfig is set on the model)
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();
    
    // Estimate usage since Gemini doesn't always provide it
    const usage = estimateUsage(messages, text, model);
    
    return { text, usage };
  }
}
