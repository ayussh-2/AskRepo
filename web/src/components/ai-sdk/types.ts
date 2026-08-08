// Vercel AI SDK UI compliant types

export type MessageRole = "user" | "assistant" | "system" | "bot" | "data";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isError?: boolean;
}
