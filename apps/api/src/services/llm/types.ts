import type { Message, Usage } from "@spectyra/shared";

export interface ChatProvider {
  name: string;
  models: string[];
  supportsUsage: boolean;
  
  chat(messages: Message[], model: string, maxOutputTokens?: number): Promise<{
    text: string;
    usage?: Usage;
  }>;
}
